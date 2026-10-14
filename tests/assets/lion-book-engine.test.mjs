import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { adaptLionSketchbookDocument } from '../../src/services/lionSketchbookDocument.js';
import { adaptLionSketchbookFactory } from '../../src/services/lionSketchbookFactory.js';
import { lionBookPages } from '../../src/data/lion-book.js';
import { lionBookPlugin } from '../../scripts/lion-book-vite-plugin.mjs';

const packageFile = new URL('../../node_modules/@designcodeio/threeui/package.json', import.meta.url);
const packageRoot = new URL('./', packageFile);
const documentFile = new URL('lib-dist/shaders/sketchbook/sketchbookDocument.js', packageRoot);
const { createSketchbookDocument, CANONICAL_SKETCHBOOK_HTML } = await import(documentFile);
const base = 'https://lion.example/exhibit/assets/lion-book/';
const original = createSketchbookDocument(base);
const pages = ['cover', 'origin', 'formation', 'martial', 'spread', 'modern', 'ending'].map((id, index) => ({
  file: `${id}.png`, id, title: `史册第${index}页`, era: `时代${index}`, description: `文化资料${index}`, stage: index,
}));
const options = { pages, assetBaseUrl: base, channelId: 'engine-test' };
const adapted = adaptLionSketchbookDocument(original, options);

function scriptSource(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

function namedFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing original function ${name}`);
  const next = source.indexOf('\nfunction ', start + 1);
  // Extract by balanced braces, ignoring braces in strings/comments by using
  // the canonical next top-level function boundary where it is available.
  const candidates = ['\nfunction ', '\nlet ', '\nconst ', '\naddEventListener(', '\ndocument.', '\nstage.', '\n/* ']
    .map((boundary) => source.indexOf(boundary, start + 1)).filter((position) => position > start);
  const end = Math.min(...candidates, next > start ? next : Infinity);
  return source.slice(start, end).trimEnd();
}

test('lion archive keeps the installed ThreeUI 1.2.0 paper engine unchanged', () => {
  assert.equal(JSON.parse(fs.readFileSync(packageFile, 'utf8')).version, '1.2.0');
  const upstream = scriptSource(original)[0];
  const engine = scriptSource(adapted)[1];
  for (const name of ['el', 'imgEl', 'halfEl', 'buildCurl', 'applyTurn', 'paint', 'caption', 'fadeCaption', 'layout', 'animateTo', 'tweenTo', 'tick', 'kick', 'applyView', 'viewSpring', 'setView', 'tiltTo', 'bookRect', 'hideHint', 'endDrag', 'startTurn', 'commit', 'cancel', 'step', 'goTo', 'marks', 'endIntro', 'riffleStep', 'startIntro']) {
    assert.equal(namedFunction(engine, name), namedFunction(upstream, name), `${name} must remain the official implementation`);
  }
  const pointerStart = "stage.addEventListener('pointerdown',";
  const pointerEnd = '/* ------------------------------------------------------ turn control */';
  assert.equal(engine.slice(engine.indexOf(pointerStart), engine.indexOf(pointerEnd)), upstream.slice(upstream.indexOf(pointerStart), upstream.indexOf(pointerEnd)));
  for (const selector of ['.sb-book{', '.sb-full{', '.sb-half{', '.gutter-shade{', '.curl{', '.strip{', '.face{', '.sb-zone{']) {
    const index = original.indexOf(selector);
    const rule = original.slice(index, original.indexOf('}', index) + 1);
    assert.ok(adapted.includes(rule), `${selector} keeps original geometry`);
  }
  assert.ok(engine.includes('const N=18;'));
  assert.ok(engine.includes('const SPAN=0.449;'));
  assert.ok(engine.includes('const BETA=0.60;'));
});

test('lion archive has seven local spreads and no lens, zoom controls, scenery, remote fonts or old site', () => {
  const engine = scriptSource(adapted)[1];
  const serializedPages = engine.match(/const PAGES=(\[[\s\S]*?\]);\nPAGES\.forEach/)[1];
  assert.deepEqual(JSON.parse(serializedPages).map((page) => page.file), pages.map((page) => page.file));
  assert.ok(engine.includes(`const DIR=${JSON.stringify(base)};`));
  assert.ok(engine.includes('const M=PAGES.length, LAND=0;'));
  assert.ok(!engine.includes('setTimeout(startIntro,220)'));
  assert.ok(engine.includes("const Q=new URLSearchParams('');"));
  assert.ok(!engine.includes("URLSearchParams('nointro')"));
  assert.equal((adapted.match(/id="sb-mblur-1"/g) || []).length, 1);
  assert.equal((adapted.match(/id="sb-mblur-2"/g) || []).length, 1);
  for (const old of ['bg-wash.jpg', 'marina-bay', 'gardens-by-the-bay', 'merlion.png', 'botany-', 'bloom.png', 'divider.png', '.woff2', '@font-face', 'class="loupe"', 'class="zoomwrap"', 'id="loupeBtn"', 'id="zIn"', 'id="zOut"', 'function loupeSize', 'function placeLoupe', 'function shoveLoupe', 'const MAG=', 'x.com/MengTo', 'mailto:', 'Designer / Creator']) {
    assert.ok(!adapted.includes(old), `removed ${old}`);
  }
  assert.ok(!/<(?:img|link|script)\b[^>]*\b(?:src|href)=|url\(https?:/.test(adapted));
  assert.match(adapted, /<html lang="zh-CN">/);
  for (const script of scriptSource(adapted)) assert.doesNotThrow(() => new Function(script));
});

test('archive adapter fails closed on engine/style drift, repeated adaptation and invalid content', () => {
  assert.throws(() => adaptLionSketchbookDocument(original.replace('const N=18;', 'const N=12;'), options), /upstream script changed/);
  assert.throws(() => adaptLionSketchbookDocument(original.replace('perspective:1750px', 'perspective:1000px'), options), /upstream paper styles changed/);
  assert.throws(() => adaptLionSketchbookDocument(adapted, options), /expected one original engine script/);
  assert.throws(() => adaptLionSketchbookDocument(original, { ...options, pages: pages.slice(1) }), /seven/);
  assert.throws(() => adaptLionSketchbookDocument(original, { ...options, pages: [{ ...pages[0], file: '../cover.png' }, ...pages.slice(1)] }), /unexpected spread file/);
  assert.throws(() => adaptLionSketchbookDocument(original, { ...options, assetBaseUrl: 'javascript:alert(1)' }), /invalid assetBaseUrl/);
  assert.throws(() => adaptLionSketchbookDocument(original, { ...options, maxWidth: 20 }), /invalid maxWidth/);
});

test('archive data cannot escape its script', () => {
  const hostilePages = pages.map((page, index) => index ? page : { ...page, title: '</script><img src=x onerror=alert(1)>' });
  const html = adaptLionSketchbookDocument(original, { ...options, pages: hostilePages, channelId: '</script>' });
  assert.equal(scriptSource(html).length, 3);
  assert.ok(html.includes('\\u003c/script>'));
  for (const script of scriptSource(html)) assert.doesNotThrow(() => new Function(script));
});

function bridgeHarness({ reduced = false, coarse = false, introAllowed = true } = {}) {
  const messages = [], images = [], observers = [], cancelled = [], frames = new Map(), timers = new Map();
  let clock = 0, handle = 100;
  function eventTarget() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
      removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
      emit(type, event = {}) { [...listeners.get(type) || []].forEach((handler) => handler(event)); },
    };
  }
  const windowEvents = eventTarget(), documentEvents = eventTarget();
  const motion = { ...eventTarget(), matches: reduced }, coarseQuery = { matches: coarse };
  const body = { dataset: { ready: '0' } }, book = {};
  const captures = new Set();
  const stage = { hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id) };
  const notify = (target) => observers.filter((observer) => observer.target === target && observer.active).forEach((observer) => observer.callback());
  const context = {
    parent: { postMessage(message, destination) { assert.equal(destination, '*'); messages.push(structuredClone(message)); } },
    document: { body, hidden: false, ...documentEvents }, book, stage,
    wrap: { classList: { add() {}, remove() {}, toggle() {} } },
    PAGES: pages.map((page) => ({ ...page, url: base + page.file })),
    M: 7, LAND: 0, Q: new URLSearchParams(), REDUCED: reduced,
    idx: 0, turn: null, raf: null, spring: null, viewActive: false, drag: null, introOn: false,
    riffle: null, riffleAt: 0, last: 0,
    matchMedia: (query) => query.includes('reduced-motion') ? motion : coarseQuery,
    performance: { now: () => clock },
    innerHeight: 600,
    getComputedStyle: () => ({ lineHeight: '20px' }),
    requestAnimationFrame: (callback) => { const id = ++handle; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => { cancelled.push(id); frames.delete(id); },
    setTimeout: (callback, delay) => { const id = ++handle; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    ...windowEvents,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = true; observers.push(this); }
      observe(target) { this.target = target; }
      disconnect() { this.active = false; }
    },
    Image: class {
      constructor() { this.naturalWidth = 1494; this.naturalHeight = 1052; images.push(this); }
      decode() { return Promise.resolve(); }
    },
  };
  context.window = context;
  context.paint = () => notify(book);
  context.applyTurn = () => {};
  context.viewSpring = () => { context.viewActive = false; };
  context.loupeEase = () => false;
  const sandbox = vm.createContext(context);
  // Execute the real navigation, gesture completion, spring, and riffle code.
  // Only DOM painting is stubbed; command races must exercise upstream goTo's
  // early return and tick's real spring/turn scheduling relationship.
  const engine = scriptSource(adapted)[1];
  for (const name of ['animateTo', 'tweenTo', 'tick', 'kick', 'endDrag', 'startTurn', 'commit', 'cancel', 'step', 'goTo', 'endIntro', 'riffleStep', 'startIntro']) {
    vm.runInContext(namedFunction(engine, name), sandbox);
  }
  vm.runInContext(scriptSource(adapted)[2], sandbox);
  const emit = windowEvents.emit;
  const command = (action, extra = {}, source = context.parent) => emit('message', {
    source, data: { type: 'lion-book:command', channelId: options.channelId, action, ...extra },
  });
  const advance = (duration) => {
    const end = clock + duration;
    while (clock < end) {
      clock = Math.min(end, clock + 16);
      for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach((callback) => callback(clock));
    }
  };
  if (typeof introAllowed === 'boolean') command('intro-policy', { enabled: introAllowed });
  return { context, messages, images, observers, cancelled, listeners: windowEvents.listeners, body, book, notify, emit, command,
    motion, documentEvents, frames, timers, captures, advance,
    state: () => messages.filter((message) => message.type === 'lion-book:state').at(-1) };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

test('bridge accepts proportional pages, waits for all seven and the engine, then reports committed index', async () => {
  const harness = bridgeHarness();
  const { images, body, notify, context, book, command, state } = harness;
  assert.equal(images.length, 7);
  assert.equal(state().ready, false);
  images.slice(0, 6).forEach((image) => image.onload());
  await flushPromises();
  assert.equal(state().ready, false, 'six loaded pages cannot claim ready');
  images[6].onload();
  await flushPromises();
  assert.equal(state().ready, false, 'independent assets cannot claim the engine initialized');
  body.dataset.ready = '1'; notify(body);
  assert.equal(state().ready, true);
  command('visibility', { visible: true });
  command('next', {}, {});
  command('next', { channelId: 'other-frame' });
  command('goTo', { index: 7 });
  command('goTo', { index: 1.4 });
  assert.equal(context.turn, null, 'only valid parent commands can affect the book');
  command('next');
  assert.equal(state().turning, true);
  assert.equal(state().index, 0, 'an in-flight turn must retain its committed stage');
  context.idx = 1; context.turn = null; notify(book);
  assert.equal(state().index, 1);
  assert.equal(state().turning, false);
  command('goTo', { index: 5 });
  assert.equal(state().index, 5);
  const count = harness.messages.length;
  command('sync');
  assert.equal(harness.messages.length, count + 1, 'sync always answers a fresh host handshake');
});

test('bridge rejects missing, distorted or low-resolution pages despite upstream swallowed failures', async () => {
  for (const mode of ['missing', 'distorted', 'low-resolution']) {
    const harness = bridgeHarness();
    harness.body.dataset.ready = '1'; harness.notify(harness.body);
    if (mode === 'missing') harness.images[0].onerror();
    else {
      harness.images[0].naturalWidth = mode === 'distorted' ? 1600 : 880;
      harness.images[0].naturalHeight = mode === 'distorted' ? 1052 : 620;
      harness.images[0].onload();
    }
    await flushPromises();
    assert.equal(harness.state().ready, false);
    assert.match(harness.state().error, /书页加载失败/);
    harness.command('next');
    assert.equal(harness.context.turn, null);
    harness.command('dispose');
  }
});

test('wheel units, book keyboard boundaries and disposal obey the host lifecycle', async () => {
  const harness = bridgeHarness();
  harness.images.forEach((image) => image.onload());
  harness.body.dataset.ready = '1';
  await flushPromises();
  harness.notify(harness.body);
  let wheelPrevented = 0;
  harness.emit('wheel', { deltaX: 1, deltaY: 3, deltaMode: 1, preventDefault() { wheelPrevented += 1; } });
  assert.deepEqual(harness.messages.at(-1), { type: 'lion-book:wheel', channelId: options.channelId, deltaX: 20, deltaY: 60, deltaMode: 0 });
  assert.equal(wheelPrevented, 1);
  harness.emit('wheel', { deltaX: 0, deltaY: 1, deltaMode: 2, preventDefault() { wheelPrevented += 1; } });
  assert.equal(harness.messages.at(-1).deltaY, 600);
  const wheelCount = harness.messages.length;
  harness.emit('wheel', { deltaX: 0, deltaY: 1, deltaMode: 0, cancelable: false, preventDefault() { throw Error('noncancelable wheel hijacked'); } });
  assert.equal(harness.messages.length, wheelCount, 'a noncancelable event keeps native scroll only');
  harness.command('visibility', { visible: true });
  let prevented = false;
  harness.emit('keydown', { key: 'End', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  harness.advance(1400);
  assert.equal(prevented, true);
  assert.equal(harness.context.idx, 6);
  harness.emit('keydown', { key: 'Home', target: { tagName: 'INPUT' }, preventDefault() { throw Error('input hijacked'); } });
  assert.equal(harness.context.idx, 6);
  Object.assign(harness.context, { raf: 51, spring: {}, drag: {} });
  harness.command('dispose');
  assert.deepEqual(harness.cancelled, [51]);
  assert.ok(harness.observers.every((observer) => !observer.active));
  assert.ok([...harness.listeners.values()].every((handlers) => handlers.size === 0));
  assert.equal(harness.context.spring, null);
  assert.equal(harness.context.drag, null);
  const count = harness.messages.length;
  harness.command('sync');
  assert.equal(harness.messages.length, count);
});

async function readyBridge(harness, { visible = true } = {}) {
  harness.command('visibility', { visible });
  harness.images.forEach((image) => image.onload());
  harness.body.dataset.ready = '1';
  await flushPromises();
  harness.notify(harness.body);
  assert.equal(harness.state().ready, true);
}

test('the sandbox waits for host session eligibility and never consumes an unseen or failed introduction', async () => {
  const unknown = bridgeHarness({ introAllowed: null });
  await readyBridge(unknown);
  unknown.advance(1000);
  assert.equal(unknown.state().intro, 'pending');
  assert.equal(unknown.state().introConsumed, false);
  assert.equal(unknown.context.riffle, null);
  assert.equal(unknown.timers.size, 0, 'readiness and exposure cannot bypass the host session handshake');
  unknown.command('intro-policy', { enabled: false }, {});
  assert.equal(unknown.state().intro, 'pending', 'only the owning parent can grant or deny eligibility');
  unknown.command('intro-policy', { enabled: false });
  unknown.advance(1000);
  assert.equal(unknown.state().intro, 'done');
  assert.equal(unknown.state().introConsumed, false);
  assert.equal(unknown.context.riffle, null);

  const unseen = bridgeHarness();
  await readyBridge(unseen, { visible: false });
  unseen.advance(1000);
  assert.equal(unseen.state().introConsumed, false);
  assert.equal(unseen.context.riffle, null);
  const failed = bridgeHarness();
  failed.command('visibility', { visible: true });
  failed.body.dataset.ready = '1'; failed.notify(failed.body);
  failed.images[0].onerror();
  await flushPromises();
  failed.advance(1000);
  assert.equal(failed.state().introConsumed, false);
  assert.equal(failed.context.riffle, null);
});

test('session consumption begins with the original riffle and repeated host handshakes preserve an active sequence', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.advance(100);
  assert.equal(harness.state().introConsumed, false, 'the lead-in timer does not consume the first visit');
  harness.advance(200);
  assert.equal(harness.context.introOn, true);
  assert.equal(harness.state().introConsumed, true);
  const sequence = harness.context.riffle;
  harness.command('intro-policy', { enabled: false });
  harness.command('sync');
  assert.equal(harness.state().intro, 'playing', 'StrictMode or host re-sync cannot cancel the same playing instance');
  harness.advance(2500);
  assert.equal(harness.state().intro, 'done');
  assert.equal(harness.state().introConsumed, true);
  assert.equal(harness.context.riffle, sequence);
  const returned = bridgeHarness({ introAllowed: false });
  await readyBridge(returned);
  returned.advance(2500);
  assert.equal(returned.context.riffle, null, 'a recreated iframe cannot replay a consumed session intro');
  assert.equal(returned.context.idx, 0);
});

test('reduced motion alone does not consume eligibility, while a ready manual takeover does', async () => {
  const reduced = bridgeHarness({ reduced: true });
  await readyBridge(reduced);
  assert.equal(reduced.state().intro, 'done');
  assert.equal(reduced.state().introConsumed, false);
  reduced.command('next');
  assert.equal(reduced.state().introConsumed, true, 'deliberate paper reading supersedes the automatic first visit');
  const pending = bridgeHarness();
  await readyBridge(pending);
  pending.command('goTo', { index: 3 });
  assert.equal(pending.state().introConsumed, true);
  assert.equal(pending.state().intro, 'done');
  assert.equal(pending.context.riffle, null);
});

test('original seven-page riffle waits for readiness and visible exposure, then runs once and returns to the cover', async () => {
  const harness = bridgeHarness();
  harness.command('visibility', { visible: true });
  harness.advance(1000);
  assert.equal(harness.state().intro, 'pending');
  assert.equal(harness.context.turn, null);
  assert.equal(harness.timers.size, 0, 'visibility alone cannot start unloaded paper');
  await readyBridge(harness);
  assert.equal(harness.timers.size, 1);
  harness.advance(208);
  assert.equal(harness.state().intro, 'pending', 'the original 220ms lead-in is retained');
  harness.command('visibility', { visible: false });
  assert.equal(harness.timers.size, 0);
  harness.advance(800);
  assert.equal(harness.context.turn, null);
  harness.command('visibility', { visible: true });
  harness.advance(240);
  assert.equal(harness.state().intro, 'playing');
  assert.equal(harness.context.introOn, true);
  assert.equal(harness.context.riffle.length, 7);
  const sequence = harness.context.riffle;
  harness.advance(2500);
  assert.equal(harness.state().intro, 'done');
  assert.equal(harness.context.idx, 0);
  assert.equal(harness.context.turn, null);
  assert.equal(harness.frames.size, 0);
  harness.command('visibility', { visible: false });
  harness.command('visibility', { visible: true });
  harness.advance(1500);
  assert.equal(harness.context.riffle, sequence, 'returning to the book never replays the first-exposure riffle');
  assert.equal(harness.context.riffleAt, 7);
});

test('offscreen, document visibility and window blur pause the original intro spring without restarting its sequence', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.advance(300);
  const sequence = harness.context.riffle;
  for (const reason of ['host', 'document', 'blur']) {
    const before = { index: harness.context.idx, t: harness.context.turn.t, elapsed: harness.context.spring.e, at: harness.context.riffleAt };
    if (reason === 'host') harness.command('visibility', { visible: false });
    else if (reason === 'document') { harness.context.document.hidden = true; harness.documentEvents.emit('visibilitychange'); }
    else harness.emit('blur');
    harness.advance(1000);
    assert.equal(harness.frames.size, 0);
    assert.equal(harness.state().intro, 'playing');
    assert.deepEqual({ index: harness.context.idx, t: harness.context.turn.t, elapsed: harness.context.spring.e, at: harness.context.riffleAt }, before);
    if (reason === 'host') harness.command('visibility', { visible: true });
    else if (reason === 'document') { harness.context.document.hidden = false; harness.documentEvents.emit('visibilitychange'); }
    else harness.emit('focus');
    assert.equal(harness.frames.size, 1);
    harness.advance(32);
    assert.ok(harness.context.turn.t > before.t);
    assert.equal(harness.context.riffle, sequence);
  }
  harness.advance(2500);
  assert.equal(harness.context.idx, 0);
  assert.equal(harness.state().intro, 'done');
});

test('positive host exposure resumes an intro after local iframe focus moves to the parent', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.advance(300);
  const sequence = harness.context.riffle;
  harness.emit('blur');
  assert.equal(harness.frames.size, 0);
  harness.command('visibility', { visible: true });
  assert.equal(harness.frames.size, 1, 'the host knows whether the complete application is focused');
  harness.advance(2500);
  assert.equal(harness.context.idx, 0);
  assert.equal(harness.context.riffle, sequence);
  assert.equal(harness.state().intro, 'done');
});

test('manual selection cancels a pending intro and targets the requested page during the original riffle', async () => {
  const pending = bridgeHarness();
  await readyBridge(pending);
  pending.advance(100);
  pending.command('goTo', { index: 3 });
  pending.advance(3000);
  assert.equal(pending.context.idx, 3);
  assert.equal(pending.state().intro, 'done');
  assert.equal(pending.context.riffle, null);

  for (const index of [0, 3]) {
    const playing = bridgeHarness();
    await readyBridge(playing);
    playing.advance(300);
    assert.equal(playing.context.idx, 0);
    assert.equal(playing.context.turn.to, 1);
    playing.command('goTo', { index });
    playing.advance(1600);
    assert.equal(playing.context.idx, index, 'a same-page request must not finish on the intro leaf destination');
    assert.equal(playing.context.turn, null);
    assert.equal(playing.context.spring, null);
    assert.equal(playing.frames.size, 0);
    assert.equal(playing.state().intro, 'done');
  }
});

test('rapid timeline and keyboard navigation clears old springs and never leaves an idle RAF loop', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.command('next');
  harness.advance(64);
  harness.command('goTo', { index: 0 });
  harness.advance(1600);
  assert.equal(harness.context.idx, 0);
  harness.command('next');
  harness.advance(64);
  harness.command('goTo', { index: 3 });
  assert.equal(harness.context.idx, 3);
  assert.equal(harness.context.turn, null);
  assert.equal(harness.context.spring, null);
  assert.equal(harness.context.raf, null);
  assert.equal(harness.frames.size, 0, 'far navigation must cancel tick as well as its old spring');
  let prevented = 0;
  for (let index = 0; index < 12; index += 1) {
    harness.emit('keydown', { key: 'ArrowRight', target: { tagName: 'BUTTON' }, preventDefault() { prevented += 1; }, stopImmediatePropagation() {} });
    harness.advance(16);
  }
  harness.advance(1600);
  assert.equal(prevented, 12);
  assert.equal(harness.context.idx, 1);
  assert.equal(harness.context.spring, null);
  assert.equal(harness.frames.size, 0);
});

test('a trusted host timeline command takes over after iframe focus moves to its parent', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.command('goTo', { index: 0 });
  harness.emit('blur');
  harness.command('visibility', { visible: true });
  assert.equal(harness.frames.size, 0);
  harness.command('next');
  assert.equal(harness.frames.size, 1, 'host input must not wait for another iframe focus event');
  harness.advance(1600);
  assert.equal(harness.context.idx, 1);
  assert.equal(harness.context.turn, null);
  assert.equal(harness.context.spring, null);
  assert.equal(harness.frames.size, 0);
});

test('manual adjacent selection commits while paper is offscreen instead of parking an unseen spring', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness, { visible: false });
  for (const [action, index, expected] of [['next', undefined, 1], ['previous', undefined, 0], ['goTo', 6, 6]]) {
    harness.command(action, { index });
    assert.equal(harness.context.idx, expected);
    assert.equal(harness.state().index, expected);
    assert.equal(harness.context.turn, null);
    assert.equal(harness.context.spring, null);
    assert.equal(harness.context.raf, null);
    assert.equal(harness.frames.size, 0);
  }
  assert.equal(harness.state().intro, 'done');
});

test('interrupted gestures return to committed paper and release capture on every lifecycle boundary', async () => {
  for (const reason of ['blur', 'resize', 'lostpointercapture', 'pointercancel', 'document', 'host']) {
    const harness = bridgeHarness();
    await readyBridge(harness);
    harness.emit('pointerdown', { button: 0, pointerId: 7, target: { closest: () => ({}) }, stopImmediatePropagation() {} });
    assert.equal(harness.state().intro, 'done', 'manual paper input cancels a pending riffle');
    harness.context.startTurn('next', .3);
    harness.context.drag = { dir: 'next', moved: 50, vel: 4 };
    harness.captures.add(7);
    if (reason === 'document') { harness.context.document.hidden = true; harness.documentEvents.emit('visibilitychange'); }
    else if (reason === 'host') harness.command('visibility', { visible: false });
    else harness.emit(reason, { stopImmediatePropagation() {} });
    assert.equal(harness.context.idx, 0, reason);
    assert.equal(harness.context.drag, null, reason);
    assert.equal(harness.context.turn, null, reason);
    assert.equal(harness.context.spring, null, reason);
    assert.equal(harness.captures.size, 0, reason);
    assert.equal(harness.frames.size, 0, reason);
  }
});

test('dynamic reduced motion immediately settles active paper and keeps short drag cancellation static', async () => {
  const harness = bridgeHarness();
  await readyBridge(harness);
  harness.command('next'); harness.advance(64);
  assert.ok(harness.context.turn);
  harness.motion.matches = true; harness.motion.emit('change');
  assert.equal(harness.context.REDUCED, true);
  assert.equal(harness.context.idx, 1);
  assert.equal(harness.context.turn, null);
  assert.equal(harness.frames.size, 0);
  harness.command('next');
  assert.equal(harness.context.idx, 2);
  assert.equal(harness.context.turn, null);
  harness.context.startTurn('prev', .2);
  harness.context.drag = { moved: 50, vel: 0 };
  harness.emit('pointerup', { stopImmediatePropagation() {} });
  assert.equal(harness.context.idx, 2);
  assert.equal(harness.context.turn, null);
  assert.equal(harness.context.spring, null);
  assert.equal(harness.frames.size, 0);
  harness.motion.matches = false; harness.motion.emit('change');
  harness.command('next');
  assert.equal(harness.context.REDUCED, false);
  assert.ok(harness.context.spring);
});

test('reduced or coarse input skips the intro and blank paper margins cannot start an interaction', async () => {
  for (const preference of [{ reduced: true }, { coarse: true }]) {
    const harness = bridgeHarness(preference);
    await readyBridge(harness, { visible: false });
    assert.equal(harness.state().intro, 'done');
    assert.equal(harness.timers.size, 0);
    harness.command('visibility', { visible: true }); harness.advance(2500);
    assert.equal(harness.context.idx, 0);
    assert.equal(harness.context.riffle, null);
  }
  const harness = bridgeHarness();
  await readyBridge(harness);
  let blocked = false;
  harness.emit('pointerdown', { button: 0, target: { closest: () => null }, stopImmediatePropagation() { blocked = true; } });
  assert.equal(blocked, true);
  assert.equal(harness.state().intro, 'pending', 'blank margins do not cancel the first-exposure animation');
  assert.match(adapted, /\.sb-zone\{top:21\.8%;bottom:21\.8%\}/);
  assert.match(adapted, /\.sb-cast\.ambient\{top:65%;bottom:19\.2%;[^}]*filter:none/);
});

test('disposing pending or playing intro cancels timers, frames, image work and all bridge listeners', async () => {
  for (const advance of [0, 300]) {
    const harness = bridgeHarness();
    await readyBridge(harness);
    harness.advance(advance);
    harness.command('dispose');
    const count = harness.messages.length;
    harness.advance(3000);
    assert.equal(harness.messages.length, count);
    assert.equal(harness.timers.size, 0);
    assert.equal(harness.frames.size, 0);
    assert.equal(harness.context.spring, null);
    assert.equal(harness.context.introOn, false);
    for (const registry of [harness.listeners, harness.documentEvents.listeners, harness.motion.listeners]) {
      assert.ok([...registry.values()].every((handlers) => handlers.size === 0));
    }
  }
});

test('factory adapts only marked absolute asset URLs and strips their channel before generating content', () => {
  const calls = [];
  const originalFactory = (url) => { calls.push(url); return createSketchbookDocument(url); };
  assert.equal(adaptLionSketchbookFactory('/sketchbook/', originalFactory), createSketchbookDocument('/sketchbook/'));
  assert.equal(adaptLionSketchbookFactory(base, originalFactory), original);
  assert.equal(adaptLionSketchbookFactory(`${base}#other`, originalFactory), createSketchbookDocument(`${base}#other`));
  const html = adaptLionSketchbookFactory(`${base}#lion-book=factory-test`, originalFactory);
  assert.equal(calls.at(-1), base);
  assert.match(html, /<title>岭南醒狮志 · 南风有狮<\/title>/);
  assert.match(html, /const channelId="factory-test"/);
  assert.ok(!html.includes('#lion-book='));
  const serializedPages = scriptSource(html)[1].match(/const PAGES=(\[[\s\S]*?\]);\nPAGES\.forEach/)[1];
  assert.deepEqual(JSON.parse(serializedPages).map((page) => page.title), lionBookPages.map((page) => page.title));
  assert.throws(() => adaptLionSketchbookFactory(`${base}#lion-book=`, originalFactory), /Invalid lion archive channel/);
  assert.throws(() => adaptLionSketchbookFactory(`${base}#lion-book=%ZZ`, originalFactory), /Invalid lion archive channel/);
});

test('Vite wraps only the exact installed factory while keeping canonical source and normal instances intact', async () => {
  const plugin = lionBookPlugin();
  const source = fs.readFileSync(documentFile, 'utf8');
  const id = fileURLToPath(documentFile);
  assert.equal(plugin.enforce, 'pre');
  assert.equal(plugin.transform(source, '/src/unrelated.js'), null);
  assert.throws(() => plugin.transform(source.replace('const N=18;', 'const N=12;'), id), /factory changed/);
  const result = plugin.transform(source, `${id}?v=test`);
  assert.ok(result.code.includes(source.slice(0, source.indexOf('function r('))), 'canonical HTML and host styles remain literal upstream bytes');
  const wrapperPath = plugin.resolveId('virtual:lion-book-sketchbook-factory');
  const runnable = result.code.replace('"virtual:lion-book-sketchbook-factory"', JSON.stringify(pathToFileURL(wrapperPath).href));
  const compiled = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString('base64')}`);
  assert.equal(compiled.CANONICAL_SKETCHBOOK_HTML, CANONICAL_SKETCHBOOK_HTML);
  assert.equal(compiled.createSketchbookDocument(), createSketchbookDocument());
  assert.equal(compiled.createSketchbookDocument(base), original);
  const marked = compiled.createSketchbookDocument(`${base}#lion-book=declarative-react`);
  assert.match(marked, /const channelId="declarative-react"/);
  assert.ok(!marked.includes('bg-wash.jpg'));
  const upstream = scriptSource(original)[0], engine = scriptSource(marked)[1];
  for (const name of ['buildCurl', 'applyTurn', 'paint', 'tick', 'endDrag', 'startTurn', 'commit', 'cancel', 'step', 'goTo']) {
    assert.equal(namedFunction(engine, name), namedFunction(upstream, name));
  }
});
