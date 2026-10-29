import { expect, test } from '@playwright/test';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const canvas = page => page.locator('#chapterStage canvas');
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const prompt = page => page.getByRole('alertdialog', { name: '放弃未保存的设置？' });
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const limits = page => canvas(page).evaluate(element => JSON.parse(element.dataset.cameraLimits));
const cancel = page => settingsPanel(page).getByRole('button', { name: '取消', exact: true });
const save = page => settingsPanel(page).getByRole('button', { name: '保存设置', exact: true });
const dirty = page => settingsPanel(page).locator('.developer-settings-footer > p');

test.setTimeout(120_000);

async function prepare(page, { width = 1920, height = 1080, pushPage = true } = {}) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ storageKey, pushPage }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!sessionStorage.getItem('action-view-editing:seeded')) {
      localStorage.setItem(storageKey, JSON.stringify({ pushPage, carouselAutoplay: false, bookAutoplay: false }));
      sessionStorage.setItem('action-view-editing:seeded', '1');
    }
  }, { storageKey, pushPage });
  await page.goto('/#/theater');
  await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await expect(canvas(page)).toHaveAttribute('data-camera-state', 'idle');
  await trigger(page).click();
  await selectSettingsPage(page, '视角');
}

async function editFov(page, value) {
  const input = settingsPanel(page).getByRole('spinbutton', { name: '动作镜头视野数值', exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect.poll(() => limits(page)).toMatchObject({ fov: value });
}

async function expectOpen(page) {
  await expect(settingsPanel(page)).toBeVisible();
  await expect(prompt(page)).toBeHidden();
  await expect(page.locator('.settings-outside-guard')).toHaveCount(0);
  await expect(settingsPanel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toHaveCount(0);
}

async function orbitAndZoom(page) {
  // Find clear canvas space using actual hit testing, including overlay mode.
  // No synthetic pointer dispatch: OrbitControls must receive real mouse input.
  const point = await canvas(page).evaluate(element => {
    const box = element.getBoundingClientRect();
    const panel = document.getElementById('developerSettingsPanel').getBoundingClientRect();
    const available = Math.min(box.right, panel.left) - box.left;
    for (const xRatio of [.75, .55, .35]) for (const yRatio of [.5, .35, .65]) {
      const x = box.left + available * xRatio, y = box.top + box.height * yRatio;
      if (document.elementFromPoint(x, y) === element && document.elementFromPoint(x - 70, y + 35) === element) return { x, y };
    }
    throw new Error('No unobstructed camera drag region');
  });
  await expect(canvas(page)).toHaveAttribute('data-camera-state', 'idle');
  const before = JSON.parse(await canvas(page).getAttribute('data-camera-position'));
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 70, point.y + 35, { steps: 12 });
  await page.mouse.up();
  await expect(canvas(page)).toHaveAttribute('data-camera-state', 'idle');
  await expect.poll(async () => {
    const after = JSON.parse(await canvas(page).getAttribute('data-camera-position'));
    return Math.hypot(...after.map((value, index) => value - before[index]));
  }).toBeGreaterThan(.1);
  const radius = Number(await canvas(page).getAttribute('data-camera-radius'));
  const { min, max } = await limits(page);
  await page.mouse.wheel(0, radius > (min + max) / 2 ? -450 : 450);
  await expect.poll(async () => Math.abs(Number(await canvas(page).getAttribute('data-camera-radius')) - radius)).toBeGreaterThan(.1);
  await expectOpen(page);
}

for (const layout of [
  { name: '1920推开', width: 1920, height: 1080, pushPage: true, expected: 'push' },
  { name: '1920覆盖', width: 1920, height: 1080, pushPage: false, expected: 'overlay' },
  { name: '900窄窗覆盖回退', width: 900, height: 600, pushPage: true, expected: 'overlay' },
]) {
  test(`${layout.name}：边调参边真实转动缩放，连续保存不退出，只有取消退出`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page, layout);
    const originalCanvas = await canvas(page).elementHandle();
    await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', layout.expected);
    await expectOpen(page);
    // Clean and dirty sessions both ignore implicit dismissal.
    await page.keyboard.press('Escape');
    // The overlay panel legitimately covers the navigation. Activate its
    // accessible button by keyboard rather than force-clicking through it.
    await trigger(page).focus();
    await trigger(page).press('Enter');
    await expect(settingsPanel(page)).toBeFocused();
    await expect(trigger(page)).toHaveAccessibleName('返回视角设置，点击取消退出');
    await expectOpen(page);
    await orbitAndZoom(page);
    const baseline = await saved(page);
    await editFov(page, 62);
    expect(await saved(page)).toEqual(baseline);
    await page.keyboard.press('Escape');
    await trigger(page).focus();
    await trigger(page).press('Enter');
    await orbitAndZoom(page);
    expect(await saved(page)).toEqual(baseline);
    await save(page).click();
    await expectOpen(page);
    await expect(dirty(page)).toContainText('当前参数已保存');
    expect(await saved(page)).toMatchObject({ actionFov: 62 });
    await editFov(page, 64);
    await save(page).click();
    await expectOpen(page);
    await expect(dirty(page)).toContainText('当前参数已保存');
    expect(await saved(page)).toMatchObject({ actionFov: 64 });
    await editFov(page, 66);
    await cancel(page).click();
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: '继续编辑' }).click();
    await expectOpen(page);
    await orbitAndZoom(page);
    await cancel(page).click();
    await prompt(page).getByRole('button', { name: '放弃更改' }).click();
    await expect(settingsPanel(page)).toHaveCount(0);
    await expect.poll(() => limits(page)).toMatchObject({ fov: 64 });
    expect(await saved(page)).toMatchObject({ actionFov: 64 });
    expect(await originalCanvas.evaluate(element => element === document.querySelector('#chapterStage canvas'))).toBe(true);
    await trigger(page).click();
    await expectOpen(page);
    await cancel(page).click();
    await expect(settingsPanel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
    await expect.poll(() => limits(page)).toMatchObject({ fov: 64 });
    expect(errors).toEqual([]);
  });
}

test('其他设置分类及其他章节保留外部点击与Escape关闭，返回动作视角恢复现场测试', async ({ page }) => {
  await prepare(page);
  await selectSettingsPage(page, '外观');
  await expect(page.locator('.settings-outside-guard')).toBeVisible();
  await page.locator('.settings-outside-guard').click({ position: { x: 400, y: 220 } });
  await expect(settingsPanel(page)).toHaveCount(0);
  await trigger(page).click();
  await selectSettingsPage(page, '视角');
  await expectOpen(page);
  await page.getByRole('button', { name: '看狮头 · 八态', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-route', 'state');
  await expect(settingsPanel(page)).toBeVisible();
  await expect(page.locator('.settings-outside-guard')).toBeVisible();
  await expect(settingsPanel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settingsPanel(page)).toHaveCount(0);
  await page.locator('.site-navigation [data-route="action"]').click();
  await page.getByRole('link', { name: '进入三维展厅', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await trigger(page).click();
  await expectOpen(page);
  await orbitAndZoom(page);
  await cancel(page).click();
  await expect(settingsPanel(page)).toHaveCount(0);
});

test('视角保存失败仍保留未保存草稿，取消后回滚且不落盘', async ({ page }) => {
  await prepare(page);
  const baseline = await saved(page);
  await editFov(page, 63);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, storageKey);
  await save(page).click();
  await expectOpen(page);
  await expect(page.locator('.settings-status')).toContainText('无法保存到浏览器');
  await expect(dirty(page)).toContainText('未保存');
  await orbitAndZoom(page);
  await cancel(page).click();
  await prompt(page).getByRole('button', { name: '放弃更改' }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expect.poll(() => limits(page)).toMatchObject({ fov: baseline.actionFov });
  expect(await saved(page)).toEqual(baseline);
});
