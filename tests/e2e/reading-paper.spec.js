import { test, expect } from '@playwright/test';
import { selectSettingsFor, settingsPanel } from './settings-navigation.helpers.js';

const key = 'nanfeng-lion:developer-settings:v1';
async function open(page, saved = {}, route = '') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, saved }) => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('paper-seeded')) {
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, ...saved }));
      sessionStorage.setItem('paper-seeded', '1');
    }
  }, { key, saved });
  await page.goto(`/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const material = locator => locator.evaluate(node => {
  const s = getComputedStyle(node), p = getComputedStyle(node, '::before'), t = getComputedStyle(node, '::after');
  return { bg: s.backgroundColor, border: s.borderTopColor, shadow: s.boxShadow, blur: s.backdropFilter, radius: s.borderRadius,
    mask: s.maskImage, opacity: s.opacity, paper: { bg: p.backgroundColor, mask: p.maskImage, pointer: p.pointerEvents, blur: p.backdropFilter, radius: p.borderRadius }, texture: Number(t.opacity) };
});
async function number(page, label, value) {
  await selectSettingsFor(page, label);
  const field = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await field.fill(String(value)); await field.press('Tab');
}

test('headings feather only the paper layer, while text and body surfaces stay crisp and clickable', async ({ page }) => {
  await open(page);
  for (const title of await page.locator('[data-surface="bookTitle"], [data-surface="cultureTitle"]').all()) {
    const s = await material(title);
    expect(s.bg).toBe('rgba(0, 0, 0, 0)'); expect(s.shadow).toBe('none'); expect(s.blur).toBe('none');
    expect(s.mask).toBe('none'); expect(s.opacity).toBe('1');
    expect(s.paper.bg).toBe('rgba(247, 245, 240, 0.65)'); expect(s.paper.mask).toContain('32px');
    expect(s.paper.pointer).toBe('none'); expect(s.paper.blur).toBe('none');
    expect(s.texture).toBeLessThanOrEqual(.025);
  }
  await page.locator('.heritage-type-image').click();
  const body = page.locator('.heritage-type-copy');
  expect(await material(body)).toMatchObject({ bg: 'rgba(247, 245, 240, 0.9)', blur: 'none', radius: '10px', opacity: '1' });
  await expect(body.locator('.heritage-summary')).toHaveCSS('color', 'rgb(60, 53, 45)');
  await expect(body.getByRole('button', { name: '收起介绍', exact: true })).toBeVisible();
  await body.getByRole('button', { name: '收起介绍', exact: true }).click();
  await expect(body).toBeHidden();
});

test('old defaults migrate once and mixed custom material, dimensions and playback settings survive', async ({ page }) => {
  await open(page, { bookTitleColor: '#fff9ee', bookTitleTransparency: 40, bookTitleBlur: 5, bookTitleRadius: 14,
    cultureBodyColor: '#aabbcc', cultureBodyTransparency: 63, cultureBodyBlur: 5, cultureBodyRadius: 27,
    expressionOverlayColor: '#fff8ea', expressionOverlayTransparency: 22, expressionOverlayBlur: 6, expressionOverlayRadius: 24,
    bookTitleWidth: 61, bookTitleLayoutVersion: 1, bookTitleSpacing: 77, bookIntroDuration: 19, navFontSize: 27, modelOverlayColor: '#68170f',
    hdriEnabled: false, hdriIntensity: 1.35, hdriRotation: 47, hdriExposure: -.4, hdriLightIntensity: .65 });
  await expect.poll(() => stored(page)).toMatchObject({ readingPaperVersion: 1, bookTitleColor: '#f7f5f0', bookTitleTransparency: 35, bookTitleBlur: 0, bookTitleRadius: 0,
    cultureBodyColor: '#aabbcc', cultureBodyTransparency: 63, cultureBodyBlur: 0, cultureBodyRadius: 27, expressionOverlayTransparency: 10,
    bookTitleWidth: 61, bookTitleSpacing: 77, bookIntroDuration: 19, navFontSize: 27, modelOverlayColor: '#68170f',
    hdriEnabled: false, hdriIntensity: 1.35, hdriRotation: 47, hdriExposure: -.4, hdriLightIntensity: .65 });
  await page.locator('.site-header [data-action="settings"]').click();
  await number(page, '书册标题底板透明度', 40);
  await selectSettingsFor(page, '书册标题');
  await settingsPanel(page).getByLabel('书册标题底板底色', { exact: true }).fill('#fff9ee');
  await page.reload(); await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
  await expect.poll(() => stored(page)).toMatchObject({ readingPaperVersion: 1, bookTitleTransparency: 40, bookTitleColor: '#fff9ee', cultureBodyTransparency: 63,
    hdriEnabled: false, hdriIntensity: 1.35, hdriRotation: 47, hdriExposure: -.4, hdriLightIntensity: .65 });
});

test('legacy shared opacity, unavailable storage and reset keep live controls usable', async ({ page }) => {
  await open(page, { archivePanelTransparency: 71 });
  await expect.poll(() => stored(page)).toMatchObject({ bookTitleTransparency: 71, bookDetailsTransparency: 71, cultureTitleTransparency: 71, cultureBodyTransparency: 71 });
  await page.locator('.site-header [data-action="settings"]').click();
  await settingsPanel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  await expect.poll(() => stored(page)).toMatchObject({ bookTitleTransparency: 35, bookDetailsTransparency: 10, cultureSourceCardTransparency: 5, expressionOverlayTransparency: 10 });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('storage unavailable'); };
  });
  await page.reload(); await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
  await page.locator('.site-header [data-action="settings"]').click();
  await number(page, '书册标题底板透明度', 0);
  expect((await material(page.locator('[data-surface="bookTitle"]'))).paper.bg).toBe('rgb(247, 245, 240)');
});

test('invalid legacy shared opacity falls back per surface, not to the heading opacity for every body', async ({ page }) => {
  await open(page, { archivePanelTransparency: null });
  await expect.poll(() => stored(page)).toMatchObject({ readingPaperVersion: 1, archivePanelTransparency: 35, bookTitleTransparency: 35, bookDetailsTransparency: 10, cultureTitleTransparency: 35, cultureBodyTransparency: 10 });
});

test('common draft stays unapplied and opacity endpoints remove every material layer without fading text', async ({ page }) => {
  await open(page);
  await page.locator('.site-header [data-action="settings"]').click();
  const p = settingsPanel(page);
  await expect(p.getByRole('spinbutton', { name: '公共透明度数值', exact: true })).toHaveValue('10');
  await expect(p.getByRole('spinbutton', { name: '公共模糊强度数值', exact: true })).toHaveValue('0');
  await expect(p.getByRole('spinbutton', { name: '公共圆角数值', exact: true })).toHaveValue('10');
  expect((await stored(page)).bookTitleTransparency).toBe(35);
  await p.getByRole('combobox', { name: '应用范围', exact: true }).selectOption('all');
  for (const value of [0, 100]) {
    const opacity = p.getByRole('spinbutton', { name: '公共透明度数值', exact: true });
    await opacity.fill(String(value)); await opacity.press('Tab');
    await p.getByRole('button', { name: '应用公共材质', exact: true }).click();
    for (const node of await page.locator('.home-archive-scene [data-surface]').all()) {
      const s = await material(node);
      expect(s.opacity).toBe('1'); expect(s.blur).toBe('none');
      if (value === 100) {
        expect(s.bg).toMatch(/(?:rgba\(0, 0, 0, 0\)|, 0\))$/);
        expect(s.border).toMatch(/, 0\)$/); expect(s.shadow === 'none' || s.shadow.includes(', 0)')).toBe(true);
        expect(s.texture).toBe(0);
        if (await node.getAttribute('data-surface') === 'bookTitle' || await node.getAttribute('data-surface') === 'cultureTitle') {
          expect(s.paper.bg).toBe('rgba(247, 245, 240, 0)'); expect(s.paper.blur).toBe('none');
        }
      }
    }
  }
  await number(page, '书册标题底板模糊强度', 12);
  expect((await material(page.locator('[data-surface="bookTitle"]'))).paper.blur).toBe('none');
  await number(page, '书册标题底板透明度', 35);
  expect((await material(page.locator('[data-surface="bookTitle"]'))).paper.blur).toBe('blur(12px)');
});

test('expression overview, details and comparisons share neutral paper and full transparency preserves content', async ({ page }) => {
  await open(page, {}, '#/state');
  for (const name of ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑']) {
    await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name, exact: true }).click();
    expect(await material(page.locator('#expressionStateCopy'))).toMatchObject({ bg: 'rgba(247, 245, 240, 0.9)', blur: 'none', radius: '10px' });
  }
  await page.locator('#expressionLionTrigger').click();
  await expect(page.locator('.expression-cues p').first()).toHaveCSS('color', 'rgb(60, 53, 45)');
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  for (const card of await page.locator('.expression-comparison-card').all()) expect((await material(card)).bg).toBe('rgba(247, 245, 240, 0.9)');
  await page.locator('.site-header [data-action="settings"]').click();
  await number(page, '神态文字底板透明度', 100);
  for (const card of await page.locator('.expression-comparison-card').all()) {
    const s = await material(card);
    expect(s.bg).toBe('rgba(247, 245, 240, 0)'); expect(s.border).toMatch(/, 0\)$/); expect(s.opacity).toBe('1');
  }
});
