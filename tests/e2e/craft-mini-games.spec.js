import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assetPaths } from '../../src/config/assetPaths.js';

test.use({ trace: 'off' });

const reviewDirectory = resolve(process.env.CRAFT_GAMES_REVIEW_DIR || 'source/reviews/craft-mini-games/2026-10-26');
const games = {
  rhythm: { title: '鼓点采青', entry: '体验鼓点采青', stage: '鼓点采青游戏舞台' },
  poles: { title: '梅花桩落点', entry: '挑战梅花桩', stage: '梅花桩落点游戏舞台' },
};

async function openCraft(page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ hdriEnabled: false }));
  });
  await page.goto('/#/model');
  await expect(page.getByRole('tab', { name: '工艺', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '工艺', exact: true }).click();
  const photo = page.locator('.model-craft-photo img');
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
}

async function screenshot(page, name) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.screenshot({ path: resolve(reviewDirectory, name) });
}

async function launch(page, kind) {
  const game = games[kind];
  await page.getByRole('button', { name: game.entry, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: game.title, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-game', kind);
  const player = dialog.locator('.mini-game-player');
  await expect(player).toHaveAttribute('data-play-state', 'playing');
  const canvas = dialog.getByLabel(game.stage, { exact: true });
  await expect(canvas).toBeVisible();
  await expect(canvas).toBeFocused();
  await expect(canvas).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('button', { name: '关闭小游戏', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await canvas.evaluate(node => node instanceof HTMLCanvasElement && node.width > 0 && node.height > 0)).toBe(true);
  await expect(dialog.locator('.mini-game-hint')).toHaveText(/\S/);
  await expect(dialog.locator('.mini-game-hud')).toHaveText(/\S/);
  await expect(dialog.locator('.mini-game-hint')).toBeInViewport({ ratio: 1 });
  await expect(dialog.locator('.mini-game-hud')).toBeInViewport({ ratio: 1 });
  return { dialog, canvas, player };
}

test('鼓点采青直接开局，键盘和鼠标真实敲击反馈，退出后焦点回到入口', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openCraft(page, { width: 1920, height: 1080 });
  const { dialog, canvas } = await launch(page, 'rhythm');
  await page.keyboard.press('Space');
  await expect(dialog.locator('.mini-game-hint')).toContainText('试敲成功');
  await screenshot(page, 'game-rhythm-1920x1080.png');
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: games.rhythm.entry, exact: true })).toBeFocused();

  const reopened = await launch(page, 'rhythm');
  await reopened.canvas.click();
  await expect(reopened.dialog.locator('.mini-game-hint')).toContainText('试敲成功');
  await reopened.dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
  await expect(page.locator('.mini-game-dialog canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: games.rhythm.entry, exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('梅花桩鼠标蓄力起跳，暂停松键后恢复不会自动跳，新按键仍可蓄力', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openCraft(page, { width: 1920, height: 1080 });
  const { dialog, canvas, player } = await launch(page, 'poles');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(player).toHaveAttribute('data-game-phase', 'charging');
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect(player).toHaveAttribute('data-game-phase', 'flight');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  await screenshot(page, 'game-poles-1920x1080.png');

  await canvas.focus();
  await page.keyboard.down('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'charging');
  await dialog.getByRole('button', { name: '暂停游戏', exact: true }).click();
  await expect(player).toHaveAttribute('data-play-state', 'paused');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  await page.keyboard.up('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  await dialog.locator('.mini-game-overlay').getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(player).toHaveAttribute('data-play-state', 'playing');
  await page.waitForTimeout(250);
  await expect(player).toHaveAttribute('data-game-phase', 'ready');

  await canvas.focus();
  await page.keyboard.down('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'charging');
  await page.keyboard.up('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'flight');
  await dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: games.poles.entry, exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('切换造章页签或离开章节会卸载游戏，回到工艺可重新开始', async ({ page }) => {
  await openCraft(page);
  await launch(page, 'poles');
  // A real modal correctly blocks background clicks. Dispatch only the outer
  // tab state change to exercise cleanup; all gameplay above uses real input.
  await page.getByRole('tab', { name: '形制', exact: true }).dispatchEvent('click');
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '形制', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '工艺', exact: true }).click();
  await launch(page, 'rhythm');
  await page.evaluate(() => { location.hash = '#/state'; });
  await expect(page.locator('main')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  await expect(page.locator('.mini-game-dialog canvas')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/model'; });
  await expect(page.getByRole('tab', { name: '工艺', exact: true })).toHaveAttribute('aria-selected', 'true');
  const { dialog, player } = await launch(page, 'poles');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  await dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
});

test('角色素材加载失败后可用聚焦的重试按钮重新开局', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let failArtwork = true;
  await page.route(`**/${assetPaths.lionGamePoses}`, route => failArtwork
    ? route.fulfill({ status: 503, contentType: 'text/plain', body: 'Artwork temporarily unavailable' })
    : route.continue());
  await openCraft(page);
  await page.getByRole('button', { name: games.rhythm.entry, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: games.rhythm.title, exact: true });
  const player = dialog.locator('.mini-game-player');
  await expect(player).toHaveAttribute('data-play-state', 'error');
  await expect(dialog.getByRole('status')).toContainText('角色素材暂未载入');
  const retry = dialog.getByRole('button', { name: '重试加载', exact: true });
  await expect(retry).toBeFocused();
  const canvas = dialog.getByLabel(games.rhythm.stage, { exact: true });
  expect(await canvas.evaluate(node => node.inert)).toBe(true);

  failArtwork = false;
  await retry.click();
  await expect(player).toHaveAttribute('data-play-state', 'playing');
  await expect(canvas).toBeFocused();
  expect(await canvas.evaluate(node => node.inert)).toBe(false);
  await page.keyboard.press('Space');
  await expect(dialog.locator('.mini-game-hint')).toContainText('试敲成功');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: games.rhythm.entry, exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('角色素材加载中可关闭，释放请求后再次打开可正常开始', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const artworkPattern = `**/${assetPaths.lionGamePoses}`;
  let releaseArtwork;
  const artworkGate = new Promise(resolveGate => { releaseArtwork = resolveGate; });
  const holdArtwork = async route => {
    await artworkGate;
    await route.continue().catch(() => {}); // Closing the game may abort this request.
  };
  await page.route(artworkPattern, holdArtwork);
  await openCraft(page);
  try {
    await page.getByRole('button', { name: games.poles.entry, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: games.poles.title, exact: true });
    await expect(dialog.locator('.mini-game-player')).toHaveAttribute('data-play-state', 'loading');
    await expect(dialog.getByRole('status')).toContainText('角色准备中');
    expect(await dialog.getByLabel(games.poles.stage, { exact: true }).evaluate(node => node.inert)).toBe(true);
    await dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
    await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
    await expect(page.locator('.mini-game-dialog canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: games.poles.entry, exact: true })).toBeFocused();
  } finally {
    releaseArtwork();
    await page.unroute(artworkPattern, holdArtwork);
  }
  const { dialog, player } = await launch(page, 'poles');
  await expect(player).toHaveAttribute('data-game-phase', 'ready');
  await page.keyboard.down('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'charging');
  await page.keyboard.up('Space');
  await expect(player).toHaveAttribute('data-game-phase', 'flight');
  await dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
  await expect(page.locator('.mini-game-dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('按住空格时Tab失焦会取消蓄力和敲鼓按键锁，返回舞台可再次操作', async ({ page }) => {
  await openCraft(page);
  const poles = await launch(page, 'poles');
  await page.keyboard.down('Space');
  await expect(poles.player).toHaveAttribute('data-game-phase', 'charging');
  await page.keyboard.press('Tab');
  await expect(poles.dialog.getByRole('button', { name: '关闭小游戏', exact: true })).toBeFocused();
  await page.keyboard.up('Space');
  await expect(poles.player).toHaveAttribute('data-play-state', 'playing');
  await expect(poles.player).toHaveAttribute('data-game-phase', 'ready');
  await poles.canvas.focus();
  await page.keyboard.down('Space');
  await expect(poles.player).toHaveAttribute('data-game-phase', 'charging');
  await page.keyboard.up('Space');
  await expect(poles.player).toHaveAttribute('data-game-phase', 'flight');
  await poles.dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();

  const rhythm = await launch(page, 'rhythm');
  await page.keyboard.down('Space');
  await expect(rhythm.dialog.locator('.mini-game-hint')).toContainText('试敲成功');
  await page.keyboard.press('Tab');
  await expect(rhythm.dialog.getByRole('button', { name: '关闭小游戏', exact: true })).toBeFocused();
  await page.keyboard.up('Space');
  await expect(rhythm.player).toHaveAttribute('data-play-state', 'playing');
  await expect(rhythm.dialog.locator('.mini-game-hint')).not.toContainText('试敲成功');
  await rhythm.canvas.focus();
  await page.keyboard.down('Space');
  await expect(rhythm.dialog.locator('.mini-game-hint')).toContainText('试敲成功');
  await page.keyboard.up('Space');
  await rhythm.dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
});

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]]) {
  test(`工艺小游戏入口在 ${width}×${height} 一屏可见，保留照片许可`, async ({ page }) => {
    await openCraft(page, { width, height });
    for (const game of Object.values(games)) {
      const entry = page.getByRole('button', { name: game.entry, exact: true });
      await expect(entry).toBeVisible();
      await expect(entry).toBeInViewport({ ratio: 1 });
      await entry.click({ trial: true });
    }
    await expect(page.getByRole('heading', { name: '扎、扑、画、装', exact: true })).toBeInViewport();
    await expect(page.locator('.model-craft-note')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('link', { name: '照片来源', exact: true })).toHaveAttribute('href', /commons\.wikimedia\.org\/wiki\/File:2020_/);
    await expect(page.getByRole('link', { name: 'CC BY 2.0', exact: true })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/2.0/');
    await expect(page.getByRole('link', { name: 'CC BY 2.0', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await screenshot(page, `craft-entries-${width}x${height}.png`);
    for (const kind of Object.keys(games)) {
      const { dialog } = await launch(page, kind);
      await dialog.getByRole('button', { name: '关闭小游戏', exact: true }).click();
    }
  });
}
