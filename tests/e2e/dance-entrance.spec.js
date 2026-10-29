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
  await open(page);
  const entrance = page.getByRole('region', { name: '舞章空间入口', exact: true });
  await expect(entrance).toBeVisible();
  await expect(entrance.getByRole('link', { name: '进入三维展厅', exact: true })).toHaveAttribute('href', '#/theater');
  await expect(entrance.getByRole('link', { name: '走近醒狮八态', exact: true })).toHaveAttribute('href', '#/state');
  await expect(entrance.locator('[data-scene="theater"]')).toHaveCount(1);
  await expect(entrance.locator('[data-scene="expressions"]')).toHaveCount(1);
  await expect(page.locator('#actionTheater')).toHaveCount(0);
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

test('preview videos retain their sources through mount replay and stop when the scene fails', async ({ page }) => {
  await open(page, 'no-preference');
  const preview = page.locator('[data-scene="theater"]');
  await expect(preview).toHaveAttribute('data-preview-state', 'ready', { timeout: 90_000 });
  await expect.poll(() => preview.locator('video').evaluateAll(videos => videos.filter(video => video.currentSrc && video.readyState >= 2 && !video.paused).length)).toBe(4);
  await page.route('**/lion-action-theater.glb', route => route.abort());
  await page.reload();
  await expect(preview).toHaveAttribute('data-preview-state', 'error', { timeout: 60_000 });
  await expect.poll(() => preview.locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
  await page.getByRole('link', { name: '进入三维展厅', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'theater');
});

test('failed depth preview reports one error and preserves the entry', async ({ page }) => {
  await page.route(/\/(?:Scene-[^/]+\.js|Scene\.tsx)(?:\?|$)/, route => route.abort());
  await page.route('**/lion-action-theater.glb', route => route.abort());
  await open(page);
  const preview = page.locator('[data-scene="expressions"]');
  await expect(preview).toHaveAttribute('data-preview-state', 'error');
  await expect(preview.locator('.portal-preview-status')).toHaveCount(1);
  await expect(preview.locator('.portal-preview-status')).toContainText('仍可点击进入');
  await expect(page.getByRole('link', { name: '走近醒狮八态', exact: true })).toBeVisible();
});

test('entrance renders the destination worlds and dragging changes their real camera perspective', async ({ page }) => {
  test.setTimeout(150_000);
  await open(page);
  const theater = page.locator('[data-scene="theater"] canvas');
  const depth = page.locator('[data-scene="expressions"] canvas');
  await expect(theater).toHaveCount(1, { timeout: 5000 });
  await expect(theater).toHaveAttribute('data-scene-ready', 'true', { timeout: 90_000 });
  await expect(depth).toHaveAttribute('data-scene-ready', 'true');
  const source = await theater.getAttribute('data-source-model');
  expect(source).toMatch(/\.glb$/);
  expect(Number(await theater.getAttribute('data-full-hair-strands'))).toBeGreaterThan(0);
  const layout = JSON.parse(await depth.getAttribute('data-scene-layout'));
  expect(layout).toHaveLength(8);
  expect(new Set(layout.map(card => card.worldZ)).size).toBe(8);
  expect(await page.evaluate(() => window.__LION_DEPTH_SCENE__)).toBeUndefined();
  const before = {
    theater: JSON.parse(await theater.getAttribute('data-camera-position')),
    depth: JSON.parse(await depth.getAttribute('data-camera-position')),
    projected: JSON.parse(await depth.getAttribute('data-projected-artworks')),
  };
  const stage = page.getByRole('group', { name: '拖动环看两处空间' });
  await stage.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(async () => JSON.parse(await theater.getAttribute('data-camera-position'))[0]).not.toBe(before.theater[0]);
  await expect.poll(async () => JSON.parse(await depth.getAttribute('data-camera-position'))[0]).not.toBe(before.depth[0]);
  const after = JSON.parse(await depth.getAttribute('data-projected-artworks'));
  const nearShift = after[0].x - before.projected[0].x;
  const farShift = after[1].x - before.projected[1].x;
  expect(Math.abs(nearShift - farShift)).toBeGreaterThan(.005);
  await page.getByRole('button', { name: '视角归位', exact: true }).click();
  await expect.poll(async () => JSON.parse(await theater.getAttribute('data-camera-position'))[0]).toBeCloseTo(before.theater[0], 2);
  await page.getByRole('link', { name: '进入三维展厅', exact: true }).click();
  const full = page.locator('#actionTheater canvas');
  await expect(full).toHaveAttribute('data-scene-ready', 'true', { timeout: 90_000 });
  await expect(full).toHaveAttribute('data-source-model', source);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?inspect=1#/state');
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__?.cards?.length)).toBe(8);
  const fullLayout = await page.evaluate(() => window.__LION_DEPTH_SCENE__.cards.map(({ stateId, worldZ }) => ({ stateId, worldZ })));
  expect(fullLayout).toEqual(layout);
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
