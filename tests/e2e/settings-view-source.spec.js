import { expect, test } from '@playwright/test';
import { hdriDefaults } from '../../src/config/hdri.js';
import { viewDefaults } from '../../src/config/viewSettings.js';
import { selectSettingsPage, settingsPanel } from './settings-navigation.helpers.js';

const key = 'nanfeng-lion:developer-settings:v1';
test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

async function open(page, settings = {}) {
  await page.addInitScript(({ key, settings }) => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('lion:settings-view-source:seeded')) {
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, pushPage: false, ...settings }));
      sessionStorage.setItem('lion:settings-view-source:seeded', '1');
    }
  }, { key, settings });
  await page.goto('/#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 70_000 });
  await page.locator('.site-navigation [data-action="settings"]').click();
}

test('设置分组首次打开和重新打开默认折叠，支持键盘展开收起', async ({ page }) => {
  await open(page);
  const panel = settingsPanel(page);
  await expect(panel.locator('details[open]')).toHaveCount(0);
  await expect(panel.getByRole('spinbutton')).toHaveCount(0);
  const summary = panel.locator('.developer-settings-page:not([hidden]) summary').first();
  await summary.focus(); await summary.press('Enter');
  await expect(panel.getByRole('spinbutton', { name: '公共透明度数值', exact: true })).toBeVisible();
  await summary.press('Space');
  await expect(panel.getByRole('spinbutton')).toHaveCount(0);
  await panel.getByRole('tab', { name: '视角', exact: true }).click();
  await expect(panel.locator('details[open]')).toHaveCount(0);
  await panel.locator('.developer-settings-page:not([hidden]) summary').first().click();
  await expect(panel.getByRole('spinbutton', { name: '结构最近观看距离数值', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(panel.locator('details[open]')).toHaveCount(0);
});

test('视角独立页保存缩放与俯仰边界，重置不覆盖其他参数', async ({ page }) => {
  await open(page, { headerBlur: 23 }); await selectSettingsPage(page, '视角');
  const panel = settingsPanel(page);
  for (const [label, value] of [['结构最近观看距离', .7], ['动作俯视角度下限', 0], ['动作仰视角度上限', 90]]) {
    const input = panel.getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(value)); await input.press('Tab');
  }
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ structureMinDistanceRatio: .7, actionMinPolarAngle: 0, actionMaxPolarAngle: 90 });
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 70_000 });
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '视角');
  await expect(panel.getByRole('spinbutton', { name: '结构最近观看距离数值', exact: true })).toHaveValue('0.7');
  await panel.getByRole('button', { name: '恢复视角默认参数', exact: true }).click();
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ ...viewDefaults, hdriSource: hdriDefaults.hdriSource, headerBlur: 23 });
});

test('动作新阈值同步滑杆与数值框，交叉距离联动并保存刷新', async ({ page }) => {
  await open(page, { actionMinDistance: 8, actionMaxDistance: 2, actionMinPolarAngle: 80, actionMaxPolarAngle: 179 });
  await selectSettingsPage(page, '视角');
  const panel = settingsPanel(page);
  const controls = [
    ['动作最近观看距离', 3, 6, '6'], ['动作最远观看距离', 3, 9, '6'],
    ['动作俯视角度下限', 0, 20, '20'], ['动作仰视角度上限', 60, 90, '90'],
  ];
  for (const [label, min, max, value] of controls) {
    const numeric = panel.getByRole('spinbutton', { name: `${label}数值`, exact: true });
    const slider = panel.getByRole('slider', { name: label, exact: true });
    for (const control of [numeric, slider]) {
      await expect(control).toHaveAttribute('min', String(min));
      await expect(control).toHaveAttribute('max', String(max));
      await expect(control).toHaveValue(value);
    }
  }
  const near = panel.getByRole('spinbutton', { name: '动作最近观看距离数值', exact: true });
  const far = panel.getByRole('spinbutton', { name: '动作最远观看距离数值', exact: true });
  await far.fill('4'); await far.press('Tab');
  await expect(near).toHaveValue('4');
  await near.fill('5.1'); await near.press('Tab');
  await expect(far).toHaveValue('5.5');
  await far.fill('3.5'); await far.press('Tab');
  await expect(near).toHaveValue('3.5');
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ actionMinDistance: 3.5, actionMaxDistance: 3.5, actionMinPolarAngle: 20, actionMaxPolarAngle: 90 });
  await page.reload();
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '视角');
  await expect(near).toHaveValue('3.5');
  await expect(far).toHaveValue('3.5');
});

test('HDRI保留森林与链接选择，本地文件不会写入持久化存储', async ({ page }) => {
  await open(page); await selectSettingsPage(page, 'HDRI');
  const panel = settingsPanel(page), source = panel.getByRole('combobox', { name: 'HDRI来源', exact: true });
  await expect(source).toHaveValue('forest');
  await source.selectOption('url');
  const url = panel.getByRole('textbox', { name: 'HDRI文件链接', exact: true });
  await url.fill('/assets/environments/forest.exr');
  await expect.poll(() => saved(page)).toMatchObject({ hdriUrl: '' });
  await panel.getByRole('button', { name: '应用HDRI链接', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ hdriSource: 'forest', hdriUrl: '' });
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ hdriSource: 'url', hdriUrl: '/assets/environments/forest.exr' });
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, 'HDRI');
  await source.selectOption('local');
  await panel.getByLabel('选择本地HDRI文件', { exact: true }).setInputFiles(`${process.cwd()}/source/public/assets/environments/forest.exr`);
  await expect(panel.getByRole('status')).toContainText('当前文件：forest.exr');
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => saved(page)).toMatchObject({ hdriSource: 'forest' });
  expect(await saved(page)).not.toHaveProperty('hdriFile');
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 70_000 });
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, 'HDRI');
  await expect(source).toHaveValue('forest');
  await source.selectOption('url');
  await expect(url).toHaveValue('/assets/environments/forest.exr');
});
