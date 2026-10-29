import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExpressionDepthSettings } from '../../src/config/expressionDepthSettings.js';
import { createSettingsExport, normalizeDeveloperSetting, restoreDeveloperSettings } from '../../src/features/developer-settings/useDeveloperSettings.js';

const depthNames = [
  'expressionTourMoveDuration', 'expressionTourReadingDuration', 'expressionDepthImageScale',
  'expressionDepthTextScale', 'expressionDepthMarkerSize', 'expressionDepthPointerStrength', 'expressionDepthWheelSpeed',
];
const pickDepth = settings => Object.fromEntries(depthNames.map(name => [name, settings[name]]));

test('older saved settings gain the eight-state depth defaults without losing other preferences', () => {
  const restored = restoreDeveloperSettings({ expressionOverviewFontSize: 27, expressionDetailFontSize: 19, expressionClickScale: 112 });
  assert.deepEqual(pickDepth(restored), {
    expressionTourMoveDuration: 6, expressionTourReadingDuration: 12, expressionDepthImageScale: 100,
    expressionDepthTextScale: 100, expressionDepthMarkerSize: 40, expressionDepthPointerStrength: 100, expressionDepthWheelSpeed: 100,
  });
  assert.equal(restored.expressionOverviewFontSize, 27);
  assert.equal(restored.expressionDetailFontSize, 19);
  assert.equal(restored.expressionClickScale, 112);
});

test('depth slider values reject non-numeric input and snap or clamp to their supported intervals', () => {
  assert.equal(normalizeDeveloperSetting('expressionTourMoveDuration', '8'), 6);
  assert.equal(normalizeDeveloperSetting('expressionTourReadingDuration', NaN), 12);
  assert.equal(normalizeDeveloperSetting('expressionDepthImageScale', Infinity), 100);
  assert.equal(normalizeDeveloperSetting('expressionDepthTextScale', null), 100);
  assert.equal(normalizeDeveloperSetting('expressionDepthMarkerSize', false), 40);
  assert.equal(normalizeDeveloperSetting('expressionTourMoveDuration', 6.24), 6);
  assert.equal(normalizeDeveloperSetting('expressionTourMoveDuration', 6.26), 6.5);
  assert.equal(normalizeDeveloperSetting('expressionTourReadingDuration', 11.6), 12);
  assert.equal(normalizeDeveloperSetting('expressionDepthImageScale', 101), 100);
  assert.equal(normalizeDeveloperSetting('expressionDepthTextScale', 138), 140);
  assert.equal(normalizeDeveloperSetting('expressionDepthMarkerSize', 43), 44);
  assert.equal(normalizeDeveloperSetting('expressionDepthPointerStrength', -1), 0);
  assert.equal(normalizeDeveloperSetting('expressionDepthWheelSpeed', 201), 200);
});

test('saved depth values are validated before restoration and survive the existing settings export', () => {
  const restored = restoreDeveloperSettings({
    expressionTourMoveDuration: -3, expressionTourReadingDuration: 100, expressionDepthImageScale: 69,
    expressionDepthTextScale: 141, expressionDepthMarkerSize: 80, expressionDepthPointerStrength: 0, expressionDepthWheelSpeed: 40,
  });
  const expected = {
    expressionTourMoveDuration: 2, expressionTourReadingDuration: 60, expressionDepthImageScale: 70,
    expressionDepthTextScale: 140, expressionDepthMarkerSize: 72, expressionDepthPointerStrength: 0, expressionDepthWheelSpeed: 50,
  };
  assert.deepEqual(pickDepth(restored), expected);
  const exported = createSettingsExport(restored, true, new Date('2026-10-28T00:00:00Z'));
  assert.deepEqual(pickDepth(exported.settings), expected);
  assert.equal(exported.state, 'unsaved-preview');
});

test('the runtime resolver fills invalid or missing values and keeps only depth parameters', () => {
  const fallback = {
    expressionTourMoveDuration: 6, expressionTourReadingDuration: 12, expressionDepthImageScale: 100,
    expressionDepthTextScale: 100, expressionDepthMarkerSize: 40, expressionDepthPointerStrength: 100, expressionDepthWheelSpeed: 100,
  };
  assert.deepEqual(resolveExpressionDepthSettings(null), fallback);
  assert.deepEqual(resolveExpressionDepthSettings({
    expressionTourMoveDuration: '8', expressionTourReadingDuration: NaN, expressionDepthImageScale: Infinity,
    expressionDepthTextScale: null, expressionDepthMarkerSize: false, expressionDepthPointerStrength: undefined,
    expressionDepthWheelSpeed: -Infinity, unrelated: 7,
  }), fallback);
  const input = Object.freeze({ expressionTourMoveDuration: 6.26, expressionDepthPointerStrength: 0, unrelated: 7 });
  assert.deepEqual(resolveExpressionDepthSettings(input), { ...fallback, expressionTourMoveDuration: 6.5, expressionDepthPointerStrength: 0 });
  assert.equal(input.expressionTourMoveDuration, 6.26);
});

test('the runtime resolver bounds every depth parameter at both supported limits', () => {
  assert.deepEqual(resolveExpressionDepthSettings(Object.fromEntries(depthNames.map(name => [name, -1000]))), {
    expressionTourMoveDuration: 2, expressionTourReadingDuration: 3, expressionDepthImageScale: 70,
    expressionDepthTextScale: 80, expressionDepthMarkerSize: 24, expressionDepthPointerStrength: 0, expressionDepthWheelSpeed: 50,
  });
  assert.deepEqual(resolveExpressionDepthSettings(Object.fromEntries(depthNames.map(name => [name, 1000]))), {
    expressionTourMoveDuration: 20, expressionTourReadingDuration: 60, expressionDepthImageScale: 130,
    expressionDepthTextScale: 140, expressionDepthMarkerSize: 72, expressionDepthPointerStrength: 150, expressionDepthWheelSpeed: 200,
  });
});
