import assert from 'node:assert/strict';
import test from 'node:test';

const gameFiles = {
  rhythm: '../../src/features/mini-games/rhythmGame.js',
  poles: '../../src/features/mini-games/poleGame.js',
};

async function session(mode, sound = () => {}) {
  const module = await import(gameFiles[mode]);
  const results = [];
  let hud;
  const create = mode === 'rhythm' ? module.createRhythmGame : module.createPoleGame;
  const game = create({ onComplete: result => results.push(result), onHUD: value => { hud = value; }, sound, art: {} });
  let time = 0;
  function advance(seconds) {
    for (let left = seconds; left > 1e-9;) {
      const dt = Math.min(left, 1 / 120);
      game.update(dt);
      time += dt;
      left -= dt;
    }
  }
  return {
    game, results, advance,
    get hud() { return hud; },
    to(target) { advance(Math.max(0, target - time)); },
    tap() { game.keydown('Space'); game.keyup('Space'); },
    jump(seconds, pointer = false) {
      if (pointer) game.pointerdown({ x: 600, y: 450 });
      else game.keydown('Space');
      advance(seconds);
      if (pointer) game.pointerup({ x: 600, y: 450 });
      else game.keyup('Space');
      advance(1.9);
    },
  };
}

function stat(result, label) { return result.stats.find(entry => entry.label === label)?.value; }

test('rhythm: eighteen accurate beats collect greens on hit twelve and settle once at 25 seconds', async () => {
  const run = await session('rhythm');
  const beats = [4, 5.15, 6.3, 7.45, 8.6, 9.75, 10.9, 12.05, 13.2, 14.35, 15.5, 16.65, 17.8, 18.95, 20.1, 21.25, 22.4, 23.55];
  for (let index = 0; index < beats.length; index++) {
    run.to(beats[index]);
    if (index % 2) {
      run.game.pointerdown({ x: 382, y: 388 });
      run.game.pointerup({ x: 382, y: 388 });
    } else run.tap();
    if (index === 10) assert.doesNotMatch(run.hud.hint, /采青/);
    if (index === 11) assert.match(run.hud.hint, /采青到手/);
  }
  run.to(24.99);
  assert.equal(run.results.length, 0);
  run.to(25.01);
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0].score, 1000);
  assert.equal(stat(run.results[0], '命中'), '18 / 18');
  run.tap(); run.advance(5);
  assert.equal(run.results.length, 1);
});

test('rhythm: practice taps show their HUD notice during the demo, then restore its default hint', async () => {
  const run = await session('rhythm');
  run.to(0.5); run.tap();
  assert.match(run.hud.hint, /试敲成功/);
  assert.equal(run.hud.primary, '命中 0 / 18', 'demo taps must remain unscored');
  run.to(1.3);
  assert.match(run.hud.hint, /试敲成功/, 'a live notice must remain visible throughout its duration');
  run.to(1.41);
  assert.equal(run.hud.hint, '先看金圈合拢，正式鼓点马上开始');
});

test('rhythm: early taps leave the beat available, holding cannot repeat and pause clears held input', async () => {
  const run = await session('rhythm');
  run.to(3.4); run.tap();
  assert.equal(run.hud.combo, 0);
  run.to(4); run.game.keydown('Space');
  run.to(5.15); run.game.keydown('Space'); run.game.pointerdown();
  assert.equal(run.hud.primary, '命中 1 / 18');
  run.game.cancelInput();
  run.tap();
  assert.equal(run.hud.primary, '命中 2 / 18');
  run.to(6.6);
  assert.equal(run.hud.combo, 0);
  run.to(26);
  assert.equal(stat(run.results[0], '命中'), '2 / 18');
});

test('rhythm: unavailable audio and idle rounds still finish; destroy stops later callbacks', async () => {
  const idle = await session('rhythm', () => { throw new Error('audio blocked'); });
  idle.to(26);
  assert.equal(idle.results.length, 1);
  assert.equal(idle.results[0].score, 0);
  const closed = await session('rhythm');
  const hud = closed.hud;
  closed.game.destroy(); closed.to(30); closed.tap();
  assert.equal(closed.results.length, 0);
  assert.equal(closed.hud, hud);
});

test('poles: five gold-band releases complete the course once and pointer input shares the rule', async () => {
  const run = await session('poles');
  for (const [index, hold] of [1.1, 1.27, 0.96, 1.21, 1.06].entries()) run.jump(hold, index % 2 === 1);
  assert.equal(run.results.length, 1);
  assert.equal(stat(run.results[0], '本局落点'), '5 / 5');
  assert.equal(stat(run.results[0], '轻盈落点'), '5 次');
  run.advance(50); run.tap();
  assert.equal(run.results.length, 1);
});

test('poles: missed jumps recover; key repeat and pause cancellation cannot queue a jump', async () => {
  const run = await session('poles');
  run.jump(0);
  assert.equal(run.hud.primary, '本局落点 0 / 5');
  assert.equal(run.hud.phase, 'ready');
  run.jump(1.1);
  assert.equal(run.hud.primary, '本局落点 1 / 5');
  run.game.keydown('Space'); run.advance(0.3);
  for (let n = 0; n < 20; n++) run.game.keydown('Space');
  run.advance(0.97); run.game.keyup('Space'); run.advance(1.9);
  assert.equal(run.hud.primary, '本局落点 2 / 5', 'key repeat must not restart the held charge');
  run.game.keydown('Space'); run.advance(0.3);
  run.game.cancelInput(); run.game.keyup('Space'); run.game.pointerup(); run.advance(3);
  assert.equal(run.hud.phase, 'ready');
  assert.equal(run.hud.primary, '本局落点 2 / 5');
  run.to(46);
  assert.equal(stat(run.results[0], '重新站稳'), '1 次');
});

test('poles: 45-second timeout settles once; destroy and blocked audio stay safe', async () => {
  const idle = await session('poles', () => { throw new Error('audio blocked'); });
  idle.to(44.99);
  assert.equal(idle.results.length, 0);
  idle.to(45.02);
  assert.equal(idle.results.length, 1);
  assert.equal(stat(idle.results[0], '本局落点'), '0 / 5');
  idle.advance(10); idle.tap();
  assert.equal(idle.results.length, 1);
  const closed = await session('poles');
  const hud = closed.hud;
  closed.game.destroy(); closed.to(50); closed.tap();
  assert.equal(closed.results.length, 0);
  assert.equal(closed.hud, hud);
});

function replaceGlobal(t, key, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  });
}

test('art: abort cancels image loading, rejects promptly and detaches all load handlers', async t => {
  const { loadGameArt } = await import('../../src/features/mini-games/gameArt.js');
  let image;
  replaceGlobal(t, 'Image', class { constructor() { image = this; } });
  const controller = new AbortController();
  const pending = loadGameArt({ posesUrl: '/test-poses.png', signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
  assert.equal(image.src, '');
});

test('art: loaded atlas uses different transparent frame crops with a shared foot anchor', async t => {
  const { loadGameArt } = await import('../../src/features/mini-games/gameArt.js');
  let image;
  replaceGlobal(t, 'Image', class { constructor() { image = this; } });
  const pending = loadGameArt({ posesUrl: '/test-poses.png' });
  image.onload();
  const art = await pending;
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
  const crops = [], anchors = [];
  const ctx = { save() {}, restore() {}, rotate() {}, scale() {}, globalAlpha: 1,
    translate(x, y) { anchors.push([x, y]); }, drawImage(...args) { crops.push(args.slice(1)); } };
  for (const pose of ['idle', 'crouch', 'jump', 'land']) art.lion(ctx, 700, 500, 500, { pose });
  assert.deepEqual(anchors, [[700, 500], [700, 500], [700, 500], [700, 500]]);
  assert.equal(new Set(crops.map(crop => crop.slice(0, 4).join(','))).size, 4);
  for (const crop of crops) assert.equal(crop[5] + crop[7], 5, 'only transparent padding extends below footY');
});

class FakeParam {
  value = 1;
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class FakeNode {
  gain = new FakeParam(); frequency = new FakeParam();
  stops = []; disconnected = false;
  connect() {} disconnect() { this.disconnected = true; }
  start() {} stop(at) { this.stops.push(at ?? 0); }
}
class FakeAudioContext {
  static instances = [];
  currentTime = 0; sampleRate = 1000; state = 'running'; destination = {};
  nodes = []; sources = []; closed = false;
  constructor() { FakeAudioContext.instances.push(this); }
  node(source = false) { const node = new FakeNode(); this.nodes.push(node); if (source) this.sources.push(node); return node; }
  createGain() { return this.node(); }
  createOscillator() { return this.node(true); }
  createBufferSource() { return this.node(true); }
  createBiquadFilter() { return this.node(); }
  createBuffer(_channels, size) { return { getChannelData() { return new Float32Array(size); } }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
}

test('audio: explicit enable creates context; pause, volume zero and disable stop existing sound', async t => {
  const { createGameAudio } = await import('../../src/features/mini-games/gameAudio.js');
  FakeAudioContext.instances = [];
  replaceGlobal(t, 'AudioContext', FakeAudioContext);
  const audio = createGameAudio();
  audio.sound('drum');
  assert.equal(FakeAudioContext.instances.length, 0);
  audio.setEnabled(true);
  const context = FakeAudioContext.instances[0];
  audio.sound('drum');
  assert.ok(context.sources.length >= 2, 'a drum includes its tone and short noise attack');
  audio.setActive(false);
  assert.ok(context.sources.every(source => source.stops.includes(0) && source.disconnected));
  const pausedCount = context.sources.length;
  audio.sound('good');
  assert.equal(context.sources.length, pausedCount);
  audio.setVolume(0); audio.setActive(true); audio.sound('good');
  assert.equal(context.sources.length, pausedCount);
  audio.setVolume(0.5); audio.sound('good');
  assert.ok(context.sources.length > pausedCount);
  audio.setEnabled(false);
  assert.ok(context.sources.every(source => source.stops.includes(0) && source.disconnected));
  audio.dispose();
});

test('audio: dispose disconnects nodes and closes the context; late calls and unsupported audio stay safe', async t => {
  const { createGameAudio } = await import('../../src/features/mini-games/gameAudio.js');
  FakeAudioContext.instances = [];
  replaceGlobal(t, 'AudioContext', FakeAudioContext);
  const audio = createGameAudio();
  audio.setEnabled(true); audio.sound('drum');
  const context = FakeAudioContext.instances[0];
  audio.dispose(); audio.dispose();
  assert.equal(context.closed, true);
  assert.ok(context.nodes.every(node => node.disconnected));
  audio.setEnabled(true); audio.setActive(true); audio.sound('win');
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.ok(context.sources.every(source => source.onended == null));
  replaceGlobal(t, 'AudioContext', undefined);
  replaceGlobal(t, 'webkitAudioContext', undefined);
  const unsupported = createGameAudio();
  assert.doesNotThrow(() => { unsupported.setEnabled(true); unsupported.sound('drum'); unsupported.dispose(); });
});
