import { test, expect } from '@playwright/test';
import { selectSettingsPage, settingsPanel } from './settings-navigation.helpers.js';

test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);

const storageKey = 'nanfeng-lion:developer-settings:v1';
const stage = page => page.getByRole('region', { name: '醒狮八态纵深图鉴', exact: true });
const tour = page => stage(page).getByRole('region', { name: '自动巡游', exact: true });
const scene = page => page.evaluate(() => window.__LION_DEPTH_SCENE__);
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const width = locator => locator.evaluate(element => element.getBoundingClientRect().width);
const overviewSize = page => page.locator('#depth-joy .project-description').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
const controls = [
  ['expressionTourMoveDuration', '单段行进时间', 2],
  ['expressionTourReadingDuration', '每态阅读停留', 3],
  ['expressionDepthImageScale', '狮头图像比例', 120],
  ['expressionDepthTextScale', '图文文字比例', 120],
  ['expressionDepthMarkerSize', '节点标记尺寸', 60],
  ['expressionDepthPointerStrength', '指针跟随强度', 0],
  ['expressionDepthWheelSpeed', '滚轮推进速度', 150],
];
const savedParameters = Object.fromEntries(controls.map(([name, , value]) => [name, value]));

async function prepare(page) {
  await page.addInitScript(key => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!sessionStorage.getItem('expression-depth-settings:seeded')) {
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, bookAutoplay: false }));
      sessionStorage.setItem('expression-depth-settings:seeded', '1');
    }
  }, storageKey);
  await page.goto('/?inspect=1#/state');
  await expect(stage(page)).toHaveClass(/has-webgl/);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.cards.length)).toBe(8);
}

async function goToJoy(page) {
  await stage(page).locator('.state-rail').getByRole('link', { name: '喜', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Math.abs((window.__LION_DEPTH_SCENE__?.chapter ?? -10) - 2)), { intervals: [100] }).toBeLessThan(.001);
  await expect(stage(page).locator('.state-rail').getByRole('link', { name: '喜', exact: true })).toHaveAttribute('aria-current', 'location');
}

async function openSettings(page) {
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '章节', '神态');
}

async function change(page, label, value) {
  const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function wheelDistance(page, expectedDistance) {
  const root = await stage(page).boundingBox();
  await page.mouse.move(root.x + root.width * .53, root.y + root.height * .56);
  const before = await stage(page).locator('.depth-scroll-viewport').evaluate(element => element.scrollTop);
  await page.mouse.wheel(0, 80);
  await expect.poll(() => stage(page).locator('.depth-scroll-viewport').evaluate((element, start) => element.scrollTop - start, before), { intervals: [100] }).toBeCloseTo(expectedDistance, 0);
  return stage(page).locator('.depth-scroll-viewport').evaluate((element, start) => element.scrollTop - start, before);
}

async function expectPointerStill(page) {
  const root = await stage(page).boundingBox();
  await page.mouse.move(root.x + root.width * .24, root.y + root.height * .28);
  await expect.poll(() => page.evaluate(() => Math.abs((window.__LION_DEPTH_SCENE__?.camera.x ?? -10) - .12)), { intervals: [100] }).toBeLessThan(.0001);
  const before = (await scene(page)).camera;
  await page.mouse.move(root.x + root.width * .76, root.y + root.height * .72, { steps: 5 });
  // Allow the real damped pointer path to react; a nonzero strength moves the camera here.
  await page.waitForTimeout(450);
  const after = (await scene(page)).camera;
  expect(after.x).toBeCloseTo(before.x, 5);
  expect(after.y).toBeCloseTo(before.y, 5);
}

async function observeTour(page) {
  await page.evaluate(() => {
    const element = document.querySelector('.expression-depth .auto-tour');
    window.__DEPTH_SETTINGS_TOUR_EVENTS__ = [];
    const record = () => {
      const event = { at: performance.now(), phase: element.dataset.phase, station: Number(element.dataset.station), status: element.dataset.status };
      const previous = window.__DEPTH_SETTINGS_TOUR_EVENTS__.at(-1);
      if (!previous || event.phase !== previous.phase || event.station !== previous.station || event.status !== previous.status) window.__DEPTH_SETTINGS_TOUR_EVENTS__.push(event);
    };
    const observer = new MutationObserver(record);
    observer.observe(element, { attributes: true, attributeFilter: ['data-phase', 'data-station', 'data-status'] });
    window.__DEPTH_SETTINGS_TOUR_OBSERVER__ = observer;
    record();
  });
}

test('八态七项设置驱动真实场景、巡游时序和设置保存取消事务', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await goToJoy(page);
  const original = await scene(page);
  const originalArtworkHeight = original.cards[0].artworkHeight;
  const originalFontSize = await overviewSize(page);
  const closedWidth = await width(stage(page));
  const defaultWheelDistance = await wheelDistance(page, 68);
  await goToJoy(page);

  await openSettings(page);
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => width(stage(page))).toBeLessThan(closedWidth - 200);
  for (const [, label] of controls) await expect(settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true })).toBeVisible();
  const beforeSave = await stored(page);
  for (const [, label, value] of controls) await change(page, label, value);
  expect(await stored(page)).toEqual(beforeSave);
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expect.poll(() => width(stage(page))).toBeCloseTo(closedWidth, 0);
  expect(await stored(page)).toMatchObject(savedParameters);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.orb?.radiusPx)).toBeCloseTo(30, 1);
  await expect.poll(async () => (await scene(page)).cards[0].artworkHeight / originalArtworkHeight).toBeCloseTo(1.2, 2);
  await expect.poll(async () => await overviewSize(page) / originalFontSize).toBeCloseTo(1.2, 2);

  await goToJoy(page);
  await expectPointerStill(page);
  const fasterWheelDistance = await wheelDistance(page, 102);
  expect(fasterWheelDistance / defaultWheelDistance).toBeCloseTo(1.5, 2);
  await goToJoy(page);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.faces[0]?.ready)).toBe(true);
  await observeTour(page);
  await tour(page).getByRole('button', { name: '开始自动巡游', exact: true }).click();
  await expect(tour(page)).toHaveAttribute('data-status', 'running');
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(tour(page)).toHaveAttribute('data-station', '2');
  // A state remains stopped until a real artwork click, even after the old 3-second dwell.
  await page.waitForTimeout(3200);
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  await expect(tour(page)).toHaveAttribute('data-station', '2');
  const artwork = (await scene(page)).cards[0].artworkPlaneBounds;
  const root = await stage(page).boundingBox();
  await page.mouse.click(root.x + artwork.centerX, root.y + artwork.centerY);
  await expect(tour(page)).toHaveAttribute('data-phase', 'animating');
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.faces[0]?.playing)).toBe(true);
  const dialog = stage(page).getByRole('dialog', { name: '喜 · 灵动欢喜', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.gallery-tour-reading strong')).toHaveText('3');
  await expect(tour(page)).toHaveAttribute('data-phase', 'reading');
  await expect(dialog).toHaveCount(0, { timeout: 6500 });
  await expect(tour(page)).toHaveAttribute('data-phase', 'moving');
  await expect(tour(page)).toHaveAttribute('data-station', '3');
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing');
  const events = await page.evaluate(() => window.__DEPTH_SETTINGS_TOUR_EVENTS__);
  const animated = events.find(event => event.phase === 'animating' && event.station === 2);
  const reading = events.find(event => event.phase === 'reading' && event.station === 2);
  const moving = events.find(event => event.phase === 'moving' && event.station === 3);
  const arrived = events.find(event => event.phase === 'viewing' && event.station === 3);
  expect(reading.at - animated.at).toBeGreaterThanOrEqual(2800);
  expect(reading.at - animated.at).toBeLessThan(4500);
  expect(moving.at - reading.at).toBeGreaterThanOrEqual(2800);
  expect(moving.at - reading.at).toBeLessThan(4500);
  expect(arrived.at - moving.at).toBeGreaterThanOrEqual(1700);
  expect(arrived.at - moving.at).toBeLessThan(3500);
  expect((await scene(page)).chapter).toBeCloseTo(3, 1);
  expect(new URL(page.url()).hash).toBe('#/state');
  await tour(page).getByRole('button', { name: '退出自动巡游', exact: true }).click();
  await page.evaluate(() => window.__DEPTH_SETTINGS_TOUR_OBSERVER__.disconnect());

  await page.reload();
  await expect(stage(page)).toHaveClass(/has-webgl/);
  await goToJoy(page);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.orb?.radiusPx)).toBeCloseTo(30, 1);
  expect(await stored(page)).toMatchObject(savedParameters);
  await openSettings(page);
  for (const [, label, value] of controls) await expect(settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true })).toHaveValue(String(value));
  for (const [label, value] of [['单段行进时间', 4], ['每态阅读停留', 8], ['狮头图像比例', 80], ['图文文字比例', 80], ['节点标记尺寸', 24], ['指针跟随强度', 150], ['滚轮推进速度', 50]]) await change(page, label, value);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.orb?.radiusPx)).toBeCloseTo(12, 1);
  expect(await stored(page)).toMatchObject(savedParameters);
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('alertdialog', { name: '放弃未保存的设置？', exact: true }).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expect.poll(() => width(stage(page))).toBeCloseTo(closedWidth, 0);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.orb?.radiusPx)).toBeCloseTo(30, 1);
  await expect.poll(async () => (await scene(page)).cards[0].artworkHeight / originalArtworkHeight).toBeCloseTo(1.2, 2);
  await expect.poll(async () => await overviewSize(page) / originalFontSize).toBeCloseTo(1.2, 2);
  expect(await stored(page)).toMatchObject(savedParameters);
  await goToJoy(page);
  await expectPointerStill(page);
  await wheelDistance(page, 102);
  expect(new URL(page.url()).hash).toBe('#/state');
  expect(errors).toEqual([]);
});
