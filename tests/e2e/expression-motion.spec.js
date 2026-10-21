import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const glyphs = ['Joy', 'Anger', 'Sorrow', 'Delight', 'Motion', 'Stillness', 'Surprise', 'Doubt'];
const names = ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑'];

async function openExpression(page) {
  await page.goto('/#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await expect(page.locator('#expressionStateTitle img')).toBeVisible();
  await expect.poll(() => page.locator('#expressionStateTitle img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
});

test('神态同一毛笔标题连续缩小平移到解读，反向中断保持当前位置并逐层进入文字', async ({ page }) => {
  await openExpression(page);
  const result = await page.evaluate(async () => {
    const title = document.querySelector('#expressionStateTitle');
    const panel = document.querySelector('#expressionStateCopy');
    const box = () => { const rect = title.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; };
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = box();
    document.querySelector('#expressionLionTrigger').click();
    await nextFrame();
    const first = box();
    const outgoingTitleOpacity = Number(getComputedStyle(document.querySelector('[data-expression-ghost] strong')).opacity);
    const sameNode = title === document.querySelector('#expressionStateTitle');
    const entering = [...panel.querySelectorAll('[data-expression-reveal]')].map(element => ({
      opacity: Number(getComputedStyle(element).opacity),
      delay: element.getAnimations()[0]?.effect.getTiming().delay,
    }));
    await new Promise(resolve => setTimeout(resolve, 110));
    const midway = box();
    const headlineElement = document.querySelector('#expressionDetailTitle');
    const headline = { left: headlineElement.getBoundingClientRect().left, opacity: Number(getComputedStyle(headlineElement).opacity) };
    document.querySelector('.expression-return').click();
    await nextFrame();
    const reversed = box();
    return { before, first, midway, reversed, sameNode, entering, outgoingTitleOpacity, headline };
  });
  expect(result.sameNode).toBe(true);
  expect(result.outgoingTitleOpacity).toBe(0);
  // Sampling includes a few animation frames: this must still begin near the
  // old large rectangle, rather than immediately appearing as a 56px stamp.
  expect(result.first.width).toBeGreaterThan(80);
  expect(result.first.width).toBeLessThanOrEqual(result.before.width + 2);
  expect(result.midway.width).toBeLessThan(result.first.width);
  expect(Math.hypot(result.midway.x - result.first.x, result.midway.y - result.first.y)).toBeGreaterThan(3);
  expect(result.midway.x + result.midway.width <= result.headline.left + 1 || result.headline.opacity < .001).toBe(true);
  expect(Math.abs(result.reversed.width - result.midway.width)).toBeLessThan(38);
  expect(result.entering.some(item => item.opacity < .6)).toBe(true);
  expect(new Set(result.entering.map(item => item.delay)).size).toBeGreaterThan(3);
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-motion', 'idle');
  await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
  expect(await page.locator('#expressionStateTitle').evaluate(element => getComputedStyle(element).transform)).toBe('none');
});

test('八个图像毛笔标题与无障碍文字对应，快速切态对照返回和离页清理动画快照', async ({ page }) => {
  await openExpression(page);
  const sources = [];
  for (let index = 0; index < names.length; index += 1) {
    await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name: names[index], exact: true }).click();
    await expect(page.locator('#expressionStateTitle')).toHaveText(names[index]);
    const image = page.locator('#expressionStateTitle img');
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
    const source = await image.getAttribute('src');
    expect(new URL(source, page.url()).pathname, glyphs[index]).toBe(new URL(assetPaths[`expressionGlyph${glyphs[index]}`], page.url()).pathname);
    sources.push(source);
  }
  expect(new Set(sources).size).toBe(8);
  await page.evaluate(async () => {
    for (let index = 0; index < 5; index += 1) {
      document.querySelector('#expressionLionTrigger').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      document.querySelector('#expressionNext').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  });
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
  await page.getByRole('button', { name: '八态浏览', exact: true }).click();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-motion', 'idle');
  await page.locator('#expressionLionTrigger').evaluate(element => element.click());
  await page.evaluate(() => { location.hash = '#/entry'; });
  await expect(page.locator('#expressionStateCopy')).toHaveCount(0);
  await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
});

test('减少动态效果初始和运行时切换均立即呈现最终排版，不遗留不可见文字', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openExpression(page);
  await page.locator('#expressionLionTrigger').click();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
  expect(await page.locator('#expressionStateCopy').evaluate(panel => panel.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.expression-return').evaluate(element => element.click());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-motion', 'idle');
  await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
  for (const paragraph of await page.locator('.expression-description p').all()) await expect(paragraph).toHaveCSS('opacity', '1');
  expect(await page.locator('#expressionStateCopy').evaluate(panel => panel.getAnimations({ subtree: true }).length)).toBe(0);
});
