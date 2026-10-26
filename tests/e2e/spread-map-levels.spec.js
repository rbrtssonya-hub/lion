import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
});

test('地图从广东的广州佛山开始，城市选择和实景照片对应', async ({ page }) => {
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', 'guangdong');
  await expect(page.getByRole('tab', { name: '广东', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '选择广州案例', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '选择佛山案例', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '选择新加坡案例', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '选择广州案例', exact: true }).click();
  await expect(page.locator('.spread-photo-caption')).toContainText('广东广州');
  await expect(page.locator('.spread-photo-credit')).toContainText('Zhizhou Deng');
  await page.getByRole('button', { name: '选择佛山案例', exact: true }).click();
  await expect(page.locator('.spread-photo-caption')).toContainText('广东佛山');
  await expect(page.locator('.spread-photo-credit')).toContainText('David Chen');
});

test('逐级从广东到中国到世界，回到广东时恢复可见地点与对应照片', async ({ page }) => {
  await page.getByRole('button', { name: '查看中国范围', exact: true }).click();
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', 'china');
  await page.getByRole('button', { name: '选择香港案例', exact: true }).click();
  await expect(page.locator('.spread-photo-caption')).toContainText('香港九龙公园');
  await page.getByRole('button', { name: '走向世界', exact: true }).click();
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', 'world');
  await expect(page.getByRole('button', { name: '选择香港案例', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '选择新加坡案例', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('新加坡');
  await page.getByRole('tab', { name: '广东', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择佛山案例', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.spread-photo-caption')).toContainText('广东佛山');
});

test('三个范围可用键盘切换，地图标签和章内控制在电脑视口内', async ({ page }) => {
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const guangdong = page.getByRole('tab', { name: '广东', exact: true });
    await guangdong.click();
    await guangdong.focus();
    await guangdong.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '中国', exact: true })).toBeFocused();
    await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', 'china');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: '世界', exact: true })).toBeFocused();
    for (const name of ['广东', '中国', '世界']) {
      await page.getByRole('tab', { name, exact: true }).click();
      const outliers = await page.locator('.spread-map-place').evaluateAll(nodes => nodes.filter(node => {
        const r = node.getBoundingClientRect();
        const frame = node.closest('.spread-world').getBoundingClientRect();
        return r.left < frame.left - 1 || r.right > frame.right + 1 || r.top < frame.top - 1 || r.bottom > frame.bottom + 1;
      }).map(node => node.textContent));
      expect(outliers).toEqual([]);
      await expect(page.locator('.spread-photo-credit')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
