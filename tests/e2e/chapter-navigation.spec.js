import { test, expect } from '@playwright/test';

const chapters = [
  ['intro', '入场'], ['model', '整体'], ['structure', '结构'],
  ['action', '动作'], ['state', '神态'], ['score', '评分'],
];

async function expectCurrentChapter(page, route) {
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
  if (route === 'intro') await page.locator('#introVideo').evaluate((video) => video.pause());
  const navigation = page.locator('.entry-chapter-nav');
  await expect(navigation.locator('.is-current')).toHaveCount(1);
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  const current = navigation.locator(`[data-route="${route}"]`);
  await expect(current).toHaveAttribute('aria-current', 'page');
  await page.mouse.move(0, 0);
  await expect(current).toHaveCSS('color', 'rgb(179, 38, 27)');
  await expect.poll(() => current.evaluate((button) => {
    const color = getComputedStyle(button).color;
    const [red, green, blue] = color.match(/\d+/g).map(Number);
    const underline = getComputedStyle(button, '::after');
    return red > green && red > blue
      && getComputedStyle(button.querySelector('span')).color === color
      && getComputedStyle(button.querySelector('strong')).color === color
      && underline.backgroundColor === color
      && parseFloat(underline.width) > 0 && parseFloat(underline.height) > 0
      && new DOMMatrix(underline.transform).a === 1;
  })).toBe(true);
  await expect.poll(() => navigation.locator('button:not(.is-current)').evaluateAll(buttons =>
    buttons.every(button => getComputedStyle(button).color !== 'rgb(179, 38, 27)'
      && new DOMMatrix(getComputedStyle(button, '::after').transform).a === 0),
  )).toBe(true);
}

test('顶部六章导航与真实页面同步，移开鼠标后保持朱红编号、名称和短线', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  for (const [route] of chapters) {
    await page.locator(`.entry-chapter-nav [data-route="${route}"]`).click();
    await expectCurrentChapter(page, route);
    await page.reload();
    await expectCurrentChapter(page, route);
    await expect(page.getByRole('button', { name: '搜索章节', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开章节菜单', exact: true })).toBeVisible();
  }
});

test('刷新与浏览器前进后退始终按当前Hash章节恢复高亮', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/#/action');
  await expectCurrentChapter(page, 'action');
  for (const route of ['state', 'score']) {
    await page.locator(`.entry-chapter-nav [data-route="${route}"]`).click();
    await expectCurrentChapter(page, route);
  }
  await page.reload();
  await expectCurrentChapter(page, 'score');
  await page.goBack();
  await expectCurrentChapter(page, 'state');
  await page.goBack();
  await expectCurrentChapter(page, 'action');
  await page.goForward();
  await expectCurrentChapter(page, 'state');
  await page.goForward();
  await expectCurrentChapter(page, 'score');
});

test('章节页搜索可跳转，移动端目录始终只有当前章节高亮', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/structure');
  await page.getByRole('button', { name: '搜索章节', exact: true }).click();
  const search = page.getByRole('dialog', { name: '搜索章节' });
  await search.getByRole('searchbox', { name: '搜索章节' }).fill('动作');
  await search.getByRole('button', { name: /04.*动作/ }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'action');

  for (const [route] of chapters) {
    await page.getByRole('button', { name: '打开章节菜单', exact: true }).click();
    const menu = page.getByRole('dialog', { name: '章节目录' });
    const before = await page.locator('#react-app').getAttribute('data-route');
    await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(menu.locator(`[data-route="${before}"]`)).toHaveAttribute('aria-current', 'page');
    await menu.locator(`[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    if (route === 'intro') await page.locator('#introVideo').evaluate((video) => video.pause());
    await page.getByRole('button', { name: '打开章节菜单', exact: true }).click();
    await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(menu.locator(`[data-route="${route}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(menu.locator('.is-current')).toHaveCount(1);
    await expect.poll(() => menu.locator('.is-current').evaluate((button) => {
      const color = getComputedStyle(button).color;
      return getComputedStyle(button.querySelector('span')).color === color
        && getComputedStyle(button.querySelector('strong')).color === color;
    })).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
