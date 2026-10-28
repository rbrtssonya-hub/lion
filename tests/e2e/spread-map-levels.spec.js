import { test, expect } from '@playwright/test';

test.use({ trace: 'off' });
test.setTimeout(120_000);

const collections = [
  { id: 'guangdong', name: '广东', cities: ['佛山', '广州', '鹤山', '遂溪'], stamps: ['foshan', 'guangzhou', 'heshan', 'suixi'] },
  { id: 'china', name: '中国', cities: ['北京', '田阳', '泉州', '香港'], stamps: ['beijing', 'tianyang', 'quanzhou', 'hongkong'] },
  { id: 'world', name: '世界', cities: ['新加坡', '吉隆坡', '旧金山', '伦敦'], stamps: ['singapore', 'kualalumpur', 'sanfrancisco', 'london'] },
];
const board = page => page.locator('#spreadPlaceCard.spread-stamp-board');
const stamp = (page, id) => board(page).locator(`.spread-stamp-hit[data-stamp="${id}"]`);

async function expectCollection(page, collection) {
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', collection.id);
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', /idle|failed/);
  await expect(board(page)).toHaveAttribute('data-stamp-level', collection.id);
  await expect(page.locator('.spread-map-place')).toHaveCount(4);
  await expect.poll(() => board(page).locator('.spread-stamp-hit:visible').evaluateAll(nodes => nodes.map(node => node.dataset.stamp)))
    .toEqual(collection.stamps);
  for (const city of collection.cities) await expect(page.getByRole('button', { name: `选择${city}邮票`, exact: true })).toBeVisible();
  await expect(board(page).locator('.spread-stamp-note')).toContainText('AI辅助艺术邮票');
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 65_000 });
});

test('广东层的四个地图城市与四枚地域邮票对应，右栏只保留邮票', async ({ page }) => {
  await expectCollection(page, collections[0]);
  await expect(page.getByRole('tab', { name: '广东', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '选择佛山邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '选择新加坡邮票', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '选择广州邮票', exact: true }).click();
  await expect(stamp(page, 'guangzhou')).toHaveAttribute('data-map-selected', 'true');
  await expect(stamp(page, 'foshan')).toHaveAttribute('data-map-selected', 'false');
  await page.getByRole('button', { name: '选择佛山邮票', exact: true }).click();
  await expect(stamp(page, 'foshan')).toHaveAttribute('data-map-selected', 'true');
  await expect(page.locator('.spread-photo, .spread-photo-caption, .spread-photo-credit, .spread-photo-controls, .spread-case-reading, #spreadPlaceTitle')).toHaveCount(0);
});

test('逐级切换广东、中国、世界时只展示对应四枚邮票，并恢复组内选中城市', async ({ page }) => {
  await page.getByRole('button', { name: '查看中国范围', exact: true }).click();
  await expectCollection(page, collections[1]);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(stamp(page, 'hongkong')).toHaveAttribute('data-map-selected', 'true');
  await page.getByRole('button', { name: '走向世界', exact: true }).click();
  await expectCollection(page, collections[2]);
  await expect(page.getByRole('button', { name: '选择香港邮票', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '选择新加坡邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(stamp(page, 'singapore')).toHaveAttribute('data-map-selected', 'true');
  await page.getByRole('button', { name: '选择伦敦邮票', exact: true }).click();
  await expect(stamp(page, 'london')).toHaveAttribute('data-map-selected', 'true');
  await page.getByRole('tab', { name: '广东', exact: true }).click();
  await expectCollection(page, collections[0]);
  await expect(page.getByRole('button', { name: '选择佛山邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(stamp(page, 'foshan')).toHaveAttribute('data-map-selected', 'true');
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
    for (const collection of collections) {
      await page.getByRole('tab', { name: collection.name, exact: true }).click();
      await expectCollection(page, collection);
      const outliers = await page.locator('.spread-map-place').evaluateAll(nodes => nodes.filter(node => {
        const r = node.getBoundingClientRect();
        const frame = node.closest('.spread-world').getBoundingClientRect();
        return r.left < frame.left - 1 || r.right > frame.right + 1 || r.top < frame.top - 1 || r.bottom > frame.bottom + 1;
      }).map(node => node.textContent));
      expect(outliers).toEqual([]);
      await expect(page.locator('#spreadPlaceCard')).toBeInViewport();
      await expect.poll(() => board(page).evaluate(root => {
        const frame = root.getBoundingClientRect();
        return [...root.querySelectorAll('.spread-stamp-hit:not([hidden])')].every(node => {
          const bounds = node.getBoundingClientRect();
          return bounds.width > 65 && bounds.height > 65 && bounds.left >= frame.left - 1 && bounds.right <= frame.right + 1
            && bounds.top >= frame.top - 1 && bounds.bottom <= frame.bottom + 1;
        });
      }), { message: '四张邮票完整容纳在电脑右栏内' }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('小醒进入传章后避让地图和邮票区域，键盘仍可聚焦和返回', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('nanfeng-xiaoxing-position-v1', JSON.stringify({ x: 1100, y: 450, width: 1366, height: 768 })));
  await page.reload();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 65_000 });
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await expectCollection(page, collections[2]);
  await page.getByRole('button', { name: '选择新加坡邮票', exact: true }).click();
  const overlaps = await page.evaluate(() => {
    const pet = document.querySelector('.xiaoxing-pet').getBoundingClientRect();
    const targets = [...document.querySelectorAll('#spreadStage button, #spreadStage a, #spreadPlaceCard')];
    return targets.filter(target => {
      const box = target.getBoundingClientRect();
      return Math.min(pet.right, box.right) - Math.max(pet.left, box.left) > 2 && Math.min(pet.bottom, box.bottom) - Math.max(pet.top, box.top) > 2;
    }).map(target => target.getAttribute('aria-label') || target.id || target.className);
  });
  expect(overlaps).toEqual([]);
  await stamp(page, 'singapore').focus();
  await page.keyboard.press('Enter');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await expect(stamp(page, 'singapore')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await expect(stamp(page, 'singapore')).toBeFocused();
});
