import { test, expect } from '@playwright/test';
import { selectSettingsPage } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置', exact: true });
const map = page => page.locator('.spread-map');
const video = (page, direction, frameRate) => page.locator(`.spread-map-video[data-direction="${direction}"][data-frame-rate="${frameRate}"]`);

async function openMapSettings(page) {
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsPage(page, '章节', '传章');
  return panel(page);
}

async function setPlaybackRate(page, value) {
  const input = panel(page).getByRole('spinbutton', { name: '地图动画播放速度数值', exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function waitForPlaying(page, direction, frameRate, rate) {
  const target = video(page, direction, frameRate);
  await expect(map(page)).toHaveAttribute('data-map-frame-rate', String(frameRate));
  await expect(map(page)).toHaveAttribute('data-map-motion', 'moving');
  await expect.poll(() => target.evaluate(element => !element.paused && element.readyState >= 2)).toBe(true);
  await expect.poll(() => target.evaluate(element => element.playbackRate)).toBe(rate);
  const time = await target.evaluate(element => element.currentTime);
  await expect.poll(() => target.evaluate(element => element.currentTime)).toBeGreaterThan(time + 0.15);
  return target;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    if (window === top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
  });
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
});

test('地图帧率和速度可保存刷新，取消草稿恢复已保存参数与实际播放', async ({ page }) => {
  await openMapSettings(page);
  const frameRate = panel(page).getByRole('combobox', { name: '地图动画帧率', exact: true });
  await expect(frameRate).toHaveValue('60');
  expect(await frameRate.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['60', '24']);
  await expect(panel(page).getByRole('spinbutton', { name: '地图动画播放速度数值', exact: true })).toHaveValue('1');
  await frameRate.selectOption('24');
  await setPlaybackRate(page, 1.5);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey))
    .toMatchObject({ spreadMapFrameRate: 24, spreadMapPlaybackRate: 1.5 });

  await page.reload();
  await openMapSettings(page);
  await expect(frameRate).toHaveValue('24');
  await expect(panel(page).getByRole('spinbutton', { name: '地图动画播放速度数值', exact: true })).toHaveValue('1.5');
  await frameRate.selectOption('60');
  await setPlaybackRate(page, 0.5);
  await panel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('alertdialog', { name: '放弃未保存的设置？' }).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey))
    .toMatchObject({ spreadMapFrameRate: 24, spreadMapPlaybackRate: 1.5 });

  await page.getByRole('tab', { name: '中国', exact: true }).click();
  const active = await waitForPlaying(page, 'forward', 24, 1.5);
  await expect(active).toHaveAttribute('src', /motion-forward\.mp4$/);
});

test('选择60帧和较慢速度后，真实正反向视频均使用对应素材与速度', async ({ page }) => {
  await openMapSettings(page);
  await setPlaybackRate(page, 0.5);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  const forward = await waitForPlaying(page, 'forward', 60, 0.5);
  await expect(forward).toHaveAttribute('src', /motion-forward-60\.mp4$/);
  await expect.poll(() => forward.evaluate(element => element.currentTime), { timeout: 10_000 }).toBeGreaterThan(1.2);
  await page.getByRole('tab', { name: '广东', exact: true }).click();
  const reverse = await waitForPlaying(page, 'reverse', 60, 0.5);
  await expect(reverse).toHaveAttribute('src', /motion-reverse-60\.mp4$/);
});
