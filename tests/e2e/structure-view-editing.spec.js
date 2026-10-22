import { test, expect } from '@playwright/test';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';
import { viewDefaults } from '../../src/config/viewSettings.js';

test.use({ trace: 'off' });
test.setTimeout(120_000);

const storageKey = 'nanfeng-lion:developer-settings:v1';
const canvas = page => page.locator('#sceneContainer canvas');
const interaction = page => page.locator('#sceneInteraction');
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const prompt = page => page.getByRole('alertdialog', { name: '放弃未保存的设置？' });
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const limits = page => canvas(page).evaluate(element => JSON.parse(element.dataset.cameraLimits));
const view = page => canvas(page).evaluate(element => JSON.parse(element.dataset.viewSettings));
const cancel = page => settingsPanel(page).getByRole('button', { name: '取消', exact: true });
const save = page => settingsPanel(page).getByRole('button', { name: '保存设置', exact: true });
const footer = page => settingsPanel(page).locator('.developer-settings-footer > p');

async function prepare(page, { width = 1920, height = 1080, pushPage = true } = {}) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ storageKey, pushPage }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!sessionStorage.getItem('structure-view-editing:seeded')) {
      localStorage.setItem(storageKey, JSON.stringify({ pushPage, carouselAutoplay: false, bookAutoplay: false }));
      sessionStorage.setItem('structure-view-editing:seeded', '1');
    }
  }, { storageKey, pushPage });
  await page.goto('/#/model');
  await expect(canvas(page)).toHaveAttribute('data-full-hair-groups', '33', { timeout: 70_000 });
  await expect(canvas(page)).toHaveAttribute('data-focus-state', 'idle');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  await trigger(page).click();
  await selectSettingsPage(page, '视角');
}

async function expectOpen(page) {
  await expect(settingsPanel(page)).toBeVisible();
  await expect(prompt(page)).toBeHidden();
  await expect(page.locator('.settings-outside-guard')).toHaveCount(0);
  await expect(settingsPanel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toHaveCount(0);
}

async function edit(page, label, value) {
  const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function editFov(page, value) {
  await edit(page, '结构镜头视野', value);
  await expect.poll(() => limits(page)).toMatchObject({ fov: value });
}

async function pointerPoint(page) {
  return interaction(page).evaluate(element => {
    const box = element.getBoundingClientRect();
    const panel = document.getElementById('developerSettingsPanel').getBoundingClientRect();
    const available = Math.min(box.right, panel.left) - box.left;
    for (const xRatio of [.45, .25, .65]) for (const yRatio of [.45, .62, .3]) {
      const x = Math.round(box.left + available * xRatio), y = Math.round(box.top + box.height * yRatio);
      if (document.elementFromPoint(x, y) === element && document.elementFromPoint(x + 75, y + 30) === element) return { x, y };
    }
    throw new Error('No unobstructed model interaction region');
  });
}

async function orbitAndZoom(page) {
  const point = await pointerPoint(page);
  const projections = () => canvas(page).evaluate(element => JSON.parse(element.dataset.partProjections));
  await expect.poll(async () => Object.keys(await projections()).length).toBeGreaterThanOrEqual(6);
  // Model diagnostics project actual pickable 3D surfaces after settling. A
  // before/after difference proves native drag reached OrbitControls, unlike
  // checking only a mounted canvas or a CSS transform.
  await expect.poll(async () => {
    const before = JSON.stringify(await projections());
    await page.waitForTimeout(180);
    return before === JSON.stringify(await projections());
  }).toBe(true);
  const before = await projections();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 75, point.y + 30, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const after = await projections();
    return Object.keys(before).filter(id => after[id] && Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y) > 2).length;
  }).toBeGreaterThanOrEqual(2);
  const distance = Number(await canvas(page).getAttribute('data-camera-distance'));
  const { min, max } = await limits(page);
  await page.mouse.wheel(0, distance > (min + max) / 2 ? -450 : 450);
  await expect.poll(async () => Math.abs(Number(await canvas(page).getAttribute('data-camera-distance')) - distance)).toBeGreaterThan(.05);
  await expectOpen(page);
}

async function clickSceneWithoutClosing(page) {
  const point = await pointerPoint(page);
  await page.mouse.click(point.x, point.y);
  await expectOpen(page);
  await expect(canvas(page)).toHaveAttribute('data-focus-state', 'idle');
}

for (const layout of [
  { name: '1920推开', width: 1920, height: 1080, pushPage: true, expected: 'push' },
  { name: '1920覆盖', width: 1920, height: 1080, pushPage: false, expected: 'overlay' },
  { name: '900窄窗覆盖回退', width: 900, height: 600, pushPage: true, expected: 'overlay' },
]) {
  test(`结构${layout.name}：实时转动缩放和连续保存保持打开，重置与取消恢复最新保存基线`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page, layout);
    const original = await canvas(page).elementHandle();
    await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', layout.expected);
    await expectOpen(page);
    await page.keyboard.press('Escape');
    await trigger(page).focus();
    await trigger(page).press('Enter');
    await expect(settingsPanel(page)).toBeFocused();
    await expect(trigger(page)).toHaveAccessibleName('返回视角设置，点击取消退出');
    await clickSceneWithoutClosing(page);
    await orbitAndZoom(page);
    const baseline = await saved(page);
    await editFov(page, 45);
    await edit(page, '结构最近观看距离', .65);
    await edit(page, '结构最远观看距离', 3.1);
    await expect.poll(() => view(page)).toMatchObject({ structureFov: 45, structureMinDistanceRatio: .65, structureMaxDistanceRatio: 3.1 });
    expect(await saved(page)).toEqual(baseline);
    await expect(footer(page)).toContainText('未保存');
    await page.keyboard.press('Escape');
    await clickSceneWithoutClosing(page);
    await orbitAndZoom(page);
    expect(await saved(page)).toEqual(baseline);
    await save(page).click();
    await expectOpen(page);
    await expect(footer(page)).toContainText('当前参数已保存');
    expect(await saved(page)).toMatchObject({ structureFov: 45, structureMinDistanceRatio: .65, structureMaxDistanceRatio: 3.1 });
    await editFov(page, 47);
    await save(page).click();
    await expectOpen(page);
    await expect(footer(page)).toContainText('当前参数已保存');
    const latest = await saved(page);
    expect(latest).toMatchObject({ structureFov: 47 });
    await settingsPanel(page).getByRole('button', { name: '恢复视角默认参数', exact: true }).click();
    await expect.poll(() => view(page)).toMatchObject(viewDefaults);
    expect(await saved(page)).toEqual(latest);
    await cancel(page).click();
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: '继续编辑', exact: true }).click();
    await expectOpen(page);
    await orbitAndZoom(page);
    await cancel(page).click();
    await prompt(page).getByRole('button', { name: '放弃更改', exact: true }).click();
    await expect(settingsPanel(page)).toHaveCount(0);
    await expect.poll(() => view(page)).toMatchObject({ structureFov: 47, structureMinDistanceRatio: .65, structureMaxDistanceRatio: 3.1 });
    expect(await saved(page)).toEqual(latest);
    expect(await original.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
    await trigger(page).click();
    await expectOpen(page);
    await cancel(page).click();
    await expect(settingsPanel(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await page.reload();
    await expect(canvas(page)).toHaveAttribute('data-full-hair-groups', '33', { timeout: 70_000 });
    await expect.poll(() => view(page)).toMatchObject({ structureFov: 47, structureMinDistanceRatio: .65, structureMaxDistanceRatio: 3.1 });
    expect(errors).toEqual([]);
  });
}

test('结构其他设置分类与首页神态继续原事务，回到结构视角恢复现场测试', async ({ page }) => {
  await prepare(page);
  await selectSettingsPage(page, '外观');
  await expect(page.locator('.settings-outside-guard')).toBeVisible();
  await expect(settingsPanel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toBeVisible();
  await page.locator('.settings-outside-guard').click({ position: { x: 400, y: 220 } });
  await expect(settingsPanel(page)).toHaveCount(0);
  for (const [route, value] of [['entry', 44], ['state', 46]]) {
    await page.locator(`.site-navigation [data-route="${route}"]`).click();
    await expect(page.locator('main')).toHaveAttribute('data-route', route);
    await trigger(page).click();
    await selectSettingsPage(page, '视角');
    await expect(page.locator('.settings-outside-guard')).toBeVisible();
    await expect(settingsPanel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toBeVisible();
    await edit(page, '结构镜头视野', value);
    if (route === 'entry') await page.locator('.settings-outside-guard').click({ position: { x: 400, y: 220 } });
    else await page.keyboard.press('Escape');
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: '继续编辑', exact: true }).click();
    await save(page).click();
    await expect(settingsPanel(page)).toHaveCount(0);
    expect(await saved(page)).toMatchObject({ structureFov: value });
  }
  await page.locator('.site-navigation [data-route="model"]').click();
  await trigger(page).click();
  await expectOpen(page);
  await orbitAndZoom(page);
  await cancel(page).click();
  await expect(settingsPanel(page)).toHaveCount(0);
});

test('结构视角保存失败保留可操作草稿，取消后回滚原值而不落盘', async ({ page }) => {
  await prepare(page);
  const baseline = await saved(page);
  await editFov(page, 43);
  await page.evaluate(key => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) throw new DOMException('blocked', 'QuotaExceededError');
      return native.call(this, name, value);
    };
  }, storageKey);
  await save(page).click();
  await expectOpen(page);
  await expect(page.locator('.settings-status')).toContainText('无法保存到浏览器');
  await expect(footer(page)).toContainText('未保存');
  await orbitAndZoom(page);
  await cancel(page).click();
  await prompt(page).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expect.poll(() => limits(page)).toMatchObject({ fov: baseline.structureFov });
  expect(await saved(page)).toEqual(baseline);
});
