import { test, expect } from '@playwright/test';

const auxiliaryText = [
  ['.eyebrow', 16],
  ['.subtitle', 18],
  ['#status', 18],
  ['#number', 30],
  ['.number small', 16],
  ['.note', 18],
  ['.bottom span', 16],
];

// Catch small-font overrides, short-window hiding, clipping, and enlarged text collisions.
for (const [width, height] of [[1920, 1080], [1920, 768], [1366, 768], [1024, 768], [1920, 560], [1920, 521], [1024, 560]]) {
  test(`加载辅助文字在 ${width}×${height} 清晰可读且完整无遮挡`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.install({ time: new Date('2026-10-20T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-20T00:00:01Z'));
    await page.goto('/assets/loading/index.html');
    await expect(page.locator('.loading-title img')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    // Drive the real loader to 100%, holding its clock before the existing fade-out timer.
    await page.evaluate(() => window.postMessage({
      type: 'lion:startup-progress', progress: 1, complete: true,
      message: '图像与章节使用预览 · 准备入场',
    }, location.origin));
    await page.clock.runFor(6400);
    await expect(page.locator('#number')).toHaveText('100');

    for (const [selector, minimum] of auxiliaryText) {
      const text = page.locator(selector);
      await expect.soft(text).toBeVisible({ timeout: 1000 });
      const fontSize = await text.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      expect.soft(fontSize, `${selector} computed font size`).toBeGreaterThanOrEqual(minimum);
    }

    const layout = await page.evaluate(selectors => {
      const targets = [...selectors, '.loading-title img', '.ribbon', '.hairline'];
      const rects = targets.map(selector => {
        const element = document.querySelector(selector);
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = selectors.includes(selector);
        const rect = text ? range.getBoundingClientRect() : element.getBoundingClientRect();
        let clipped = false;
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          if (/(hidden|clip|auto|scroll)/.test(style.overflowX) && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) clipped = true;
          if (/(hidden|clip|auto|scroll)/.test(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) clipped = true;
        }
        const unobscured = !text || [0.1, 0.5, 0.9].every(fraction => {
          const hit = document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2);
          return hit === element || element.contains(hit);
        });
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, clipped, unobscured };
      });
      const overlaps = [];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([a.selector, b.selector]);
        }
      }
      return { rects, overlaps, overflow: document.documentElement.scrollWidth - innerWidth };
    }, auxiliaryText.map(([selector]) => selector));

    for (const rect of layout.rects) {
      expect.soft(rect.width, `${rect.selector} width`).toBeGreaterThan(0);
      expect.soft(rect.height, `${rect.selector} height`).toBeGreaterThan(0);
      expect.soft(rect.left, `${rect.selector} left`).toBeGreaterThanOrEqual(0);
      expect.soft(rect.top, `${rect.selector} top`).toBeGreaterThanOrEqual(0);
      expect.soft(rect.right, `${rect.selector} right`).toBeLessThanOrEqual(width);
      expect.soft(rect.bottom, `${rect.selector} bottom`).toBeLessThanOrEqual(height);
      expect.soft(rect.clipped, `${rect.selector} ancestor clipping`).toBe(false);
      expect.soft(rect.unobscured, `${rect.selector} hit testing`).toBe(true);
    }
    expect(layout.overlaps, 'text, heading, ribbon and progress line must not overlap').toEqual([]);
    expect(layout.overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
  });
}
