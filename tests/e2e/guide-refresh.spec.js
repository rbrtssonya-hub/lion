import { test, expect } from '@playwright/test';

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
  await page.getByRole('tab', { name: '外观', exact: true }).click();
  const input = page.getByRole('spinbutton', { name: '书册标题底板宽度数值', exact: true });
  await expect(input).toHaveValue('69');
  await input.fill('100'); await input.press('Tab');
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35000 });
  await expect.poll(ratio).toBeCloseTo(1, 2);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).headerTransparency, key)).toBe(37);
  await page.locator('.site-header [data-action="settings"]').click();
  await page.getByRole('tab', { name: '外观', exact: true }).click();
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(input).toHaveValue('69');
});

test('书册七节点同高，狮头行进时出现离散粒子，停下后自然清空', async ({ page }) => {
  await open(page);
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  const levels = await nav.locator('button .lion-book-node').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().top));
  expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1);
  await expect(nav.locator('filter, .lion-book-ink-trail, .lion-book-ink-wash')).toHaveCount(0);
  expect(await nav.evaluate(el => Number(getComputedStyle(el.querySelector('.lion-book-traveling-lion')).zIndex)
    > Math.max(...[...el.querySelectorAll('button')].map(button => Number(getComputedStyle(button).zIndex))))).toBe(true);
  await nav.locator('[data-book-page="ending"]').click();
  await expect.poll(() => nav.locator('canvas').evaluate(el => {
    const data = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
    return data.some((v, i) => i % 4 === 3 && v > 0);
  })).toBe(true);
  await expect.poll(() => nav.evaluate(el => {
    const a = el.querySelector('.lion-book-traveling-lion').getBoundingClientRect();
    const b = el.querySelector('[aria-current] .lion-book-node').getBoundingClientRect();
    return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
  })).toBeLessThan(2);
  await expect.poll(() => nav.locator('canvas').evaluate(el => el.getContext('2d').getImageData(0, 0, el.width, el.height).data.every((v, i) => i % 4 !== 3 || v === 0))).toBe(true);
});

test('动作唯一游戏导览使用包内角色，选择仍联动四段且减少动态时静态定位', async ({ page }) => {
  await open(page, '/#/action');
  const nav = page.locator('.action-timeline');
  await nav.scrollIntoViewIfNeeded();
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute('data-skin', 'game');
  await expect(nav.getByRole('button')).toHaveText(['入场', '探步', '转身', '收势']);
  const character = nav.locator('.action-guide-character');
  await expect(character).toHaveAttribute('data-ready', 'true');
  expect(await character.locator('canvas').evaluate(el => el.getContext('2d').getImageData(0, 0, 256, 256).data.some((v, i) => i % 4 === 3 && v > 0))).toBe(true);
  await nav.getByRole('button', { name: '转身', exact: true }).click();
  await expect(page.locator('#actionHero [data-action-count]')).toHaveText('03 / 04');
  await expect.poll(() => nav.evaluate(el => {
    const a = el.querySelector('.action-guide-character').getBoundingClientRect();
    const b = el.querySelector('[aria-pressed="true"]').getBoundingClientRect();
    return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
  })).toBeLessThan(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await nav.getByRole('button', { name: '收势', exact: true }).click();
  await expect(page.locator('#actionHero [data-action-count]')).toHaveText('04 / 04');
  await expect(character).toHaveAttribute('data-animation', 'poster');
  await expect(page).toHaveURL(/#\/action$/);
});

test('角色图集加载失败时显示静态角色且四站目录仍能使用', async ({ page }) => {
  await page.route('**/assets/action-guide/adam-idle.png', route => route.abort());
  await open(page, '/#/action');
  const nav = page.locator('.action-timeline');
  await nav.scrollIntoViewIfNeeded();
  const character = nav.locator('.action-guide-character');
  await expect(character).toHaveAttribute('data-ready', 'false');
  await expect(character.locator('img')).toBeVisible();
  expect(await character.locator('img').evaluate(img => img.complete && img.naturalWidth === 256)).toBe(true);
  await nav.getByRole('button', { name: '探步', exact: true }).click();
  await expect(page.locator('#actionHero [data-action-count]')).toHaveText('02 / 04');
  await expect(page.locator('#action-clip-probe .action-media-status')).toContainText('视频待接入');
  await expect(page).toHaveURL(/#\/action$/);
});

test('游戏角色真实离屏与受控失焦时暂停，恢复后续播，快速选择保持最终状态', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await open(page, '/#/action');
  const nav = page.locator('.action-timeline'), character = nav.locator('.action-guide-character');
  await nav.scrollIntoViewIfNeeded();
  await expect(character).toHaveAttribute('data-playing', 'true');
  // Headless Chrome can leave both tabs focused; inject the browser-state
  // boundary explicitly, then assert the real Canvas stops changing.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    window.dispatchEvent(new Event('blur'));
  });
  await expect(character).toHaveAttribute('data-playing', 'false');
  const paused = await character.locator('canvas').evaluate(el => el.toDataURL());
  await page.waitForTimeout(160);
  expect(await character.locator('canvas').evaluate(el => el.toDataURL())).toBe(paused);
  await page.evaluate(() => { delete document.hasFocus; window.dispatchEvent(new Event('focus')); });
  await expect(character).toHaveAttribute('data-playing', 'true');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(character).toHaveAttribute('data-playing', 'false');
  await nav.scrollIntoViewIfNeeded();
  await nav.getByRole('button', { name: '收势', exact: true }).click();
  await nav.getByRole('button', { name: '转身', exact: true }).evaluate(el => el.click());
  await expect(page.locator('#actionHero [data-action-count]')).toHaveText('03 / 04');
  await expect(nav.getByRole('button', { name: '转身', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.site-header [data-route="state"]').click();
  await expect(character).toHaveCount(0);
  expect(errors).toEqual([]);
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
