import test from 'node:test';
import assert from 'node:assert/strict';
import { actionSpatialDefaults, actionSpatialRanges, resolveActionSpatialSettings, getActionSpatialConfig } from '../../src/config/actionSpatialSettings.js';
import { defaultDeveloperSettings, normalizeDeveloperSetting } from '../../src/features/developer-settings/useDeveloperSettings.js';

test('空间渐变参数对旧偏好补默认，保留独立外观/HDRI与人类单位', () => {
  assert.deepEqual(actionSpatialDefaults, {
    actionUiFadeInMs: 380, actionUiFadeOutMs: 320, actionUiEdgeZone: 12,
    actionUiInteractionOpacity: 35, actionUiHysteresis: 7, actionUiOpacity: 100, actionUiScale: 100,
  });
  const existing = { headerTransparency: 37, hdriIntensity: 1.5, actionUiFadeInMs: 610, actionUiScale: 115 };
  const snapshot = { ...existing };
  const resolved = resolveActionSpatialSettings(existing);
  assert.deepEqual(existing, snapshot);
  assert.equal(resolved.actionUiFadeInMs, 610);
  assert.equal(resolved.actionUiScale, 115);
  assert.equal(resolved.actionUiFadeOutMs, 320);
  for (const [name, value] of Object.entries(actionSpatialDefaults)) {
    assert.equal(defaultDeveloperSettings[name], value);
    for (const invalid of [undefined, null, NaN, Infinity, -Infinity, '600', {}, []]) {
      assert.equal(normalizeDeveloperSetting(name, invalid), value, `${name}: invalid persisted input`);
      assert.equal(resolveActionSpatialSettings({ [name]: invalid })[name], value);
    }
  }
  assert.equal(normalizeDeveloperSetting('headerTransparency', 37), 37);
  assert.equal(normalizeDeveloperSetting('hdriIntensity', 1.5), 1.5);
  assert.deepEqual(getActionSpatialConfig(), {
    fadeInMs: 380, fadeOutMs: 320, edgeZone: .12, interactionOpacity: .35,
    hysteresisDegrees: 7, opacity: 1, scale: 1,
  });
});

test('公开空间参数精确限制范围和步长，转换后的比例可直接用于渲染帧', () => {
  for (const [name, [min, max, step]] of Object.entries(actionSpatialRanges)) {
    assert.equal(normalizeDeveloperSetting(name, min - 1000), min);
    assert.equal(normalizeDeveloperSetting(name, max + 1000), max);
    assert.equal(resolveActionSpatialSettings({ [name]: min - 1000 })[name], min);
    assert.equal(resolveActionSpatialSettings({ [name]: max + 1000 })[name], max);
    for (let i = 0; i <= Math.round((max - min) / step); i++) {
      const value = Number((min + i * step).toFixed(2));
      assert.equal(normalizeDeveloperSetting(name, value), value, `${name}: ${value}`);
      assert.equal(resolveActionSpatialSettings({ [name]: value })[name], value);
    }
  }
  assert.deepEqual(getActionSpatialConfig({
    actionUiFadeInMs: 250, actionUiFadeOutMs: 700, actionUiEdgeZone: 25,
    actionUiInteractionOpacity: 70, actionUiHysteresis: 10.5, actionUiOpacity: 75, actionUiScale: 125,
  }), {
    fadeInMs: 250, fadeOutMs: 700, edgeZone: .25, interactionOpacity: .7,
    hysteresisDegrees: 10.5, opacity: .75, scale: 1.25,
  });
});
