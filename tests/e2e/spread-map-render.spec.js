import { test, expect } from '@playwright/test';

const levels = [
  { name: '广东', asset: 'guangdong' },
  { name: '中国', asset: 'china' },
  { name: '世界', asset: 'world' },
];

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

async function inspectRenderedMap(page, level) {
  const image = page.locator('.spread-map-render');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', new RegExp(level.asset, 'i'));
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)).toBe(true);
  return image.evaluate(img => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    let visible = 0;
    let signature = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]) visible++;
      for (let j = 0; j < 4; j++) signature = Math.imul(signature ^ pixels[i + j], 16777619) >>> 0;
    }
    const bounds = img.getBoundingClientRect();
    const frame = img.closest('.spread-world').getBoundingClientRect();
    return { visible, signature, bounds: { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }, frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom } };
  });
}

test('三个地图镜头均加载可见的不同画面并适配视口', async ({ page }) => {
  const signatures = [];
  for (const level of levels) {
    await page.getByRole('tab', { name: level.name, exact: true }).click();
    const result = await inspectRenderedMap(page, level);
    expect(result.visible).toBeGreaterThan(100);
    expect(result.bounds.width).toBeGreaterThan(250);
    expect(result.bounds.height).toBeGreaterThan(100);
    expect(result.bounds.left).toBeGreaterThanOrEqual(result.frame.left - 1);
    expect(result.bounds.right).toBeLessThanOrEqual(result.frame.right + 1);
    expect(result.bounds.top).toBeGreaterThanOrEqual(result.frame.top - 1);
    expect(result.bounds.bottom).toBeLessThanOrEqual(result.frame.bottom + 1);
    signatures.push(result.signature);
  }
  expect(new Set(signatures).size).toBe(3);
});

test('快速切换镜头后画面、选中层级和案例保持一致', async ({ page }) => {
  await page.evaluate(() => {
    for (const id of ['china', 'world', 'guangdong', 'world', 'china']) {
      document.getElementById(`spread-level-${id}`).click();
    }
  });
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', 'china');
  await expect(page.getByRole('tab', { name: '中国', exact: true })).toHaveAttribute('aria-selected', 'true');
  await inspectRenderedMap(page, levels[1]);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'hong-kong');
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await inspectRenderedMap(page, levels[2]);
  await expect(page.getByRole('button', { name: '选择新加坡邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('地图画面载入失败时保留案例操作，切到其他镜头可恢复显示', async ({ page }) => {
  await page.route('**/guangdong.png', route => route.abort());
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '地图画面暂未载入' })).toBeVisible();
  await page.getByRole('button', { name: '选择广州邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-stamp="guangzhou"]')).toHaveAttribute('data-map-selected', 'true');
  await page.getByRole('tab', { name: '中国', exact: true }).click();
  await inspectRenderedMap(page, levels[1]);
  await expect(page.getByText('地图画面暂未载入')).toHaveCount(0);
});

test('十二个城市圆点在对应层级显示并落在校准锚点', async ({ page }) => {
  const expectedByLevel = [
    { name: '广东', points: [[468, 323], [505, 293], [455, 344], [222, 458]] },
    { name: '中国', points: [[628, 198], [532, 368], [662, 357], [612, 382]] },
    { name: '世界', points: [[755, 314], [749, 310], [200, 225], [500, 191]] },
  ];

  for (const { name, points } of expectedByLevel) {
    await page.getByRole('tab', { name, exact: true }).click();
    const actual = await page.locator('.spread-pin-dot').evaluateAll(dots => dots.map(dot => [
      Number(dot.getAttribute('cx')),
      Number(dot.getAttribute('cy')),
    ]));
    expect(actual).toEqual(points);
  }
});
