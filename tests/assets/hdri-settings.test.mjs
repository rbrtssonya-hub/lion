import test from 'node:test';
import assert from 'node:assert/strict';
import { hdriDefaults, hdriRanges } from '../../src/config/hdri.js';
import { defaultDeveloperSettings, normalizeDeveloperSetting, restoreDeveloperSettings } from '../../src/features/developer-settings/useDeveloperSettings.js';
import { resolveViewSettings, viewDefaults, viewRanges } from '../../src/config/viewSettings.js';
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
  assert.equal(restored.actionMaxPolarAngle, 90);
  for (const [name, [min, max]] of Object.entries(viewRanges)) {
    assert.equal(normalizeDeveloperSetting(name, undefined), viewDefaults[name]);
    assert.equal(normalizeDeveloperSetting(name, -1000), min);
    assert.equal(normalizeDeveloperSetting(name, 1000), max);
  }
});

test('动作四项视角阈值采用指定范围，旧保存值限幅且保持初始取景', () => {
  assert.deepEqual(viewRanges.actionMaxDistance, [3, 9, .5]);
  assert.deepEqual(viewRanges.actionMinDistance, [3, 6, .1]);
  assert.deepEqual(viewRanges.actionMinPolarAngle, [0, 20, 1]);
  assert.deepEqual(viewRanges.actionMaxPolarAngle, [60, 90, 1]);
  assert.deepEqual(resolveViewSettings({ actionMinDistance: 1, actionMaxDistance: 30, actionMinPolarAngle: 89, actionMaxPolarAngle: 179 }), {
    ...viewDefaults, actionMinDistance: 3, actionMaxDistance: 9, actionMinPolarAngle: 20, actionMaxPolarAngle: 90,
  });
  assert.ok(viewDefaults.actionMaxDistance > Math.hypot(8.6, 1.6 - 1.45), 'the authored initial camera remains inside the default far limit');
  assert.deepEqual(resolveViewSettings({ actionMinDistance: 4.2, actionMaxDistance: 7.5, actionMinPolarAngle: 10, actionMaxPolarAngle: 75 }), {
    ...viewDefaults, actionMinDistance: 4.2, actionMaxDistance: 7.5, actionMinPolarAngle: 10, actionMaxPolarAngle: 75,
  });
});

test('动作远近距离交叉时保留最新调整并遵守各自步长', () => {
  const nearChanged = resolveViewSettings({ actionMinDistance: 5.1, actionMaxDistance: 4 }, 'actionMinDistance');
  assert.equal(nearChanged.actionMinDistance, 5.1);
  assert.equal(nearChanged.actionMaxDistance, 5.5);
  const farChanged = resolveViewSettings({ actionMinDistance: 6, actionMaxDistance: 3.5 }, 'actionMaxDistance');
  assert.equal(farChanged.actionMinDistance, 3.5);
  assert.equal(farChanged.actionMaxDistance, 3.5);
  const restored = restoreDeveloperSettings({ actionMinDistance: 8, actionMaxDistance: 2, actionMinPolarAngle: 80, actionMaxPolarAngle: 179, headerBlur: 23 });
  assert.equal(restored.actionMinDistance, 6);
  assert.equal(restored.actionMaxDistance, 6);
  assert.equal(restored.actionMinPolarAngle, 20);
  assert.equal(restored.actionMaxPolarAngle, 90);
  assert.equal(restored.headerBlur, 23);
  for (let near = 3; near <= 6; near = Number((near + .1).toFixed(1))) {
    for (let far = 3; far <= 9; far += .5) {
      for (const name of [undefined, 'actionMinDistance', 'actionMaxDistance']) {
        const resolved = resolveViewSettings({ actionMinDistance: near, actionMaxDistance: far }, name);
        assert.ok(resolved.actionMinDistance <= resolved.actionMaxDistance, `${near}/${far}/${name}`);
        assert.ok(resolved.actionMinDistance >= 3 && resolved.actionMinDistance <= 6);
        assert.ok(resolved.actionMaxDistance >= 3 && resolved.actionMaxDistance <= 9);
        assert.equal(resolved.actionMaxDistance * 2 % 1, 0);
      }
    }
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
