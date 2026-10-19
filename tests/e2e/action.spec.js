import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { actions, stage, scene, actionButton, actionVideo, openTheater, selectAction } from './action-theater.helpers.js';

const reviewDir = resolve('source/reviews/action-theater/2026-10-19-ornate');

test('动作页替换为巨幕厅，四段用户视频保持原始画幅与内容来源', async ({ page }) => {
  await openTheater(page);
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await expect(stage(page).locator('.action-timeline, .action-clip, #actionHero')).toHaveCount(0);
  for (const { id } of actions) {
    const video = actionVideo(page, id);
    await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
    expect(await video.evaluate(element => ({ width: element.videoWidth, height: element.videoHeight }))).toEqual({ width: 2560, height: 1440 });
    expect(await video.evaluate(element => element.duration)).toBeCloseTo(8, 1);
    await expect(video).toHaveAttribute('src', new RegExp(`/action/videos/${id}\\.mp4$`));
  }
  await expect(page.locator('#chapterEvidence')).toContainText('用户提供');
  await expect(page.locator('#chapterEvidence')).not.toContainText('视频待接入');
  await expect(page.locator('.site-header .site-nav-item[data-route="action"]')).toHaveAttribute('aria-current', 'page');
});

test('四面动作选择同步当前标题、按键状态与真实场景视角', async ({ page }) => {
  test.setTimeout(120_000);
  await openTheater(page);
  mkdirSync(reviewDir, { recursive: true });
  for (const { id, name } of actions) {
    await selectAction(page, id);
    await expect(page.locator('#theaterActionName')).toHaveText(name);
    await expect(stage(page).locator('button[data-action-id][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('#theaterObservation')).toBeVisible();
    await expect(page).toHaveURL(/#\/action$/);
    await expect(page.locator('.theater-caption.is-leaving')).toHaveCount(0);
    await page.screenshot({ path: resolve(reviewDir, `action-theater-${id}-1920.png`) });
  }
});

test('减弱动态时四动作仍支持键盘选择和手动播放', async ({ page }) => {
  await openTheater(page, { reducedMotion: 'reduce' });
  await actionButton(page, 'doumao').focus();
  await page.keyboard.press('Enter');
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'doumao');
  await expect(page.locator('#theaterActionName')).toHaveText('抖毛');
  await page.getByRole('button', { name: '暂停动作视频', exact: true }).click();
  await page.getByRole('button', { name: '播放动作视频', exact: true }).click();
  await expect.poll(() => actionVideo(page, 'doumao').evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  await page.locator('#actionTheater').focus();
  await page.keyboard.press('ArrowRight');
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tuqiu');
});

test('电脑三种窗口与设置推开保持画布、说明及固定导航完整可用', async ({ page }) => {
  test.setTimeout(180_000);
  await openTheater(page, { settings: { panelWidth: 760 } });
  mkdirSync(reviewDir, { recursive: true });
  for (const [width, height] of [[1920, 1080], [1366, 768], [900, 900]]) {
    await page.setViewportSize({ width, height });
    await expect(scene(page)).toBeVisible();
    await expect(page.locator('#theaterControls')).toBeVisible();
    await expect(page.locator('#theaterObservation')).toBeVisible();
    await expect.poll(() => stage(page).evaluate(element => {
      const shell = document.querySelector('.site-shell').getBoundingClientRect();
      const canvas = element.querySelector('canvas').getBoundingClientRect();
      const header = document.querySelector('.site-header').getBoundingClientRect();
      return document.documentElement.scrollWidth <= shell.width + 1 && canvas.width > 250 && canvas.height > 200 && canvas.left >= shell.left - 1 && canvas.right <= shell.right + 1 && header.top >= -1;
    })).toBe(true);
    await page.screenshot({ path: resolve(reviewDir, `action-theater-desktop-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1675, height: 1000 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await page.getByRole('tab', { name: '布局', exact: true }).click();
  await page.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => page.locator('.site-page').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(900, 0);
  await expect.poll(() => scene(page).evaluate(element => element.getBoundingClientRect().right <= document.querySelector('.site-page').getBoundingClientRect().right + 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width + 1)).toBe(true);
  await page.screenshot({ path: resolve(reviewDir, 'action-theater-settings-push.png'), fullPage: true });
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await selectAction(page, 'tuqiu');
  await expect(page.locator('#theaterActionName')).toHaveText('狮子吐球');
});
