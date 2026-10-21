import test from 'node:test';
import assert from 'node:assert/strict';
import { hdriDefaults, hdriRanges } from '../../src/config/hdri.js';
import { defaultDeveloperSettings, normalizeDeveloperSetting, restoreDeveloperSettings } from '../../src/features/developer-settings/useDeveloperSettings.js';
import { viewDefaults, viewRanges } from '../../src/config/viewSettings.js';
import { snapSettingsRange } from '../../src/features/developer-settings/rangeSettings.js';

test('HDRI settings default missing saved fields while preserving existing controls', () => {
  assert.deepEqual(hdriDefaults, {
    hdriEnabled: true, hdriIntensity: 1, hdriRotation: 0, hdriExposure: 0, hdriLightIntensity: 0.35,
    hdriSource: 'forest', hdriUrl: '', hdriFile: null,
  });
  for (const [name,value] of Object.entries(hdriDefaults)) {
    assert.equal(defaultDeveloperSettings[name], value);
    assert.equal(normalizeDeveloperSetting(name, undefined), value);
    assert.equal(normalizeDeveloperSetting(name, null), value);
    if (name !== 'hdriUrl') assert.equal(normalizeDeveloperSetting(name, '1'), value);
  }
  assert.equal(normalizeDeveloperSetting('hdriEnabled', false), false);
  assert.equal(normalizeDeveloperSetting('hdriEnabled', 0), true);
  assert.equal(normalizeDeveloperSetting('headerBlur', 23), 23);
  assert.equal(normalizeDeveloperSetting('carouselAutoplay', false), false);
  assert.equal(normalizeDeveloperSetting('unrecognizedSetting', 1), undefined);
});

test('view boundaries migrate missing fields, clamp extremes and preserve saved choices', () => {
  const restored = restoreDeveloperSettings({ headerBlur: 23, hdriLightIntensity: 1, structureMinDistanceRatio: .7, actionMaxPolarAngle: 165 });
  assert.equal(restored.headerBlur, 23);
  assert.equal(restored.hdriLightIntensity, 1);
  assert.equal(restored.structureMinDistanceRatio, .7);
  assert.equal(restored.actionMaxPolarAngle, 165);
  for (const [name, [min, max]] of Object.entries(viewRanges)) {
    assert.equal(normalizeDeveloperSetting(name, undefined), viewDefaults[name]);
    assert.equal(normalizeDeveloperSetting(name, -1000), min);
    assert.equal(normalizeDeveloperSetting(name, 1000), max);
  }
});

test('HDRI source restores persistent presets and URLs while excluding stale local files', () => {
  assert.equal(normalizeDeveloperSetting('hdriSource', 'forest'), 'forest');
  assert.equal(normalizeDeveloperSetting('hdriUrl', ' https://example.com/forest.exr '), 'https://example.com/forest.exr');
  for (const value of ['javascript:alert(1)', 'file:///forest.exr', 'data:application/octet-stream;base64,', 'blob:old-session', 'ftp://server/forest.exr']) {
    assert.equal(normalizeDeveloperSetting('hdriUrl', value), '');
  }
  const restored = restoreDeveloperSettings({ hdriSource: 'local', hdriFile: { name: 'forest.exr' }, hdriUrl: '/assets/environments/forest.exr' });
  assert.equal(restored.hdriFile, null);
  assert.equal(restored.hdriSource, 'forest');
  assert.equal(restored.hdriUrl, '/assets/environments/forest.exr');
  assert.equal(restoreDeveloperSettings({ hdriSource: 'url', hdriUrl: 'https://example.com/forest.hdr' }).hdriSource, 'url');
});

test('HDRI numeric controls clamp unsafe persisted values and snap every supported step exactly', () => {
  for (const [name,[min,max,step]] of Object.entries(hdriRanges)) {
    for (const invalid of [NaN, Infinity, -Infinity, {}, []]) {
      assert.equal(normalizeDeveloperSetting(name, invalid), hdriDefaults[name], `${name}: invalid ${String(invalid)}`);
    }
    assert.equal(normalizeDeveloperSetting(name, min - 1000), min);
    assert.equal(normalizeDeveloperSetting(name, max + 1000), max);
    for (let index = 0; index <= Math.round((max - min) / step); index++) {
      const expected = Number((min + index * step).toFixed(2));
      assert.equal(normalizeDeveloperSetting(name, expected), expected, `${name}: ${expected}`);
      assert.equal(snapSettingsRange(expected, min, max, step), expected);
    }
  }
  assert.equal(normalizeDeveloperSetting('hdriIntensity', .149), .15);
  assert.equal(normalizeDeveloperSetting('hdriLightIntensity', 1.249), 1.25);
  assert.equal(normalizeDeveloperSetting('hdriExposure', -.149), -.1);
  assert.equal(normalizeDeveloperSetting('hdriRotation', 27.6), 28);
  assert.equal(snapSettingsRange(1025, 300, 1600, 50), 1050);
});
