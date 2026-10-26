import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const introKey = 'nanfeng-lion:book-intro-seen:v1';

async function configure(page, { seen = true, height = 1080, settings = {} } = {}) {
  await page.setViewportSize({ width: 1920, height });
  await page.addInitScript(({ settingsKey, introKey, seen, settings }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (seen) sessionStorage.setItem(introKey, '1');
    localStorage.setItem(settingsKey, JSON.stringify({ pushPage: false, bookAutoplay: false, bookPageInterval: 3, ...settings }));
  }, { settingsKey, introKey, seen, settings });
}

async function openBook(page, options) {
  await configure(page, options);
  await page.goto('/');
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await page.locator('.lion-book-stage').scrollIntoViewIfNeeded();
}

test('书册默认放大，尺寸设置即时生效而不重建纸张文档', async ({ page }) => {
  await openBook(page);
  const stage = page.locator('.lion-book-stage');
  await expect(stage).toHaveCSS('height', '680px');
  await page.locator('#homeLionBook iframe').evaluate(frame => { frame.dataset.testInstance = 'same-book'; });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookScale');
  const scale = page.getByRole('spinbutton', { name: '书册放大比例数值', exact: true });
  await expect(scale).toHaveValue('116');
  await scale.fill('90'); await scale.press('Tab');
  const paper = page.frameLocator('#homeLionBook iframe').locator('#sbBook');
  const displayedPaperWidth = async () => (await paper.boundingBox()).width;
  const smaller = await displayedPaperWidth();
  await scale.fill('130'); await scale.press('Tab');
  await expect.poll(displayedPaperWidth).toBeGreaterThan(smaller * 1.15);
  const height = page.getByRole('spinbutton', { name: '书册展示区高度数值', exact: true });
  await height.fill('900'); await height.press('Tab');
  await expect(stage).toHaveCSS('height', '900px');
  await scale.fill('145'); await scale.press('Tab');
  await height.fill('480'); await height.press('Tab');
  const paperBox = await paper.boundingBox();
  const frameBox = await page.locator('#homeLionBook iframe').boundingBox();
  expect(paperBox.y + paperBox.height * .218).toBeGreaterThanOrEqual(frameBox.y - 2);
  expect(paperBox.y + paperBox.height * .782).toBeLessThanOrEqual(frameBox.y + frameBox.height + 2);
  await expect(page.locator('#homeLionBook iframe')).toHaveAttribute('data-test-instance', 'same-book');
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
});

test('书册下方人物比例可在开发参数中即时调整并适配短窗口', async ({ page }) => {
  await openBook(page);
  const sprite = page.locator('.lion-book-guide-character');
  const platform = page.locator('.lion-book-game-platform').first();
  const footGap = async () => {
    const characterBox = await sprite.boundingBox();
    const platformBox = await platform.boundingBox();
    return characterBox.y + characterBox.height - platformBox.y - platformBox.height;
  };
  await expect(sprite).toHaveCSS('width', '144px');
  const normalFootGap = await footGap();
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookGuideScale');
  const guideScale = page.getByRole('spinbutton', { name: '人物放大比例数值', exact: true });
  await expect(guideScale).toHaveValue('150');
  await guideScale.fill('125'); await guideScale.press('Tab');
  await expect(sprite).toHaveCSS('width', '120px');
  expect(Math.abs(await footGap() - normalFootGap)).toBeLessThan(1);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nanfeng-lion:developer-settings:v1')).bookGuideScale)).toBe(125);
  await page.setViewportSize({ width: 1920, height: 768 });
  await expect(sprite).toHaveCSS('width', '100px');
  const shortFootGap = await footGap();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(Math.abs(await footGap() - shortFootGap)).toBeLessThan(1);
});

test('七个年代台阶水平排列，角色与书页同步且粒子拖尾可以关闭', async ({ page }) => {
  await openBook(page);
  const timeline = page.locator('.lion-book-timeline');
  const sprite = timeline.locator('.lion-book-guide-character');
  const particles = timeline.locator('.lion-book-particles');
  await expect(sprite).toHaveCSS('width', '144px');
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline.locator('button')).toHaveCount(7);
  const geometry = await timeline.evaluate(element => {
    const track = element.querySelector('.lion-book-game-track').getBoundingClientRect();
    const platforms = [...element.querySelectorAll('.lion-book-game-platform')].map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    return { left: track.left, right: track.right, y: track.y + track.height / 2, platforms };
  });
  expect(geometry.platforms).toHaveLength(7);
  for (const [index, platform] of geometry.platforms.entries()) {
    expect(Math.abs(platform.y - geometry.y)).toBeLessThan(1);
    if (index) expect(platform.x).toBeGreaterThan(geometry.platforms[index - 1].x);
  }
  expect(Math.abs(geometry.left - geometry.platforms[0].x)).toBeLessThan(1);
  expect(Math.abs(geometry.right - geometry.platforms.at(-1).x)).toBeLessThan(1);
  await expect(sprite.locator('img')).toHaveAttribute('src', /adam-poster\.png$/);
  await expect(sprite).toHaveAttribute('data-ready', 'true');
  await expect(sprite).toHaveAttribute('data-animation', 'idle');
  await expect(sprite.locator('canvas')).toBeVisible();
  await expect(particles).toHaveCount(1);
  await expect(timeline).toHaveAttribute('data-particles-playing', 'false');
  await timeline.locator('[data-book-page="spread"]').click();
  await expect(sprite).toHaveAttribute('data-animation', 'mov');
  await expect(timeline).toHaveAttribute('data-particles-playing', 'true');
  await expect.poll(() => particles.evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((alpha, index) => index % 4 === 3 && alpha > 0);
  })).toBe(true);
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '4');
  await expect(timeline.locator('[data-book-page="spread"]')).toHaveAttribute('aria-current', 'step');
  await expect.poll(async () => {
    const lion = await sprite.boundingBox();
    const node = await timeline.locator('[data-book-page="spread"] .lion-book-game-platform').boundingBox();
    return Math.abs(lion.x + lion.width / 2 - node.x - node.width / 2);
  }).toBeLessThan(2);
  await expect(sprite).toHaveAttribute('data-animation', 'idle');
  await expect(timeline).toHaveAttribute('data-particles-playing', 'false');
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookInkEnabled');
  await page.getByRole('checkbox', { name: '书册导航粒子拖尾' }).uncheck();
  await expect(timeline).toHaveAttribute('data-particles-enabled', 'false');
  await expect(particles).toHaveCSS('display', 'none');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await timeline.locator('[data-book-page="formation"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '2');
  await expect(timeline.locator('[data-book-page="formation"]')).toHaveAttribute('aria-current', 'step');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(sprite).toHaveAttribute('data-animation', 'poster');
  await expect(sprite).toHaveAttribute('data-playing', 'false');
  await expect(timeline).toHaveAttribute('data-observing', 'false');
  await timeline.locator('[data-book-page="ending"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '6');
  await expect.poll(async () => {
    const lion = await sprite.boundingBox();
    const node = await timeline.locator('[data-book-page="ending"] .lion-book-game-platform').boundingBox();
    return Math.abs(lion.x + lion.width / 2 - node.x - node.width / 2);
  }).toBeLessThan(2);
});

test('短桌面大书册舞台按页码循环且不播放首次快翻', async ({ page }) => {
  await configure(page, { seen: false, height: 650, settings: { bookStageHeight: 960, bookAutoplay: true } });
  await page.goto('/');
  const book = page.locator('.lion-book-experience');
  const frame = page.frameLocator('#homeLionBook iframe');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await expect(page.locator('.lion-book-guide-character')).toHaveCSS('width', '120px');
  await page.mouse.move(10, 150);
  await page.locator('.lion-book-stage').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(book).toHaveAttribute('data-book-playback', 'playing');
  await expect(book).toHaveAttribute('data-book-index', '1');
  expect(await frame.locator('body').evaluate(() => ({ sequence: riffle, running: introOn }))).toEqual({ sequence: null, running: false });
});
