import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Execute the production controller without React. The media double controls
// the native hidden -> pause -> ended ordering that a real browser can race.
const source = readFileSync(new URL('../../src/features/action/useTheaterPlayback.js', import.meta.url), 'utf8');
const controllerSource = source.slice(source.indexOf('const initialView'), source.indexOf('export function useTheaterPlayback'));

function playback() {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const createController = vm.runInNewContext(`${controllerSource}\ncreatePlaybackController;`, {
    document, queueMicrotask, getMediaVolumePreference: () => .25, isAudioUnlockGesture: () => false,
  });
  const ended = [];
  const config = { ids: new Set(['tanqing', 'doumao']), activeId: 'tanqing', enabled: true, flatMode: false,
    sequenceActive: true, playingIntent: true, audioEnabled: false, volume: .25, onEnded: id => ended.push(id) };
  const controller = createController(() => {}, () => {}, () => {}, Number, config);
  const video = Object.assign(new EventTarget(), {
    isConnected: true, paused: true, ended: false, currentTime: 0, duration: 8, playCalls: 0,
    play() { this.playCalls += 1; this.paused = false; this.ended = false; },
    pause() { this.paused = true; }, removeAttribute() {}, load() {},
  });
  const binding = controller.bindVideo('tanqing');
  binding.ref(video);
  controller.mount();
  const visibility = hidden => { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); };
  const finishWhileHidden = () => {
    visibility(true);
    video.currentTime = video.duration;
    video.ended = true;
    binding.onEnded({ currentTarget: video });
  };
  return { controller, config, video, binding, ended, visibility, finishWhileHidden };
}

test('native ended after hidden is consumed once on returning, without replaying the finished clip', () => {
  const state = playback();
  state.finishWhileHidden();
  assert.deepEqual(state.ended, []);
  state.visibility(false);
  assert.deepEqual(state.ended, ['tanqing']);
  assert.equal(state.video.playCalls, 1);
  assert.equal(state.video.paused, true);
  state.visibility(false);
  state.binding.onEnded({ currentTarget: state.video });
  assert.deepEqual(state.ended, ['tanqing']);
  state.controller.unmount();
});

test('explicit pause keeps a pending end paused until the user resumes', () => {
  const state = playback();
  state.finishWhileHidden();
  state.controller.pause();
  state.visibility(false);
  assert.deepEqual(state.ended, []);
  assert.equal(state.video.paused, true);
  assert.equal(state.video.playCalls, 1);
  state.controller.togglePlayback();
  assert.deepEqual(state.ended, ['tanqing']);
  state.controller.unmount();
});

test('a native end arriving after explicit pause also waits for a new play gesture', () => {
  const state = playback();
  state.controller.pause();
  state.finishWhileHidden();
  state.visibility(false);
  assert.deepEqual(state.ended, []);
  assert.equal(state.video.playCalls, 1);
  state.controller.togglePlayback();
  assert.deepEqual(state.ended, ['tanqing']);
  state.controller.unmount();
});

for (const cancel of ['stop', 'screen', 'unmount']) {
  test(`${cancel} cancels a hidden end before the same screen becomes active again`, () => {
    const state = playback();
    state.finishWhileHidden();
    if (cancel === 'stop') state.controller.configure({ ...state.config, sequenceActive: false });
    if (cancel === 'screen') state.controller.configure({ ...state.config, activeId: 'doumao' });
    if (cancel === 'unmount') state.controller.unmount();
    state.controller.configure(state.config);
    state.visibility(false);
    if (cancel === 'unmount') state.controller.mount();
    assert.deepEqual(state.ended, []);
    state.controller.unmount();
  });
}
