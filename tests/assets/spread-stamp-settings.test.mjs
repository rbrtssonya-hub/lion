import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PARAMETERS, LIGHT_PRESETS, LIGHT_PRESET_KEYS, PARAMETER_FIELDS,
  applyLightPreset, isLightPresetModified, normalizeParameters, parseParameters, serializeParameters,
  spreadStampDefaults, spreadStampRanges, spreadStampSettingKey, spreadStampSettingsForParameters,
  resolveSpreadStampParameters } from '../../src/config/spreadStampSettings.js';
import { createSettingsExport, normalizeDeveloperSetting, restoreDeveloperSettings } from '../../src/features/developer-settings/useDeveloperSettings.js';

test('邮票原52项参数完整映射到独立持久设置，旧全站偏好补齐默认且不覆盖其他参数', () => {
  assert.equal(PARAMETER_FIELDS.length, 52);
  assert.equal(Object.keys(spreadStampDefaults).length, 52);
  assert.equal(new Set(PARAMETER_FIELDS.map(field => spreadStampSettingKey(field.key))).size, 52);
  assert.deepEqual(resolveSpreadStampParameters(spreadStampDefaults), DEFAULT_PARAMETERS);
  const restored = restoreDeveloperSettings({ headerTransparency: 37, panelWidth: 520, carouselAutoplay: false });
  assert.equal(restored.headerTransparency, 37);
  assert.equal(restored.panelWidth, 520);
  assert.equal(restored.carouselAutoplay, false);
  assert.deepEqual(resolveSpreadStampParameters(restored), DEFAULT_PARAMETERS);
  assert.equal(normalizeDeveloperSetting('stampUnsupportedUniform', 1), undefined);
});

test('邮票全部数字、开关、颜色、算法逐字段白名单限幅，保留源参数精度', () => {
  for (const field of PARAMETER_FIELDS) {
    const name = spreadStampSettingKey(field.key);
    assert.equal(normalizeDeveloperSetting(name, undefined), field.value, name);
    assert.equal(normalizeDeveloperSetting(name, {}), field.value, name);
    if (field.type === 'number') {
      assert.deepEqual(spreadStampRanges[name], [field.min, field.max, field.step]);
      assert.equal(normalizeDeveloperSetting(name, field.min - 100), field.min, name);
      assert.equal(normalizeDeveloperSetting(name, field.max + 100), field.max, name);
      for (const invalid of [NaN, Infinity, -Infinity, '1']) assert.equal(normalizeDeveloperSetting(name, invalid), field.value, name);
    } else if (field.type === 'boolean') {
      assert.equal(normalizeDeveloperSetting(name, !field.value), !field.value, name);
      assert.equal(normalizeDeveloperSetting(name, 0), field.value, name);
    } else if (field.type === 'color') {
      assert.equal(normalizeDeveloperSetting(name, '#A1B2C3'), '#a1b2c3', name);
      assert.equal(normalizeDeveloperSetting(name, 'url(https://example.com)'), field.value, name);
    } else assert.equal(normalizeDeveloperSetting(name, 'not-a-preset'), field.value, name);
  }
  assert.equal(normalizeDeveloperSetting('stampFocusX', .479), .479);
  assert.equal(resolveSpreadStampParameters({ stampFocusX: .479 }).focusX, .479);
});

test('六种光影算法ID与GPU索引稳定，应用预设不修改指针、聚焦、纸色和流动偏好', () => {
  assert.deepEqual(LIGHT_PRESETS.map(preset => [preset.id, preset.index]), [
    ['legacy-multiply', 0], ['local-add', 1], ['screen', 2], ['soft-light', 3], ['diffuse-transmission', 4], ['luminance', 5],
  ]);
  const before = { ...DEFAULT_PARAMETERS, hoverTilt: 12, focusX: .491, lightAnimation: false, backgroundColor: '#fff0e1' };
  for (const preset of LIGHT_PRESETS) {
    const result = applyLightPreset(before, preset.id);
    assert.equal(result.lightAlgorithm, preset.id);
    for (const field of PARAMETER_FIELDS.filter(field => !LIGHT_PRESET_KEYS.includes(field.key))) assert.equal(result[field.key], before[field.key], field.key);
    assert.equal(isLightPresetModified(result), false);
    assert.equal(isLightPresetModified({ ...result, lightIntensity: .315 }), true);
    assert.deepEqual(parseParameters(serializeParameters(result)), result);
  }
});

test('原v2邮票JSON与全站未保存导出均保留52参数，导入不接受任意uniform字段', () => {
  const edited = { ...DEFAULT_PARAMETERS, lightAlgorithm: 'screen', lightIntensity: .63, hoverTilt: 11.5,
    lightColor: '#abceef', focusX: .479, pinLight: true, lightAnimation: false };
  const sourceExport = JSON.parse(serializeParameters(edited));
  assert.equal(sourceExport.version, 2);
  assert.equal(sourceExport.appearanceRevision, 4);
  assert.equal(Object.keys(sourceExport.parameters).length, 52);
  assert.deepEqual(parseParameters(JSON.stringify(sourceExport)), edited);
  const restored = restoreDeveloperSettings({ ...spreadStampSettingsForParameters(edited), headerHeight: 120 });
  const whole = createSettingsExport(restored, true, new Date('2026-10-28T00:00:00Z'));
  assert.equal(whole.state, 'unsaved-preview');
  assert.equal(whole.settings.headerHeight, 120);
  assert.deepEqual(resolveSpreadStampParameters(whole.settings), edited);
  const poisoned = normalizeParameters({ ...edited, extraUniform: 99, __proto__: { lightIntensity: 1.99 } });
  assert.deepEqual(poisoned, edited);
  assert.equal(Object.hasOwn(poisoned, 'extraUniform'), false);
  assert.equal(Object.hasOwn(poisoned, '__proto__'), false);
  for (const invalid of ['{}', '{"version":99,"parameters":{}}', '{"version":2,"parameters":[]}', '{"version":2,"parameters":null}']) {
    assert.throws(() => parseParameters(invalid));
  }
});

test('原v1外观迁移保留交互编辑，revision4缺少算法时只补当前算法', () => {
  const legacy = parseParameters(JSON.stringify({ version: 1, parameters: { hoverTilt: 13, lightIntensity: .07, textureScale: 2.1 } }));
  assert.equal(legacy.hoverTilt, 13);
  assert.equal(legacy.lightIntensity, DEFAULT_PARAMETERS.lightIntensity);
  assert.equal(legacy.textureScale, DEFAULT_PARAMETERS.textureScale);
  const modern = parseParameters(JSON.stringify({ version: 2, appearanceRevision: 4,
    parameters: { hoverTilt: 13, lightIntensity: .07, textureScale: 2.1 } }));
  assert.equal(modern.hoverTilt, 13);
  assert.equal(modern.lightIntensity, .07);
  assert.equal(modern.textureScale, 2.1);
  assert.equal(modern.lightAlgorithm, 'local-add');
});
