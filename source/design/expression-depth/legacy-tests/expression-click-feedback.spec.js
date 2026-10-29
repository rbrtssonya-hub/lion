import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectSettingsFor, settingsPanel } from './settings-navigation.helpers.js';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);

const storageKey = 'nanfeng-lion:developer-settings:v1';
const trigger = page => page.locator('#expressionLionTrigger');
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const count = page => page.evaluate(() => window.expressionFeedbackAnimations.length);

async function ready(page) {
  await expect.poll(() => page.locator('#expressionLion').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.expression-lion-layer.is-current').evaluate(element =>
    Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
}

async function prepare(page, settings = {}) {
  await page.addInitScript(({ key, settings }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    if (!sessionStorage.getItem('expression-click-feedback:seeded')) {
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, bookAutoplay: false, ...settings }));
      sessionStorage.setItem('expression-click-feedback:seeded', '1');
    }
    // Observe real application-created WAAPI animations. Calling the original
    // implementation unchanged preserves native playback and interruption.
    window.expressionFeedbackAnimations = [];
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(nativeAnimate, this, args);
      if (this.id === 'expressionLionTrigger') window.expressionFeedbackAnimations.push(animation);
      return animation;
    };
  }, { key: storageKey, settings });
  await page.goto('/#/state');
  await ready(page);
}

async function pulse(page, keyboard = false) {
  const before = await count(page);
  if (keyboard) { await trigger(page).focus(); await trigger(page).press('Enter'); }
  else await trigger(page).click();
  await expect.poll(() => count(page)).toBe(before + 1);
  return page.evaluate(async () => {
    const animation = window.expressionFeedbackAnimations.at(-1);
    animation.pause();
    await animation.ready;
    const duration = Number(animation.effect.getTiming().duration);
    const target = animation.effect.target;
    let peak = { scale: 0, time: 0 };
    for (let index = 0; index <= 128; index++) {
      animation.currentTime = duration * index / 128;
      const scale = new DOMMatrixReadOnly(getComputedStyle(target).transform).a;
      if (scale > peak.scale) peak = { scale, time: animation.currentTime };
    }
    animation.currentTime = peak.time;
    return { ...peak, duration, state: animation.playState };
  });
}

async function finishPulse(page) {
  await page.evaluate(async () => {
    window.expressionFeedbackAnimations.at(-1).finish();
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  await expect.poll(() => trigger(page).evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBe(1);
}

async function openSettings(page) {
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsFor(page, '狮头点击放大');
}

async function change(page, scale, duration) {
  for (const [label, value] of [['狮头点击放大', scale], ['点击反馈时长', duration]]) {
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(value));
    await input.press('Tab');
    await expect(input).toHaveValue(String(value));
  }
}

async function configuration(page, scale, duration) {
  await expect(trigger(page)).toHaveAttribute('data-expression-click-scale', String(scale));
  await expect(trigger(page)).toHaveAttribute('data-expression-click-duration', String(duration));
}

async function discard(page) {
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('alertdialog', { name: '放弃未保存的设置？' }).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
}

test('默认真实鼠标与键盘激活均有明显108%放大反馈，结束恢复同一狮头并正常解读', async ({ page }) => {
  await prepare(page);
  const original = await trigger(page).elementHandle();
  for (const keyboard of [false, true]) {
    const result = await pulse(page, keyboard);
    expect(result.duration).toBe(280);
    expect(result.scale).toBeGreaterThan(1.015);
    expect(result.scale).toBeCloseTo(1.08, 2);
    expect(result.state).toBe('paused');
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
    await finishPulse(page);
  }
  expect(await original.evaluate(element => element === document.querySelector('#expressionLionTrigger'))).toBe(true);
});

test('点击反馈参数实时传入但不落盘，导出取消保存刷新及默认恢复遵守统一事务', async ({ page }) => {
  await prepare(page);
  const initial = await stored(page);
  await openSettings(page);
  await change(page, 117, 500);
  await configuration(page, 117, 500);
  expect(await stored(page)).toEqual(initial);
  const downloading = page.waitForEvent('download');
  await settingsPanel(page).getByRole('button', { name: '导出当前参数', exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toMatchObject({ state: 'unsaved-preview', settings: { expressionClickScale: 117, expressionClickDuration: 500 } });
  await discard(page);
  await configuration(page, 108, 280);
  expect(await stored(page)).toEqual(initial);
  let result = await pulse(page);
  expect(result.scale).toBeCloseTo(1.08, 2);
  await finishPulse(page);
  await openSettings(page);
  await change(page, 114, 440);
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject({ expressionClickScale: 114, expressionClickDuration: 440 });
  await page.reload();
  await ready(page);
  await configuration(page, 114, 440);
  result = await pulse(page);
  expect(result.scale).toBeCloseTo(1.14, 2);
  expect(result.duration).toBe(440);
  await finishPulse(page);
  await openSettings(page);
  await settingsPanel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  await configuration(page, 108, 280);
  expect(await stored(page)).toMatchObject({ expressionClickScale: 114, expressionClickDuration: 440 });
  await discard(page);
  await configuration(page, 114, 440);
  await openSettings(page);
  await settingsPanel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  result = await pulse(page);
  expect(result.scale).toBeCloseTo(1.08, 2);
  expect(result.duration).toBe(280);
  await finishPulse(page);
});

test('120%峰值在1920/900/640和矮电脑窗口中不裁狮头、不覆盖箭头与正文', async ({ page }, testInfo) => {
  await prepare(page, { expressionClickScale: 120, expressionClickDuration: 800, headerHeight: 180 });
  for (const [width, height] of [[1920, 1080], [900, 700], [640, 360], [1440, 500]]) {
    await page.setViewportSize({ width, height });
    await trigger(page).scrollIntoViewIfNeeded();
    const result = await pulse(page);
    expect(result.scale).toBeCloseTo(1.2, 2);
    const geometry = await page.locator('#expressionLion').evaluate(image => {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth; surface.height = image.naturalHeight;
      const context = surface.getContext('2d');
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, surface.width, surface.height).data;
      let left = surface.width, top = surface.height, right = 0, bottom = 0;
      for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) {
        if (data[(y * surface.width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      const box = image.getBoundingClientRect();
      const fit = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
      const x = box.x + (box.width - image.naturalWidth * fit) / 2;
      const y = box.y + (box.height - image.naturalHeight * fit) / 2;
      const painted = { left: x + left * fit, top: y + top * fit, right: x + right * fit, bottom: y + bottom * fit };
      const stage = document.querySelector('#expressionObservation').getBoundingClientRect().toJSON();
      const blockers = ['#expressionPrevious', '#expressionNext', '.expression-state-nav', '#expressionStateCopy'].map(selector => ({ selector,
        ...document.querySelector(selector).getBoundingClientRect().toJSON() }));
      return { painted, stage, blockers };
    });
    expect(geometry.painted.left).toBeGreaterThanOrEqual(geometry.stage.left - 1);
    expect(geometry.painted.right).toBeLessThanOrEqual(geometry.stage.right + 1);
    expect(geometry.painted.top).toBeGreaterThanOrEqual(geometry.stage.top - 1);
    expect(geometry.painted.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1);
    for (const blocker of geometry.blockers) {
      const overlap = Math.min(geometry.painted.right, blocker.right) - Math.max(geometry.painted.left, blocker.left) > 1 &&
        Math.min(geometry.painted.bottom, blocker.bottom) - Math.max(geometry.painted.top, blocker.top) > 1;
      expect(overlap, blocker.selector).toBe(false);
    }
    for (const id of ['expressionPrevious', 'expressionNext']) {
      const button = page.locator(`#${id}`);
      await button.scrollIntoViewIfNeeded();
      await button.evaluate(element => {
        const top = document.querySelector('.site-header').getBoundingClientRect().bottom + 16;
        window.scrollBy({ top: element.getBoundingClientRect().top - top, behavior: 'instant' });
      });
      expect(await button.evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
    }
    await testInfo.attach(`actual-alpha-paint-at-peak-${width}-${height}`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
    await finishPulse(page);
  }
});

test('100%关闭放大脉冲但鼠标和键盘仍打开解读', async ({ page }) => {
  await prepare(page, { expressionClickScale: 100 });
  for (const keyboard of [false, true]) {
    if (keyboard) { await trigger(page).focus(); await trigger(page).press('Enter'); }
    else await trigger(page).click();
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
    expect(await count(page)).toBe(0);
    expect(await trigger(page).evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).a)).toBe(1);
  }
});

test('减少动态、切态、对照和离页取消真实反馈动画，无残留缩放', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page, { expressionClickScale: 120, expressionClickDuration: 800 });
  await pulse(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.expressionFeedbackAnimations.at(-1).playState)).toBe('idle');
  await trigger(page).click();
  expect(await count(page)).toBe(1);
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await pulse(page);
  await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name: '怒', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.expressionFeedbackAnimations.at(-1).playState)).toBe('idle');
  await ready(page);
  await pulse(page);
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.expressionFeedbackAnimations.at(-1).playState)).toBe('idle');
  await page.getByRole('button', { name: '八态浏览', exact: true }).click();
  await pulse(page);
  await page.locator('.site-navigation [data-route="entry"]').click();
  await expect(page.locator('#expressionLionTrigger')).toHaveCount(0);
  expect(await page.evaluate(() => { const animation = window.expressionFeedbackAnimations.at(-1); return animation.playState === 'idle' && !animation.effect.target.isConnected; })).toBe(true);
  expect(errors).toEqual([]);
});
