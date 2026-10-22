import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selectSettingsFor, settingsPanel } from './settings-navigation.helpers.js';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);

const storageKey = 'nanfeng-lion:developer-settings:v1';
const widget = page => page.locator('.sound-control-widget');
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const fields = [
  ['soundControlFontSize', '音量文字字号'],
  ['soundControlWidth', '音量控件宽度'],
  ['soundWaveWidth', '波浪线长度'],
];

async function prepare(page, settings = {}) {
  await page.addInitScript(({ key, settings }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    // A reload must read the actual save instead of replacing it in a fixture.
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      carouselAutoplay: false, bookAutoplay: false, ...settings,
    }));
  }, { key: storageKey, settings });
  await page.goto('/');
  await expect(widget(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function open(page) {
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(settingsPanel(page)).toBeVisible();
}

async function change(page, settings) {
  for (const [key, label] of fields) {
    if (!Object.hasOwn(settings, key)) continue;
    await selectSettingsFor(page, label);
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(settings[key]));
    await input.press('Tab');
    await expect(input).toHaveValue(String(settings[key]));
    await expect(settingsPanel(page).getByRole('slider', { name: label, exact: true })).toHaveAttribute('aria-valuetext', `${settings[key]}px`);
  }
}

async function expectDimensions(page, { soundControlWidth: width, soundControlFontSize: font, soundWaveWidth: wave }) {
  await expect.poll(() => widget(page).evaluate(element => ({
    width: element.getBoundingClientRect().width,
    font: Number.parseFloat(getComputedStyle(element.querySelector('.sound-control-label')).fontSize),
    wave: element.querySelector('.sound-wave-window').getBoundingClientRect().width,
  }))).toEqual({ width, font, wave });
}

async function cancelDraft(page) {
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('alertdialog', { name: '放弃未保存的设置？' }).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
}

const defaults = { soundControlWidth: 180, soundControlFontSize: 16, soundWaveWidth: 64 };
const custom = { soundControlWidth: 240, soundControlFontSize: 22, soundWaveWidth: 104 };

test('声音显示参数以px实时预览，导出当前草稿，取消恢复原尺寸和已存参数', async ({ page }) => {
  await prepare(page);
  await expectDimensions(page, defaults);
  const initial = await stored(page);
  await open(page);
  await change(page, custom);
  await expectDimensions(page, custom);
  expect(await stored(page)).toEqual(initial);
  const downloadPromise = page.waitForEvent('download');
  await settingsPanel(page).getByRole('button', { name: '导出当前参数', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toMatchObject({ state: 'unsaved-preview', settings: custom });
  expect(await stored(page)).toEqual(initial);
  await cancelDraft(page);
  await expectDimensions(page, defaults);
  expect(await stored(page)).toEqual(initial);
});

test('声音尺寸保存后刷新和动作页保持一致，恢复默认仅预览并可取消或保存', async ({ page }) => {
  await prepare(page);
  await open(page);
  await change(page, custom);
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  expect(await stored(page)).toMatchObject(custom);
  await page.reload();
  await expectDimensions(page, custom);
  await page.locator('.site-navigation [data-route="action"]').click();
  await expect(page.locator('#chapterStage canvas')).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await expectDimensions(page, custom);
  await open(page);
  await selectSettingsFor(page, '音量文字字号');
  for (const [key, label] of fields) await expect(settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true })).toHaveValue(String(custom[key]));
  await settingsPanel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  await expectDimensions(page, defaults);
  expect(await stored(page)).toMatchObject(custom);
  await cancelDraft(page);
  await expectDimensions(page, custom);
  await open(page);
  await settingsPanel(page).getByRole('button', { name: '恢复默认参数', exact: true }).click();
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await page.reload();
  await expectDimensions(page, defaults);
  expect(await stored(page)).toMatchObject(defaults);
});

function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
}

async function expectGeometry(page, blockers) {
  await widget(page).scrollIntoViewIfNeeded();
  const geometry = await widget(page).evaluate((element, selectors) => {
    const rect = node => node.getBoundingClientRect().toJSON();
    return {
      widget: rect(element), width: innerWidth,
      parts: ['.sound-control-label', '.sound-wave-window', '.sound-volume-slider', '.sound-volume-value'].map(selector => ({ selector, ...rect(element.querySelector(selector)) })),
      label: rect(element.querySelector('.sound-control-label')),
      wave: rect(element.querySelector('.sound-wave-window')),
      blockers: selectors.map(selector => ({ selector, ...rect(document.querySelector(selector)) })),
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, blockers);
  expect(geometry.widget.left).toBeGreaterThanOrEqual(0);
  expect(geometry.widget.right).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
  for (const part of geometry.parts) {
    expect(part.width, part.selector).toBeGreaterThan(0);
    expect(part.left, part.selector).toBeGreaterThanOrEqual(geometry.widget.left - 1);
    expect(part.right, part.selector).toBeLessThanOrEqual(geometry.widget.right + 1);
  }
  expect(overlaps(geometry.label, geometry.wave)).toBe(false);
  for (const blocker of geometry.blockers) expect(overlaps(geometry.widget, blocker), blocker.selector).toBe(false);
  for (const target of [widget(page).getByRole('button'), widget(page).getByRole('slider', { name: '音量', exact: true })]) {
    expect(await target.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
}

for (const width of [140, 300]) {
  test(`最大28px文字与120px波浪配${width}px控件，在1920/900/640短电脑窗完整可点且不遮挡首页及动作`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepare(page, { soundControlWidth: width, soundControlFontSize: 28, soundWaveWidth: 120 });
    for (const [width, height] of [[1920, 1080], [900, 600], [640, 360]]) {
      await page.setViewportSize({ width, height });
      await expectGeometry(page, ['#enterWork', '.entry-motto', '.entry-english']);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('.site-navigation [data-route="action"]').click();
    await expect(page.locator('#chapterStage canvas')).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
    for (const [width, height] of [[1920, 1080], [900, 600], [640, 360]]) {
      await page.setViewportSize({ width, height });
      await expectGeometry(page, ['.theater-observation', '#theaterControls']);
    }
  });
}

test('12px最小字号配120px最长波浪，整个裁剪窗持续有波并右行，静音后全长成为直线', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await prepare(page, { soundControlWidth: 300, soundControlFontSize: 12, soundWaveWidth: 120 });
  const toggle = widget(page).getByRole('button');
  if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => !video.paused && !video.muted && video.currentTime > .1)).toBe(true);
  await page.mouse.move(700, 300);
  await expect.poll(() => widget(page).locator('.sound-wave-traces').first().locator('path').nth(1)
    .evaluate(element => Math.abs(Number.parseFloat(getComputedStyle(element).strokeDashoffset)))).toBeLessThan(.02);
  const samples = await widget(page).locator('.sound-wave-window').evaluate(element => new Promise(resolve => {
    const frames = [], flow = element.querySelector('.sound-wave-flow');
    const paths = [...element.querySelectorAll('.sound-wave-traces path:nth-child(2)')];
    let started;
    function sample(time) {
      started ??= time;
      const box = element.getBoundingClientRect();
      const ys = [];
      for (let column = 0; column <= 12; column++) {
        const x = box.x + 1 + (box.width - 2) * column / 12;
        const candidates = [];
        for (const path of paths) {
          const length = path.getTotalLength(), matrix = path.getScreenCTM();
          const at = distance => path.getPointAtLength(distance).matrixTransform(matrix);
          if (x < at(0).x || x > at(length).x) continue;
          let low = 0, high = length;
          for (let index = 0; index < 16; index++) {
            const middle = (low + high) / 2;
            if (at(middle).x < x) low = middle; else high = middle;
          }
          const point = at((low + high) / 2);
          if (point.y >= box.top - 1 && point.y <= box.bottom + 1) candidates.push(point.y);
        }
        ys.push(candidates.length ? candidates[0] : null);
      }
      frames.push({ time: time - started, x: new DOMMatrixReadOnly(getComputedStyle(flow).transform).m41,
        box: { x: box.x, y: box.y, width: box.width, height: box.height }, covered: ys.every(y => y !== null),
        spread: Math.max(...ys.filter(y => y !== null)) - Math.min(...ys.filter(y => y !== null)) });
      if (time - started >= 1650) resolve(frames);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.every(frame => frame.covered)).toBe(true);
  expect(samples.every(frame => frame.spread > 2)).toBe(true);
  expect(new Set(samples.map(frame => JSON.stringify(frame.box))).size).toBe(1);
  const deltas = samples.slice(1).map((frame, index) => frame.x - samples[index].x);
  expect(deltas.filter(delta => delta > .01).length).toBeGreaterThan(3);
  expect(deltas.some(delta => delta < -25)).toBe(true);
  await testInfo.attach('longest-wave-smallest-font-actual-frames', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => widget(page).locator('.sound-wave-window').evaluate(element => {
    const rect = element.getBoundingClientRect(), path = element.querySelector('.sound-wave-tail');
    const matrix = path.getScreenCTM(), length = path.getTotalLength();
    const at = distance => path.getPointAtLength(distance).matrixTransform(matrix);
    const ys = [];
    for (let column = 0; column <= 12; column++) {
      const x = rect.x + rect.width * column / 12;
      if (x < at(0).x || x > at(length).x) return false;
      let low = 0, high = length;
      for (let index = 0; index < 20; index++) {
        const middle = (low + high) / 2;
        if (at(middle).x < x) low = middle; else high = middle;
      }
      const point = at((low + high) / 2);
      if (point.y < rect.top - 1 || point.y > rect.bottom + 1) return false;
      ys.push(point.y);
    }
    return Math.max(...ys) - Math.min(...ys) < .02;
  })).toBe(true);
  await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => !video.paused && video.muted)).toBe(true);
});
