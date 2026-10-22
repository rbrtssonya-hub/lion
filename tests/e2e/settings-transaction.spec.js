import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectSettingsFor } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置' });
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const prompt = page => page.getByRole('alertdialog', { name: '放弃未保存的设置？' });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);

async function open(page) {
  await trigger(page).click();
  await expect(panel(page)).toBeVisible();
}

async function change(page, label, value) {
  await selectSettingsFor(page, label);
  const input = panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'));
  await page.goto('/');
});

test('实时预览不写存储，外部点击提示，继续编辑及放弃恢复快照', async ({ page }) => {
  await expect.poll(() => stored(page)).toMatchObject({ headerTransparency: 20 });
  const initial = await stored(page);
  await open(page);
  await change(page, '顶栏透明度', 61);
  await expect.poll(() => page.locator('.site-shell').evaluate(element => element.style.getPropertyValue('--header-fill-opacity'))).toBe('0.39');
  expect(await stored(page)).toEqual(initial);
  await page.locator('.settings-outside-guard').click({ position: { x: 400, y: 200 } });
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page).getByRole('button', { name: '继续编辑' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt(page).getByRole('button', { name: '放弃更改' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(prompt(page).getByRole('button', { name: '继续编辑' })).toBeFocused();
  await prompt(page).getByRole('button', { name: '继续编辑' }).click();
  await expect(prompt(page)).toBeHidden();
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值', exact: true })).toHaveValue('61');
  await panel(page).getByRole('button', { name: '取消', exact: true }).click();
  await prompt(page).getByRole('button', { name: '放弃更改' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expect.poll(() => page.locator('.site-shell').evaluate(element => element.style.getPropertyValue('--header-fill-opacity'))).toBe('0.8');
  expect(await stored(page)).toEqual(initial);
});

test('保存提交并可刷新，恢复默认也仅预览，放弃后恢复已保存值', async ({ page }) => {
  await open(page);
  await change(page, '顶栏透明度', 53);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('.settings-status')).toHaveText('设置已保存。');
  expect(await stored(page)).toMatchObject({ headerTransparency: 53 });
  await page.reload();
  await open(page);
  await panel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  expect(await stored(page)).toMatchObject({ headerTransparency: 53 });
  await panel(page).getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await prompt(page).getByRole('button', { name: '放弃更改' }).click();
  await open(page);
  await selectSettingsFor(page, '顶栏透明度');
  await expect(panel(page).getByRole('spinbutton', { name: '顶栏透明度数值', exact: true })).toHaveValue('53');
});

test('导出JSON包含未保存的当前参数及本地HDRI元数据，不提交或伪造文件', async ({ page }) => {
  await open(page);
  const initial = await stored(page);
  await change(page, '顶栏透明度', 64);
  await selectSettingsFor(page, 'HDRI来源');
  await panel(page).getByRole('combobox', { name: 'HDRI来源', exact: true }).selectOption('local');
  const file = panel(page).locator('input[type="file"]');
  await file.setInputFiles({ name: 'session-light.hdr', mimeType: 'application/octet-stream', buffer: Buffer.from('test local metadata') });
  const downloadPromise = page.waitForEvent('download');
  await panel(page).getByRole('button', { name: '导出当前参数', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^南风有狮-当前设置-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toMatchObject({ format: 'nanfeng-lion-settings', version: 1, state: 'unsaved-preview', settings: { headerTransparency: 64, hdriSource: 'local' }, sessionAssets: { hdri: { name: 'session-light.hdr', requiresReselection: true } } });
  expect(exported.settings).not.toHaveProperty('hdriFile');
  expect(JSON.stringify(exported)).not.toContain('blob:');
  expect(await stored(page)).toEqual(initial);
  await expect(panel(page)).toBeVisible();
});

test('Escape先取消拖动，再提示未保存，提示内Escape继续编辑', async ({ page }) => {
  await open(page);
  await change(page, '顶栏透明度', 50);
  const edge = page.getByRole('separator', { name: '调整侧栏宽度', exact: true });
  const bounds = await edge.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 80, bounds.y + 180, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(prompt(page)).toBeHidden();
  await expect(panel(page)).toBeVisible();
  await expect(edge).toHaveAttribute('aria-valuenow', '340');
  await page.keyboard.press('Escape');
  await expect(prompt(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(prompt(page)).toBeHidden();
  await expect(panel(page)).toBeVisible();
});

test('存储失败保留草稿并提示，可导出；无改动时外部点击直接关闭', async ({ page }) => {
  await open(page);
  await page.locator('.settings-outside-guard').click({ position: { x: 400, y: 200 } });
  await expect(panel(page)).toHaveCount(0);
  await expect(prompt(page)).toHaveCount(0);
  await open(page);
  await change(page, '顶栏透明度', 72);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'QuotaExceededError'); }; });
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.locator('.settings-status')).toContainText('无法保存到浏览器');
  const downloadPromise = page.waitForEvent('download');
  await panel(page).getByRole('button', { name: '导出当前参数', exact: true }).click();
  const exported = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(exported).toMatchObject({ state: 'unsaved-preview', settings: { headerTransparency: 72 } });
});
