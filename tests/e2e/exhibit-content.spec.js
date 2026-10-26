import { test, expect } from '@playwright/test';

const desktops = [[1920, 1080], [1440, 900], [1366, 768]];

async function openPanel(page, id) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      bookAutoplay: false, carouselAutoplay: false, hdriEnabled: false,
    }));
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
  await page.locator('#enterWork').click();
  await page.locator(`.home-archive-nav [data-home-section="${id}"]`).click();
  await expect(page.locator(`#${id}`)).toBeVisible();
}

async function expectOneScreen(page, selector) {
  const dimensions = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, header: header.bottom,
      width: element.clientWidth, contentWidth: element.scrollWidth };
  });
  expect(dimensions.top).toBeGreaterThanOrEqual(dimensions.header - 1);
  expect(dimensions.bottom).toBeLessThanOrEqual(await page.evaluate(() => innerHeight + 1));
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width + 1);
}

test('文化照片给出真实换图提示，图文署名在三种电脑窗口完整呈现', async ({ page }, testInfo) => {
  await openPanel(page, 'homeCulture');
  const change = page.getByRole('button', { name: '点击照片，换一幅风土', exact: true });
  await expect(change).toBeVisible();
  await change.click();
  await expect(page.locator('#homeCulture')).toHaveAttribute('data-culture-index', '1');
  await expect(page.locator('.home-culture-slide.is-active')).toContainText('Zhizhou Deng');
  for (const [width, height] of desktops) {
    await page.setViewportSize({ width, height });
    await expectOneScreen(page, '#homeCulture');
    for (const selector of ['.home-culture-intro h2', '.home-culture-slide.is-active .home-culture-title', '.home-culture-slide.is-active figcaption', '.home-culture-slide.is-active .home-culture-note']) {
      await expect(page.locator(selector)).toBeInViewport();
    }
    await page.screenshot({ path: testInfo.outputPath(`culture-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.culture-depth-gallery')).toHaveAttribute('data-depth-state', 'ready');
  await change.click();
  await expect(page.locator('#homeCulture')).toHaveAttribute('data-culture-index', '2');
  await expect(page.locator('.home-culture-slide.is-active')).toContainText('Kurt Bauschardt');
  let previousFrame;
  await expect.poll(async () => {
    const frame = await page.locator('.culture-depth-gallery canvas').screenshot();
    const settled = previousFrame?.equals(frame) ?? false;
    previousFrame = frame;
    return settled;
  }, { timeout: 6000, intervals: [150] }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('culture-depth-1366.png') });
});

test('狮种基础介绍直接可读，点击图片进入有不同内容的形制对照', async ({ page }, testInfo) => {
  await openPanel(page, 'homeLionTypes');
  const types = page.locator('#homeLionTypes');
  await expect(types.locator('.heritage-summary')).toBeVisible();
  await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
  for (const [width, height] of desktops) {
    await page.setViewportSize({ width, height });
    await expectOneScreen(page, '#homeLionTypes');
    await expect(types.locator('.heritage-summary')).toBeInViewport();
    for (const point of await types.locator('.heritage-observations p').all()) await expect(point).toBeInViewport({ ratio: 1 });
    await expect(types.getByRole('heading', { name: '传统地狮', exact: true })).toBeInViewport();
    const arrangement = await types.evaluate(section => {
      const bottom = selector => section.querySelector(selector).getBoundingClientRect().bottom;
      return { image: bottom('.heritage-figure'), copy: bottom('.heritage-copy'),
        footer: section.querySelector('.heritage-form-note').getBoundingClientRect().top };
    });
    expect(arrangement.image, JSON.stringify(arrangement)).toBeLessThanOrEqual(arrangement.footer + 1);
    expect(arrangement.copy, JSON.stringify(arrangement)).toBeLessThanOrEqual(arrangement.footer + 1);
    await page.screenshot({ path: testInfo.outputPath(`types-${width}.png`) });
  }
  await types.getByRole('button', { name: '对照佛山狮形制', exact: true }).click();
  await expect(types).toHaveAttribute('data-reading-mode', 'compare');
  await expect(types.locator('.heritage-comparison-card')).toHaveCount(2);
  await expect(types.getByRole('heading', { name: '佛山狮', exact: true })).toBeVisible();
  await expect(types.getByRole('heading', { name: '鹤山狮', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(types.locator('.heritage-summary')).toBeVisible();
});

test('来源与许可保持展开且资料只在内栏滚动，不拉长外页', async ({ page }, testInfo) => {
  await openPanel(page, 'homeCultureSources');
  const sources = page.locator('#homeCultureSources');
  await expect(sources.locator('details')).toHaveCount(0);
  await expect(sources.locator('.home-culture-source-card')).toHaveCount(3);
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
  await expect(sources.getByRole('link', { name: 'Sketchbook · ThreeUI / MIT', exact: true })).toHaveAttribute('href', /LICENSE/);
  for (const [width, height] of desktops) {
    await page.setViewportSize({ width, height });
    await expectOneScreen(page, '#homeCultureSources');
    await page.screenshot({ path: testInfo.outputPath(`sources-${width}.png`) });
  }
  const before = await page.evaluate(() => scrollY);
  await sources.getByRole('link', { name: '字体许可', exact: true }).scrollIntoViewIfNeeded();
  await expect(sources.getByRole('link', { name: '字体许可', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
});
