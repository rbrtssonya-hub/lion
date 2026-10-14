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

function bridgeHarness() {
  const messages = [], images = [], observers = [], cancelled = [];
  const listeners = new Map();
  const body = { dataset: { ready: '0' } }, book = {};
  const notify = (target) => observers.filter((observer) => observer.target === target && observer.active).forEach((observer) => observer.callback());
  const context = {
    parent: { postMessage(message, destination) { assert.equal(destination, '*'); messages.push(structuredClone(message)); } },
    document: { body }, book,
    PAGES: pages.map((page) => ({ ...page, url: base + page.file })),
    idx: 0, turn: null, raf: 51, spring: {}, viewActive: true, drag: {}, introOn: false,
    innerHeight: 600,
    getComputedStyle: () => ({ lineHeight: '20px' }),
    cancelAnimationFrame: (id) => cancelled.push(id),
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
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
  context.goTo = (index) => { context.idx = index; notify(book); };
  context.step = (direction) => { context.turn = { to: (context.idx + (direction === 'next' ? 1 : 6)) % 7 }; notify(book); };
  vm.runInNewContext(scriptSource(adapted)[2], context);
  const emit = (type, event) => [...listeners.get(type) || []].forEach((handler) => handler(event));
  const command = (action, extra = {}, source = context.parent) => emit('message', {
    source, data: { type: 'lion-book:command', channelId: options.channelId, action, ...extra },
  });
  return { context, messages, images, observers, cancelled, listeners, body, book, notify, emit, command,
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
  let prevented = false;
  harness.emit('keydown', { key: 'End', target: { tagName: 'BUTTON' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(harness.context.idx, 6);
  harness.emit('keydown', { key: 'Home', target: { tagName: 'INPUT' }, preventDefault() { throw Error('input hijacked'); } });
  assert.equal(harness.context.idx, 6);
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
