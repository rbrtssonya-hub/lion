import { test, expect } from '@playwright/test';

test('桌面首页的顶部和底部入口进入各自章节', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const [route, label] of [['entry', '入场'], ['model', '整体'], ['action', '动作'], ['state', '神态']]) {
    await page.goto('/');
    await expect(page.locator('.entry-chapter-nav .entry-nav-item')).toHaveCount(4);
    await expect(page.locator('.entry-bottom-nav .entry-bottom-item')).toHaveCount(3);
    await expect(page.locator('.entry-chapter-nav')).not.toContainText('评分');
    await expect(page.locator('.entry-bottom-nav')).not.toContainText('评分');
    await page.locator('.entry-chapter-nav').getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('.entry-chapter-nav [data-route="intro"], .entry-chapter-nav [data-route="structure"]')).toHaveCount(0);
    if (route !== 'entry') {
      await page.goto('/');
      await page.locator('.entry-bottom-nav').getByRole('button', { name: new RegExp(label) }).click();
      await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    }
  }
});

test('首页搜索筛选章节，空结果可恢复，选择后进入对应章节', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '搜索章节', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '搜索章节' });
  const query = dialog.getByRole('searchbox', { name: '搜索章节' });
  await expect(query).toBeFocused();
  await query.fill('神');
  await expect(dialog.getByRole('button', { name: /04.*神态/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /02.*整体/ })).toHaveCount(0);
  await query.fill('评分');
  await expect(dialog.getByRole('status')).toContainText('没有匹配');
  await expect(dialog.locator('.entry-dialog-chapters button')).toHaveCount(0);
  await query.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await query.fill('不存在的章节');
  await expect(dialog.getByRole('status')).toContainText('没有匹配');
  await query.fill('神态');
  await query.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
});

test('手机菜单支持四章跳转和键盘关闭，三个底部入口可见且不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: '打开章节菜单', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog', { name: '章节目录' });
  await expect(dialog.getByRole('button', { name: /01.*入场/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /04.*神态/ })).toBeVisible();
  await expect(dialog.locator('.entry-dialog-chapters button')).toHaveCount(4);
  await expect(dialog.getByRole('button', { name: /评分/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /\d+.*结构/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await expect(page.locator('.entry-bottom-item')).toHaveCount(3);
  for (const item of await page.locator('.entry-bottom-item').all()) await expect(item).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await menu.click();
  await dialog.getByRole('button', { name: /03.*动作/ }).click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
});

test('所有页面将小号狮头放在品牌文字左侧，导航内不重复放置图片', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const route of ['entry', 'model', 'action', 'state']) {
    await page.goto(`/#/${route}`);
    const brand = page.locator('.site-brand');
    const lion = brand.locator('.entry-lion-emblem');
    await expect(brand.locator('.site-brand-name')).toHaveText('南风有狮');
    await expect(lion).toBeVisible();
    await expect(lion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
    expect(await lion.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    const placement = await brand.evaluate((element) => {
      const image = element.querySelector('img').getBoundingClientRect();
      const name = element.querySelector('.site-brand-name').getBoundingClientRect();
      return { imageRight: image.right, nameLeft: name.left, width: image.width, height: image.height, brandLeft: element.getBoundingClientRect().left };
    });
    expect(placement.imageRight).toBeLessThanOrEqual(placement.nameLeft);
    expect(placement.width).toBeLessThanOrEqual(72);
    expect(placement.height).toBeLessThanOrEqual(72);
    expect(placement.brandLeft).toBeLessThan(1920 * 0.2);
    await expect(page.locator('.entry-nav-ribbon img')).toHaveCount(0);
    await expect(page.locator('.entry-lion-emblem')).toHaveCount(1);
  }
});
