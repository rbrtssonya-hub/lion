import { test, expect } from '@playwright/test';

async function open(page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => { if (window === top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.goto('/');
  await expect(page.locator('#enterWork')).toBeVisible();
  await page.locator('.site-header').evaluate(async () => { await document.fonts.ready; });
}

for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  test(`首页滚动进入、侧栏四个一屏、向上回首页 ${width}`, async ({ page }) => {
    await open(page, width, height);
    await expect(page.locator('.home-archive-nav')).toBeHidden();
    await page.mouse.move(width * .6, height * .65);
    await page.mouse.wheel(0, 650);
    const nav = page.getByRole('navigation', { name: '首页章节导航' });
    await expect(nav).toBeVisible();
    const panels = page.locator('.home-archive-panel');
    await expect(panels).toHaveCount(4);
    for (const id of ['homeLionBook', 'homeCulture', 'homeLionTypes', 'homeCultureSources']) {
      await nav.locator(`[data-home-section="${id}"]`).click();
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(panels.filter({ visible: true })).toHaveCount(1);
      await expect.poll(() => page.locator(`#${id}`).evaluate(el => {
        const rect = el.closest('.home-archive-panel').getBoundingClientRect();
        return Math.abs(rect.top - document.querySelector('.site-header').getBoundingClientRect().bottom) < 3 && rect.bottom <= innerHeight + 2;
      })).toBe(true);
      const before = await page.evaluate(() => scrollY);
      // Stay inside the document; the reserved browser scrollbar gutter is
      // outside the exhibit and does not dispatch its content wheel handler.
      await page.mouse.move(width - 40, height * .5);
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(250);
      expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2);
      await expect(nav.locator(`[data-home-section="${id}"]`)).toHaveAttribute('aria-current', 'location');
    }
    await page.mouse.wheel(0, -650);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
    await expect(nav).toBeHidden();
    await page.locator('#enterWork').click();
    await expect(nav).toBeVisible();
    await expect(page.locator('#homeLionBook')).toBeVisible();
  });
}

test('所有章节Logo保留左侧，侧栏和操作提示可辨识并尊重减少动态', async ({ page }) => {
  await open(page);
  for (const route of ['model', 'action', 'state', 'entry']) {
    await page.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
    const geometry = await page.locator('.site-header').evaluate(el => {
      const brand = el.querySelector('.site-brand-capsule').getBoundingClientRect();
      const header = el.getBoundingClientRect();
      return { gap: brand.left - header.left, shadow: getComputedStyle(el.querySelector('.navigation-surface')).boxShadow };
    });
    expect(geometry.gap).toBeLessThan(110);
    expect(geometry.shadow).not.toBe('none');
  }
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-nav')).toBeVisible();
  expect(await page.locator('.home-archive-nav').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.locator('[data-route="state"]').click();
  const hint = page.locator('#expressionInteractionHint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveClass(/interaction-cue/);
  const controls = await page.locator('#expressionObservation').evaluate(el => ({ hint: el.querySelector('#expressionInteractionHint').getBoundingClientRect().toJSON(), next: el.querySelector('#expressionNext').getBoundingClientRect().toJSON() }));
  expect(controls.hint.top).toBeGreaterThanOrEqual(controls.next.bottom + 5);
  expect(controls.hint.bottom).toBeLessThanOrEqual(900);
  const style = await hint.evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, animation: getComputedStyle(el).animationName }));
  expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.animation).not.toBe('none');
  const red = await page.locator('.expression-active-badge').evaluate(el => ({ left: el.getBoundingClientRect().left, offset: getComputedStyle(el, '::before').left, shadow: getComputedStyle(el, '::before').boxShadow }));
  expect(Number.parseFloat(red.offset)).toBeLessThan(-red.left + 2);
  expect(red.shadow).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => hint.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('BODY键盘翻页完整到书页，缩放和侧栏切换保持一屏及暂停隐藏画册', async ({ page }) => {
  await open(page);
  await page.keyboard.press('PageDown');
  const nav = page.locator('.home-archive-nav');
  await expect(nav).toBeVisible();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await nav.locator('[data-home-section="homeCulture"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-playback', 'hidden');
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(() => page.locator('#homeCulture').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom))).toBeLessThan(3);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => page.locator('#homeCulture').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom))).toBeLessThan(3);
  await page.locator('body').evaluate(el => el.focus());
  await page.keyboard.press('PageUp');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
});

test('资料列键盘只滚本列，页面保持在资料展板', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator('#enterWork').click();
  await page.locator('[data-home-section="homeCultureSources"]').click();
  const column = page.locator('.exhibit-licenses');
  await column.evaluate(el => { el.scrollTop = 300; el.focus(); });
  await expect.poll(() => column.evaluate(el => el.scrollTop)).toBeGreaterThan(250);
  const outer = await page.evaluate(() => scrollY);
  await page.keyboard.press('PageUp');
  await expect.poll(() => column.evaluate(el => el.scrollTop)).toBeLessThan(250);
  expect(Math.abs(await page.evaluate(() => scrollY) - outer)).toBeLessThan(2);
  await page.keyboard.press('PageDown');
  await expect.poll(() => column.evaluate(el => el.scrollTop)).toBeGreaterThan(250);
  expect(Math.abs(await page.evaluate(() => scrollY) - outer)).toBeLessThan(2);
});

test('离开展板再点Logo返回首页，不重放旧展板滚动意图', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator('#enterWork').click();
  await page.locator('[data-home-section="homeCultureSources"]').click();
  await page.locator('[data-route="model"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(2);
  await expect(page.locator('.home-archive-nav')).toBeHidden();
});

test('鼠标在顶部导航时也完整进入展板和返回首页，不留半屏', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.mouse.move(720, 30);
  await page.mouse.wheel(0, 300);
  await expect(page.locator('.home-archive-nav')).toBeVisible({ timeout: 3000 });
  await expect.poll(() => page.locator('.home-exhibit').evaluate(el => Math.abs(el.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom))).toBeLessThan(3);
  await page.mouse.wheel(0, -100);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await page.locator('.site-header [data-route="entry"]').focus();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.home-archive-nav')).toBeVisible();
  await page.keyboard.press('PageUp');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
});
