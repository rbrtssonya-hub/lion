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

const collections = [
  { level: '广东', cities: ['佛山', '广州', '鹤山', '遂溪'] },
  { level: '中国', cities: ['北京', '田阳', '泉州', '香港'] },
  { level: '世界', cities: ['新加坡', '吉隆坡', '旧金山', '伦敦'] },
];

test('三个地图层级各显示对应四枚编号邮票城市标识', async ({ page }) => {
  for (const [collectionIndex, collection] of collections.entries()) {
    await page.getByRole('tab', { name: collection.level, exact: true }).click();
    const stamps = page.locator('.spread-map-place');
    await expect(stamps).toHaveCount(4);

    for (const [cityIndex, city] of collection.cities.entries()) {
      const stamp = page.getByRole('button', { name: `选择${city}邮票`, exact: true });
      await expect(stamp).toBeVisible();
      await expect(stamp.locator('.spread-map-place-serial')).toHaveText(String(collectionIndex * 4 + cityIndex + 1).padStart(2, '0'));
      await expect(stamp.locator('.spread-map-place-name')).toHaveText(city);
    }
  }
});

test('地图选中城市后对应地域艺术邮票高亮，旧资料占位不再出现', async ({ page }) => {
  const stamp = page.getByRole('button', { name: '选择鹤山邮票', exact: true });
  await stamp.click();
  await expect(stamp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'heshan');
  await expect(page.locator('.spread-stamp-note')).toContainText('AI辅助艺术邮票');
  await expect(page.locator('.spread-empty, .spread-case, .spread-photo')).toHaveCount(0);
});
