import { test, expect } from '@playwright/test';
import { selectSettingsPage } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置' });
const sources = page => page.locator('#homeCultureSources');
async function open(page, saved = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({ storageKey, saved }) => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify({ bookAutoplay: false, ...saved }));
  }, { storageKey, saved });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await page.locator('#enterWork').click();
  await page.locator('.home-archive-nav [data-home-section="homeCultureSources"]').click();
}
async function settings(page) {
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '资料');
}
async function edit(page, label, value) {
  const input = panel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
}
async function typography(page, title, body, meta) {
  await expect(sources(page).locator('h2')).toHaveCSS('font-size', `${title}px`);
  for (const selector of ['.home-culture-source-description', '.heritage-source-group a']) {
    await expect(sources(page).locator(selector).first()).toHaveCSS('font-size', `${body}px`);
  }
  for (const selector of ['.home-culture-source-publisher', '.heritage-source-group small']) {
    await expect(sources(page).locator(selector).first()).toHaveCSS('font-size', `${meta}px`);
  }
}

test('source text has readable defaults and independent preview, discard and saved typography', async ({ page }) => {
  await open(page, { headerBlur: 21, cultureSourcesWidth: 83, bookIntroDuration: 19 });
  await typography(page, 32, 18, 16);
  await settings(page);
  await edit(page, '资料标题字号', 40);
  await edit(page, '资料正文字号', 24);
  await edit(page, '资料辅助字号', 20);
  await typography(page, 40, 24, 20);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).sourcesBodyFontSize, storageKey)).toBe(18);
  await panel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '放弃更改', exact: true }).click();
  await typography(page, 32, 18, 16);
  await settings(page);
  await edit(page, '资料标题字号', 40);
  await edit(page, '资料正文字号', 24);
  await edit(page, '资料辅助字号', 20);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await page.reload();
  await typography(page, 40, 24, 20);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)).toMatchObject({
    headerBlur: 21, cultureSourcesWidth: 83, sourcesTitleFontSize: 40, sourcesBodyFontSize: 24, sourcesMetaFontSize: 20,
  });
});

test('maximum source font sizes fit narrow desktop surfaces and expose readable licence text', async ({ page }) => {
  await open(page, { sourcesTitleFontSize: 48, sourcesBodyFontSize: 28, sourcesMetaFontSize: 22 });
  for (const width of [900, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await sources(page).scrollIntoViewIfNeeded();
    await typography(page, 48, 28, 22);
    for (const section of ['.home-culture-photo-licenses', '.archive-provenance']) {
      await expect(sources(page).locator(`${section} p`).first()).toHaveCSS('font-size', '28px');
    }
    await expect(sources(page).locator('.home-culture-photo-license .home-culture-credit').first()).toHaveCSS('font-size', '22px');
    const boxes = await sources(page).evaluate(element => [element, ...element.querySelectorAll('.home-culture-source-card, .heritage-source-group, .home-culture-photo-license')].map(node => ({
      width: node.clientWidth, content: node.scrollWidth,
    })));
    expect(boxes.every(box => box.content <= box.width + 1), JSON.stringify({ width, boxes })).toBe(true);
  }
});
