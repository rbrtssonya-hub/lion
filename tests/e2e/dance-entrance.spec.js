import { test, expect } from '@playwright/test';

async function open(page, reduced = 'reduce') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
  });
  await page.goto('/#/action');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
}

test('dance offers two different destinations and preserves deep links and history', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await open(page);
  const entrance = page.getByRole('region', { name: '舞章空间入口', exact: true });
  await expect(entrance).toBeVisible();
  await expect(entrance.getByRole('link', { name: '进入三维展厅', exact: true })).toHaveAttribute('href', '#/theater');
  await expect(entrance.getByRole('link', { name: '走近醒狮八态', exact: true })).toHaveAttribute('href', '#/state');
  await expect(entrance.locator('[data-scene="theater"]')).toHaveCount(1);
  await expect(entrance.locator('[data-scene="expressions"] [data-expression]')).toHaveCount(8);
  await expect(page.locator('#actionTheater')).toHaveCount(0);
  expect(requests.some(url => /lion-action-theater\.glb|\/action\/videos\/.*\.mp4/.test(url))).toBe(false);
  const portals = await entrance.locator('.portal-card').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { top: r.top, width: r.width, height: r.height };
  }));
  expect(Math.abs(portals[0].top - portals[1].top)).toBeLessThan(1);
  expect(Math.abs(portals[0].width - portals[1].width)).toBeLessThan(1);
  expect(Math.abs(portals[0].height - portals[1].height)).toBeLessThan(1);
  await entrance.getByRole('link', { name: '进入三维展厅', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'theater');
  await expect(page.locator('#actionTheater')).toBeVisible();
  await expect(page.locator('.site-navigation [data-route="action"]')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: '返回舞章入口', exact: true }).click();
  await expect(entrance).toBeVisible();
  await entrance.getByRole('link', { name: '走近醒狮八态', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#expressionObservation')).toBeVisible();
  await page.goBack();
  await expect(entrance).toBeVisible();
  await entrance.getByRole('link', { name: '走近醒狮八态', exact: true }).click();
  await page.getByRole('button', { name: '返回舞章入口', exact: true }).click();
  await expect(entrance).toBeVisible();
});

test('paper background loads and reduced-motion entry links survive failed preview images', async ({ page }) => {
  await page.route('**/assets/expression/lion-*.png', route => route.abort());
  await open(page);
  const entrance = page.getByRole('region', { name: '舞章空间入口', exact: true });
  await expect(entrance).toBeVisible();
  expect(await entrance.evaluate(async element => {
    const background = getComputedStyle(element).backgroundImage;
    return new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img.naturalWidth); img.onerror = () => resolve(0); img.src = background.slice(5, -2); });
  })).toBe(2048);
  await expect(entrance.getByRole('link', { name: '进入三维展厅', exact: true })).toBeVisible();
  const link = entrance.getByRole('link', { name: '走近醒狮八态', exact: true });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await page.goto('/#/theater');
  await expect(page.locator('#actionTheater')).toBeVisible();
});

test('drag rotates mirrored portals, does not navigate, and reset restores the view', async ({ page }) => {
  await open(page, 'no-preference');
  const entrance = page.getByRole('region', { name: '舞章空间入口', exact: true });
  await expect(entrance).toBeVisible();
  const scene = entrance.getByRole('group', { name: '拖动环看两处空间' });
  const b = await scene.boundingBox();
  await page.mouse.move(b.x + b.width * .3, b.y + b.height * .5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * .55, b.y + b.height * .56, { steps: 16 });
  await page.mouse.up();
  await expect(entrance).toHaveAttribute('data-view-moved', 'true');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'action');
  await entrance.getByRole('button', { name: '视角归位', exact: true }).click();
  await expect(entrance).toHaveAttribute('data-view-moved', 'false');
  await scene.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(entrance).toHaveAttribute('data-view-moved', 'true');
  await page.keyboard.press('Home');
  await expect(entrance).toHaveAttribute('data-view-moved', 'false');
});

test('releasing outside before drag threshold does not leave the view attached to the pointer', async ({ page }) => {
  await open(page, 'no-preference');
  const entrance = page.getByRole('region', { name: '舞章空间入口', exact: true });
  const b = await entrance.getByRole('group', { name: '拖动环看两处空间' }).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y - 3);
  await page.mouse.up();
  await page.mouse.move(b.x + b.width / 2, b.y + 90);
  await expect(entrance).toHaveAttribute('data-view-moved', 'false');
  await expect(entrance).not.toHaveAttribute('data-dragging', 'true');
});

test('assistant explains the chooser and its theater source opens the actual theater', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '与小醒对话', exact: true }).click();
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  await expect(page.locator('.xiaoxing-message').last()).toContainText('两个');
  await page.getByRole('navigation', { name: '回答来源' }).getByRole('button', { name: /四面巨幕厅/ }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'theater');
  await expect(page.locator('#actionTheater')).toBeVisible();
});
