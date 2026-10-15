import { test, expect } from '@playwright/test';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const introKey = 'nanfeng-lion:book-intro-seen:v1';

async function configure(page, { seen = true, height = 1080, settings = {} } = {}) {
  await page.setViewportSize({ width: 1920, height });
  await page.addInitScript(({ settingsKey, introKey, seen, settings }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (seen) sessionStorage.setItem(introKey, '1');
    localStorage.setItem(settingsKey, JSON.stringify({ pushPage: false, bookIntroDuration: 3, ...settings }));
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
  await page.getByRole('tab', { name: '动画', exact: true }).click();
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

test('七个年代沿波浪排列，狮头与书页同步并产生可关闭的水墨拖尾', async ({ page }) => {
  await openBook(page);
  const timeline = page.locator('.lion-book-timeline');
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline.locator('button')).toHaveCount(7);
  expect(await timeline.locator('.lion-book-wave-line').getAttribute('d')).toContain(' C ');
  const levels = await timeline.locator('button').evaluateAll(buttons => [...new Set(buttons.map(button => button.style.top))]);
  expect(levels.length).toBeGreaterThanOrEqual(3);
  await expect(timeline).toHaveAttribute('data-ink-playing', 'true');
  await expect(timeline.locator('.lion-book-ink-flow')).toHaveCSS('animation-name', 'lion-book-ink-stream');
  await timeline.locator('[data-book-page="spread"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '4');
  await expect(timeline.locator('[data-book-page="spread"]')).toHaveAttribute('aria-current', 'step');
  await expect(timeline.locator('.lion-book-ink-trail')).toHaveCount(1);
  await expect.poll(async () => {
    const lion = await timeline.locator('.lion-book-traveling-lion').boundingBox();
    const node = await timeline.locator('[data-book-page="spread"] .lion-book-node').boundingBox();
    return Math.abs(lion.x + lion.width / 2 - node.x - node.width / 2);
  }).toBeLessThan(2);
  await page.locator('.site-header [data-action="settings"]').click();
  await page.getByRole('tab', { name: '动画', exact: true }).click();
  await page.getByRole('checkbox', { name: '书册导航持续水墨动效' }).uncheck();
  await expect(timeline).toHaveAttribute('data-ink-enabled', 'false');
  await expect(timeline.locator('.lion-book-ink-flow')).toHaveCSS('display', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await timeline.locator('.lion-book-traveling-lion').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThanOrEqual(.001);
});

test('加载遮罩期间书册已预热且不消费首翻资格，短桌面大舞台可启动首翻', async ({ page }) => {
  await configure(page, { seen: false, height: 650, settings: { bookStageHeight: 960 } });
  let releaseModel;
  const modelGate = new Promise(resolve => { releaseModel = resolve; });
  await page.route('**/assets/models/lion-overall.glb', async route => { await modelGate; await route.continue(); });
  try {
    await page.goto('/');
    const book = page.locator('.lion-book-experience');
    await expect(book).toHaveAttribute('data-book-ready', 'true');
    await page.locator('.lion-book-stage').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(page.locator('#startupLoading')).toHaveCount(1);
    await expect(book).toHaveAttribute('data-book-intro', 'pending');
    expect(await page.evaluate(key => sessionStorage.getItem(key), introKey)).toBeNull();
    releaseModel();
    await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
    await expect(book).toHaveAttribute('data-book-intro', 'playing');
    expect(await page.evaluate(key => sessionStorage.getItem(key), introKey)).toBe('1');
    await expect(book).toHaveAttribute('data-book-intro', 'done');
  } finally { releaseModel(); }
});
