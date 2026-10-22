import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIDEO_VOLUME, normalizeMediaVolume } from '../../src/config/playback.js';

let fixtureRevision = 0;
async function sessionAudio(entries = {}, { blocked = false } = {}) {
  const values = new Map(Object.entries(entries));
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      if (blocked) throw new Error('storage unavailable');
      values.set(key, String(value));
    },
  };
  const store = await import(`../../src/hooks/useMediaAudioPreference.js?volume-test=${++fixtureRevision}`);
  return { store, values };
}

const audioKey = 'nanfeng-lion:media-audio:v1';
const volumeKey = 'nanfeng-lion:media-volume:v1';
const previousKey = 'nanfeng-lion:media-volume:last-nonzero:v1';

test('media volume clamps native limits, rounds to one percent and defaults invalid values', () => {
  assert.equal(DEFAULT_VIDEO_VOLUME, .25);
  for (const value of [undefined, null, '', ' ', 'invalid', NaN, Infinity, {}, true]) {
    assert.equal(normalizeMediaVolume(value), .25);
  }
  assert.equal(normalizeMediaVolume(-2), 0);
  assert.equal(normalizeMediaVolume(4), 1);
  assert.equal(normalizeMediaVolume('0.678'), .68);
  assert.equal(normalizeMediaVolume(0), 0);
});

test('session audio preserves explicit mute and nonzero loudness, zero restores the latest audible level', async () => {
  const { store, values } = await sessionAudio({ [audioKey]: 'muted', [volumeKey]: '.42' });
  assert.equal(store.getMediaVolumePreference(), .42);
  store.setMediaAudioPreference(true);
  assert.equal(values.get(audioKey), 'enabled');
  assert.equal(store.getMediaVolumePreference(), .42);
  store.setMediaAudioPreference(false);
  assert.equal(values.get(audioKey), 'muted');
  assert.equal(store.getMediaVolumePreference(), .42);
  assert.equal(store.setMediaVolumePreference(.7), .7);
  assert.equal(values.get(audioKey), 'enabled');
  assert.equal(values.get(previousKey), '0.7');
  store.setMediaVolumePreference(0);
  assert.equal(values.get(volumeKey), '0');
  assert.equal(values.get(audioKey), 'muted');
  store.setMediaAudioPreference(true);
  assert.equal(store.getMediaVolumePreference(), .7);
  assert.equal(values.get(volumeKey), '0.7');
  store.setMediaAudioPreference(false);
  const refreshed = await sessionAudio(Object.fromEntries(values));
  assert.equal(refreshed.store.getMediaVolumePreference(), .7);
  assert.equal(refreshed.values.get(audioKey), 'muted');
});

test('zero-volume reload and unavailable session storage retain a usable nonzero unmute level', async () => {
  const zero = await sessionAudio({ [volumeKey]: '0', [previousKey]: '.63', [audioKey]: 'muted' });
  assert.equal(zero.store.getMediaVolumePreference(), 0);
  zero.store.setMediaAudioPreference(true);
  assert.equal(zero.store.getMediaVolumePreference(), .63);
  const corrupt = await sessionAudio({ [volumeKey]: 'bad', [previousKey]: '0' });
  assert.equal(corrupt.store.getMediaVolumePreference(), .25);
  const memory = await sessionAudio({}, { blocked: true });
  memory.store.setMediaVolumePreference(.73);
  memory.store.setMediaVolumePreference(0);
  assert.doesNotThrow(() => memory.store.setMediaAudioPreference(true));
  assert.equal(memory.store.getMediaVolumePreference(), .73);
});
