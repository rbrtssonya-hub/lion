import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PARAMETERS, LIGHT_PRESETS, PARAMETER_FIELDS, parseParameters, serializeParameters } from '../../src/config/spreadStampSettings.js';
import { selectSettingsPage } from './settings-navigation.helpers.js';

test.use({ viewport: { width: 1920, height: 1080 }, trace: 'off' });
test.setTimeout(150_000);
const storageKey = 'nanfeng-lion:developer-settings:v1';
const panel = page => page.getByRole('region', { name: '开发者参数设置', exact: true });
const stampControls = page => panel(page).locator('[data-stamp-settings]');
const board = page => page.locator('#spreadPlaceCard.spread-stamp-board');
const canvas = page => board(page).locator('canvas[data-renderer="regional-stamp-webgl"]');
const trigger = page => page.locator('.site-navigation [data-action="settings"]');
const prompt = page => page.getByRole('alertdialog', { name: '放弃未保存的设置？' });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);

async function prepare(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('stamp-settings:seeded')) {
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ headerTransparency: 37, carouselAutoplay: false, bookAutoplay: false, pushPage: true }));
      sessionStorage.setItem('stamp-settings:seeded', '1');
    }
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(...args) {
      const gl = Reflect.apply(native, this, args);
      if (!gl || !/^webgl/.test(args[0]) || this.__stampSettingsGL) return gl;
      const record = this.__stampSettingsGL = { gl, programs: [], activity: [] };
      const create = gl.createProgram;
      gl.createProgram = function(...values) { const program = Reflect.apply(create, this, values); record.programs.push(program); return program; };
      for (const name of ['drawElements', 'drawArrays']) {
        const draw = gl[name];
        gl[name] = function(...values) {
          const program = gl.getParameter(gl.CURRENT_PROGRAM);
          if (program) {
            const location = gl.getUniformLocation(program, 'uActivity');
            if (location !== null) { record.activity.push(Number(gl.getUniform(program, location))); if (record.activity.length > 96) record.activity.shift(); }
          }
          return Reflect.apply(draw, this, values);
        };
      }
      return gl;
    };
  });
  await page.goto('/#/spread');
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 90_000 });
  await expect(canvas(page)).toHaveAttribute('data-shader-ready', 'true');
  await expect.poll(() => stored(page)).toMatchObject({ stampLightAlgorithm: 'local-add' });
  return errors;
}

async function open(page) {
  await trigger(page).click();
  await selectSettingsPage(page, '邮票');
  await expect(stampControls(page)).toBeVisible();
  await expect(page.locator('.settings-outside-guard')).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: '关闭开发者参数', exact: true })).toHaveCount(0);
}

async function number(page, label, value) {
  const input = stampControls(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function paste(page, text) {
  await stampControls(page).getByRole('button', { name: '粘贴参数 JSON', exact: true }).click();
  await stampControls(page).getByRole('textbox', { name: '邮票参数 JSON', exact: true }).fill(text);
  await stampControls(page).getByRole('button', { name: '应用邮票参数 JSON', exact: true }).click();
}

async function discard(page) {
  await panel(page).getByRole('button', { name: '取消', exact: true }).click();
  if (await prompt(page).isVisible()) await prompt(page).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
}

async function download(page, label) {
  const pending = page.waitForEvent('download');
  await panel(page).getByRole('button', { name: label, exact: true }).click();
  const file = await pending;
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

async function gpuAlgorithm(page) {
  return canvas(page).evaluate(element => {
    const { gl, programs } = element.__stampSettingsGL;
    return programs.filter(program => gl.isProgram(program) && gl.getProgramParameter(program, gl.LINK_STATUS)).flatMap(program => {
      const location = gl.getUniformLocation(program, 'uLightAlgorithm');
      return location === null ? [] : [Number(gl.getUniform(program, location))];
    });
  });
}

test('独立邮票页完整呈现52参数，六算法实际进入GPU，设置开放时主邮票可悬停与聚焦', async ({ page }) => {
  const errors = await prepare(page);
  const baseline = await stored(page);
  await open(page);
  await expect(stampControls(page).locator('[data-stamp-parameter]')).toHaveCount(52);
  expect(await stampControls(page).locator('[data-stamp-parameter]').evaluateAll(nodes => nodes.map(node => node.dataset.stampParameter).sort())).toEqual(PARAMETER_FIELDS.map(field => field.key).sort());
  const originalCanvas = await canvas(page).elementHandle();
  const algorithm = stampControls(page).getByRole('combobox', { name: '光影预设', exact: true });
  await expect(algorithm.locator('option')).toHaveCount(6);
  for (const preset of LIGHT_PRESETS) {
    await algorithm.selectOption(preset.id);
    await expect(canvas(page)).toHaveAttribute('data-light-algorithm', preset.id);
    await expect.poll(async () => {
      const values = await gpuAlgorithm(page);
      return values.length > 0 && values.every(value => value === preset.index);
    }).toBe(true);
  }
  const stamp = board(page).locator('.spread-stamp-hit[data-stamp="foshan"]');
  await stamp.hover();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'hovering');
  await expect.poll(() => canvas(page).evaluate(element => Math.max(0, ...element.__stampSettingsGL.activity))).toBeGreaterThan(.05);
  await stampControls(page).getByRole('button', { name: '聚焦当前邮票', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await stampControls(page).getByRole('button', { name: '返回本组邮票', exact: true }).click();
  await expect(board(page)).not.toHaveAttribute('data-stamp-phase', 'focused');
  expect(await originalCanvas.evaluate(node => node === document.querySelector('#spreadPlaceCard canvas'))).toBe(true);
  expect(await stored(page)).toEqual(baseline);
  await discard(page);
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'local-add');
  expect(await stored(page)).toEqual(baseline);
  expect(errors).toEqual([]);
});

test('原v2 JSON粘贴即时预览，保存继续编辑，取消恢复最近保存基线并可刷新', async ({ page }) => {
  const errors = await prepare(page);
  const baseline = await stored(page);
  await open(page);
  const edited = { ...DEFAULT_PARAMETERS, lightAlgorithm: 'screen', hoverTilt: 11.5, lightIntensity: .63, focusX: .479, lightColor: '#abd4ef' };
  await paste(page, serializeParameters(edited));
  await expect(stampControls(page).getByRole('spinbutton', { name: '悬停偏转数值', exact: true })).toHaveValue('11.5');
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'screen');
  expect(await stored(page)).toEqual(baseline);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  const saved = await stored(page);
  expect(saved).toMatchObject({ stampLightAlgorithm: 'screen', stampHoverTilt: 11.5, stampLightIntensity: .63, stampFocusX: .479, stampLightColor: '#abd4ef', headerTransparency: 37 });
  await number(page, '光影强度', 1.37);
  expect(await stored(page)).toEqual(saved);
  await discard(page);
  expect(await stored(page)).toEqual(saved);
  await page.reload();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 90_000 });
  await open(page);
  await expect(stampControls(page).getByRole('spinbutton', { name: '光影强度数值', exact: true })).toHaveValue('0.63');
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'screen');
  await expect(panel(page).locator('.developer-settings-footer > p')).toContainText('当前参数已保存');
  await discard(page);
  expect(errors).toEqual([]);
});

test('原参数文件导入、复制、邮票导出和全站导出往返，不提交未保存预览', async ({ page }) => {
  const errors = await prepare(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const baseline = await stored(page);
  await open(page);
  const edited = { ...DEFAULT_PARAMETERS, lightAlgorithm: 'luminance', pinLight: true, lightIntensity: .74, lightAnimation: false, textureScale: 1.85, focusX: .479 };
  await stampControls(page).getByLabel('导入邮票参数 JSON 文件', { exact: true }).setInputFiles({ name: 'original-regional-parameters.json', mimeType: 'application/json', buffer: Buffer.from(serializeParameters(edited)) });
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'luminance');
  const postal = await download(page, '导出邮票参数');
  expect(parseParameters(JSON.stringify(postal))).toEqual(edited);
  const whole = await download(page, '导出当前参数');
  expect(whole).toMatchObject({ format: 'nanfeng-lion-settings', state: 'unsaved-preview', settings: { stampLightIntensity: .74, stampLightAlgorithm: 'luminance', stampTextureScale: 1.85, headerTransparency: 37 } });
  await stampControls(page).getByRole('button', { name: '复制邮票参数', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('"version": 2');
  expect(parseParameters(await page.evaluate(() => navigator.clipboard.readText()))).toEqual(edited);
  await paste(page, '{"version":99,"parameters":{}}');
  await expect(stampControls(page).locator('.developer-settings-feedback[role="status"]')).toContainText('v1 或 v2');
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'luminance');
  expect(await stored(page)).toEqual(baseline);
  await discard(page);
  expect(await stored(page)).toEqual(baseline);
  expect(errors).toEqual([]);
});

test('预设只替换光影参数，分组和全部邮票重置均只预览并保留其他页面参数', async ({ page }) => {
  const errors = await prepare(page);
  const baseline = await stored(page);
  await open(page);
  await number(page, '悬停偏转', 9);
  await stampControls(page).getByRole('combobox', { name: '光影预设', exact: true }).selectOption('soft-light');
  await expect(stampControls(page).getByRole('spinbutton', { name: '悬停偏转数值', exact: true })).toHaveValue('9');
  await expect(stampControls(page).getByRole('spinbutton', { name: '暖光明暗强度数值', exact: true })).toHaveValue('0.42');
  await number(page, '暖光明暗强度', .8);
  await expect(stampControls(page).locator('[data-preset-state]')).toContainText('已微调');
  await stampControls(page).getByRole('button', { name: '恢复此光影预设', exact: true }).click();
  await expect(stampControls(page).getByRole('spinbutton', { name: '暖光明暗强度数值', exact: true })).toHaveValue('0.42');
  await stampControls(page).getByRole('button', { name: '重置指针与悬停', exact: true }).click();
  await expect(stampControls(page).getByRole('spinbutton', { name: '悬停偏转数值', exact: true })).toHaveValue('6');
  await stampControls(page).getByRole('button', { name: '恢复全部邮票默认参数', exact: true }).click();
  expect(parseParameters(JSON.stringify(await download(page, '导出邮票参数')))).toEqual(DEFAULT_PARAMETERS);
  expect(await stored(page)).toEqual(baseline);
  await panel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  expect(await stored(page)).toMatchObject({ headerTransparency: 37, stampHoverTilt: 6, stampLightAlgorithm: 'local-add' });
  await discard(page);
  expect(errors).toEqual([]);
});

test('文件读取迟到于取消时不会重开设置、改变画布或污染浏览器存储', async ({ page }) => {
  const errors = await prepare(page);
  await page.evaluate(() => {
    const native = File.prototype.text;
    File.prototype.text = function() {
      if (this.name !== 'delayed-stamp-import.json') return Reflect.apply(native, this, []);
      return new Promise(resolve => { window.__finishStampImport = async () => { const result = await Reflect.apply(native, this, []); resolve(result); window.__stampImportResolved = true; }; });
    };
  });
  const baseline = await stored(page);
  await open(page);
  await stampControls(page).getByLabel('导入邮票参数 JSON 文件', { exact: true }).setInputFiles({ name: 'delayed-stamp-import.json', mimeType: 'application/json',
    buffer: Buffer.from(serializeParameters({ ...DEFAULT_PARAMETERS, lightAlgorithm: 'luminance', lightIntensity: .31 })) });
  await expect.poll(() => page.evaluate(() => typeof window.__finishStampImport)).toBe('function');
  await discard(page);
  await page.evaluate(() => window.__finishStampImport());
  await expect.poll(() => page.evaluate(() => window.__stampImportResolved)).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-light-algorithm', 'local-add');
  await expect(panel(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(baseline);
  expect(errors).toEqual([]);
});
