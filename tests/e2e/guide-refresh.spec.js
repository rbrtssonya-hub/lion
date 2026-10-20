import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';
import { scene, actionButton, actionVideo, openTheater, selectAction } from './action-theater.helpers.js';

const key = 'nanfeng-lion:developer-settings:v1';
async function open(page, route = '/', saved = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({ key, saved }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, ...saved }));
  }, { key, saved });
  await page.goto(route);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35000 });
}

test('书册标题纸面按红框收窄，旧默认只迁移一次，之后自选宽度可保留', async ({ page }) => {
  await open(page, '/', { bookTitleWidth: 100, headerTransparency: 37 });
  const panel = page.locator('[data-surface="bookTitle"]');
  const ratio = () => panel.evaluate(el => el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width);
  await expect.poll(ratio).toBeCloseTo(.69, 2);
  expect(await panel.evaluate(el => Math.abs(el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 - (el.parentElement.getBoundingClientRect().left + el.parentElement.getBoundingClientRect().width / 2)))).toBeLessThan(1);
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookTitle');
  const input = page.getByRole('spinbutton', { name: '书册标题底板宽度数值', exact: true });
  await expect(input).toHaveValue('69');
  await input.fill('100'); await input.press('Tab');
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35000 });
  await expect.poll(ratio).toBeCloseTo(1, 2);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).headerTransparency, key)).toBe(37);
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookTitle');
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(input).toHaveValue('69');
});

test('书册七节点同高，狮头行进时出现离散粒子，停下后自然清空', async ({ page }) => {
  await open(page);
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await expect(nav.locator('button')).toHaveCount(7);
  await expect(nav.locator('.lion-book-guide-character canvas')).toHaveCount(1);
  const levels = await nav.locator('button .lion-book-game-platform').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().top));
  expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1);
  await expect(nav.locator('filter, .lion-book-ink-trail, .lion-book-ink-wash')).toHaveCount(0);
  expect(await nav.evaluate(el => Number(getComputedStyle(el.querySelector('.lion-book-guide-character')).zIndex)
    > Math.max(...[...el.querySelectorAll('button')].map(button => Number(getComputedStyle(button).zIndex))))).toBe(true);
  await nav.locator('[data-book-page="ending"]').click();
  await expect.poll(() => nav.locator('.lion-book-particles').evaluate(el => {
    const data = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
    return data.some((v, i) => i % 4 === 3 && v > 0);
  })).toBe(true);
  await expect.poll(() => nav.evaluate(el => {
    const a = el.querySelector('.lion-book-guide-character').getBoundingClientRect();
    const b = el.querySelector('[aria-current] .lion-book-game-platform').getBoundingClientRect();
    return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
  })).toBeLessThan(2);
  await expect.poll(() => nav.locator('.lion-book-particles').evaluate(el => el.getContext('2d').getImageData(0, 0, el.width, el.height).data.every((v, i) => i % 4 !== 3 || v === 0))).toBe(true);
});

test('动作页新四站选择在减弱动态时保持标题和键盘联动', async ({ page }) => {
  await openTheater(page, { reducedMotion: 'reduce' });
  await expect(page.locator('#chapterStage .action-guide-character, #chapterStage .action-timeline')).toHaveCount(0);
  await actionButton(page, 'tuqiu').focus();
  await page.keyboard.press('Enter');
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tuqiu');
  await expect(page.locator('#theaterActionName')).toHaveText('狮子吐球');
  await selectAction(page, 'meihuazhuang');
  await expect(page.locator('#theaterActionName')).toHaveText('踩梅花桩');
  await expect(page).toHaveURL(/#\/action$/);
});

test('旧游戏角色素材失败不影响巨幕厅与真实四站选择', async ({ page }) => {
  await page.route('**/assets/action-guide/**', route => route.abort());
  await openTheater(page);
  await selectAction(page, 'doumao');
  await expect(page.locator('#theaterActionName')).toHaveText('抖毛');
  expect(await actionVideo(page, 'doumao').evaluate(video => video.videoWidth)).toBe(2560);
  await expect(page.locator('#chapterStage .action-guide-character')).toHaveCount(0);
});

test('巨幕厅隐藏时停止绘制与视频，恢复后继续独立模型动画和先前播放', async ({ page }) => {
  await openTheater(page);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(scene(page)).toHaveAttribute('data-render-state', 'inactive');
  const stopped = await scene(page).getAttribute('data-rendered-frames');
  await page.waitForTimeout(250);
  expect(await scene(page).getAttribute('data-rendered-frames')).toBe(stopped);
  await expect(actionVideo(page, 'tanqing')).toHaveJSProperty('paused', true);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(scene(page)).toHaveAttribute('data-render-state', 'active');
  await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames'))).toBeGreaterThan(Number(stopped));
  await expect(actionVideo(page, 'tanqing')).toHaveJSProperty('paused', false);
});

test('默认收窄不使装饰额外换行或增高，真正窄底板仍完整显示', async ({ page }) => {
  await open(page);
  const panel = page.locator('[data-surface="bookTitle"]');
  for (const width of [1920, 1366, 1280, 1024, 900]) {
    await page.setViewportSize({ width, height: 768 });
    await page.evaluate(() => document.fonts.ready);
    const sizes = await panel.evaluate(el => {
      const before = el.getBoundingClientRect().height;
      el.style.setProperty('width', '100%', 'important');
      const full = el.getBoundingClientRect().height;
      el.style.removeProperty('width');
      return { before, full, overflow: el.scrollWidth - el.clientWidth };
    });
    expect(Math.abs(sizes.before - sizes.full), `window ${width}`).toBeLessThan(2);
    expect(sizes.overflow).toBeLessThanOrEqual(1);
  }
});
