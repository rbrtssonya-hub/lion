import { test, expect } from '@playwright/test';

test('桌面首页的顶部和底部入口进入各自章节', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const [route, label] of [['intro', '入场'], ['model', '整体'], ['structure', '结构'], ['action', '动作'], ['state', '神态']]) {
    await page.goto('/');
    await expect(page.locator('.entry-chapter-nav .entry-nav-item')).toHaveCount(5);
    await expect(page.locator('.entry-bottom-nav .entry-bottom-item')).toHaveCount(4);
    await expect(page.locator('.entry-chapter-nav')).not.toContainText('评分');
    await expect(page.locator('.entry-bottom-nav')).not.toContainText('评分');
    await page.locator('.entry-chapter-nav').getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    if (route !== 'intro') {
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
  await expect(dialog.getByRole('button', { name: /05.*神态/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /03.*结构/ })).toHaveCount(0);
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

test('手机菜单支持五章跳转和键盘关闭，四个底部入口可见且不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: '打开章节菜单', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog', { name: '章节目录' });
  await expect(dialog.getByRole('button', { name: /01.*入场/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /05.*神态/ })).toBeVisible();
  await expect(dialog.locator('.entry-dialog-chapters button')).toHaveCount(5);
  await expect(dialog.getByRole('button', { name: /评分/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await expect(page.locator('.entry-bottom-item')).toHaveCount(4);
  for (const item of await page.locator('.entry-bottom-item').all()) await expect(item).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await menu.click();
  await dialog.getByRole('button', { name: /04.*动作/ }).click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
});
