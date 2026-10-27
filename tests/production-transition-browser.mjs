import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Production check uses painted DOM state only, with ordinary motion enabled.
const url = process.env.ATLAS_URL || 'http://127.0.0.1:4175';
const output = process.env.ATLAS_EVIDENCE || 'artifacts/transition/production';
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [], failedResponses = [];
const result = { url, scope: 'production brows full-window flight, dissolve, picture docking, and empty reserved right area; DOM-only black-box sampling', errors, failedResponses };
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
const phase = name => page.waitForFunction(name => document.querySelector('.lion-experience')?.dataset.phase === name, name, { timeout: 45000 });
const near = (actual, expected, label, tolerance = .4) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} matches ${expected}`);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => typeof window.__LION_ATLAS__), 'undefined', 'production check has no development world object');
  await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
    };
    const style = selector => {
      const el = document.querySelector(selector);
      const css = el && getComputedStyle(el);
      return { opacity: css ? Number(css.opacity) : 0, visibility: css?.visibility || 'hidden', mask: css?.maskImage || 'none', filter: css?.filter || 'none' };
    };
    const state = window.__PRODUCTION_TRANSITION__ = { running: true, samples: [], last: -100 };
    state.capture = t => ({ t, phase: document.querySelector('.lion-experience').dataset.phase,
      viewport: { width: innerWidth, height: innerHeight }, frame: rect('.visual-frame'), nav: rect('.chapter-controls'),
      image: rect('.chapter-artwork'), edgeCount: document.querySelectorAll('.artwork-edge, .artwork-extension').length, column: rect('.cultural-column'), canvas: rect('.canvas-host canvas'),
      model: style('.model-layer'), artwork: style('.artwork-layer'), panel: style('.cultural-panel'),
      fit: document.querySelector('.chapter-artwork') ? getComputedStyle(document.querySelector('.chapter-artwork')).objectFit : null,
      natural: document.querySelector('.chapter-artwork') ? {width:document.querySelector('.chapter-artwork').naturalWidth,height:document.querySelector('.chapter-artwork').naturalHeight} : null,
    });
    const record = t => {
      if (!state.running) return;
      const snapshot = state.capture(t);
      if (snapshot.phase !== state.samples.at(-1)?.phase || t - state.last >= 35) {
        state.samples.push(snapshot); state.last = t;
      }
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  await page.locator('.chapter-control[data-part="brows"]').click();
  await phase('travel');
  await phase('handoff');
  await phase('arranging');
  await phase('study');
  assert.equal(await page.locator('.cultural-panel').count(), 0, 'no cultural content is rendered');
  assert.equal(await page.locator('.cultural-column').evaluate(el => el.children.length), 0, 'reserved right column is empty');
  assert.equal((await page.locator('.cultural-column').textContent()).trim(), '', 'reserved right column contains no text');
  await page.waitForTimeout(200);
  const samples = await page.evaluate(() => {
    const state = window.__PRODUCTION_TRANSITION__;
    state.running = false;
    state.samples.push(state.capture(performance.now()));
    return state.samples;
  });
  result.samples = samples;
  const stages = ['travel', 'handoff', 'arranging', 'study'];
  const first = stages.map(stage => samples.findIndex(sample => sample.phase === stage));
  assert.ok(first.every(index => index >= 0), 'all four transition stages were sampled');
  assert.ok(first.every((index, i) => !i || index > first[i - 1]), 'production preserves flight → replacement → picture movement ordering');
  for (const sample of samples.filter(sample => ['travel', 'handoff'].includes(sample.phase))) {
    near(sample.frame.width, 1536, 'full-screen width');
    near(sample.frame.height, 960, 'full-screen complete 3:2 height');
    near(sample.frame.x, 0, 'stationary screen left');
    near(sample.frame.y, 0, 'stationary screen-centred top');
    near(sample.nav.x, 318, 'navigation remains centred until conversion finishes');
    near(sample.canvas.x, 0, '3D canvas starts at window left');
    near(sample.canvas.y, 0, '3D canvas starts at window top');
    near(sample.canvas.width, sample.viewport.width, '3D canvas fills window width');
    near(sample.canvas.height, sample.viewport.height, '3D canvas fills window height');
    assert.equal(sample.edgeCount,0,'no edge extensions');
    assert.equal(sample.artwork.mask,'none','no artwork mask');
    assert.equal(sample.artwork.filter,'none','no blur on artwork');
    assert.equal(sample.panel.visibility, 'hidden', 'cultural text stays hidden before picture movement');
    if (sample.phase === 'travel' || sample.artwork.opacity < .999) assert.equal(sample.model.visibility, 'visible');
  }
  const dissolve = samples.filter(sample => sample.phase === 'handoff');
  assert.ok(dissolve.some(sample => sample.artwork.opacity > .08 && sample.artwork.opacity < .92), 'production paints an intermediate image dissolve');
  assert.ok(dissolve.some(sample => sample.model.opacity > .08 && sample.model.opacity < .92), 'model fades with the picture');
  const moving = samples.filter(sample => sample.phase === 'arranging');
  assert.ok(moving.length >= 3, 'production picture movement is observed across multiple frames');
  for (const sample of moving) {
    assert.equal(sample.model.visibility, 'hidden');
    assert.equal(sample.model.opacity, 0);
    assert.equal(sample.artwork.visibility, 'visible');
    assert.ok(sample.artwork.opacity > .999, 'picture is fully converted before movement');
    assert.equal(sample.artwork.mask, 'none', 'complete image is restored before movement');
    assert.equal(sample.panel.visibility, 'hidden', 'text waits for docking');
    near(sample.frame.width / sample.frame.height, 1536 / 960, 'moving frame preserves window aspect', .0001);
    near(sample.image.width / sample.image.height, sample.natural.width / sample.natural.height, 'image retains its natural proportions', .001);
    assert.ok(sample.image.x >= sample.frame.x - .5 && sample.image.y >= sample.frame.y - .5 && sample.image.right <= sample.frame.right + .5 && sample.image.bottom <= sample.frame.bottom + .5, 'full source image fits within the frame');
    assert.equal(sample.fit, 'contain');
  }
  assert.ok(moving[0].frame.width - moving.at(-1).frame.width > 100, 'picture visibly scales after replacement');
  near(moving.at(-1).frame.x, 0, 'picture remains at left edge');
  assert.ok(moving[0].nav.x - moving.at(-1).nav.x > 50, 'six artwork controls move left with the picture');
  const final = samples.at(-1);
  near(final.frame.x, 0, 'picture finishes against left edge');
  near(final.frame.y, 0, 'picture finishes against top edge');
  near(final.nav.x + final.nav.width / 2, final.frame.width / 2, 'navigation follows left picture centre');
  assert.ok(final.nav.right <= final.column.x && final.column.width >= final.viewport.width * .32, 'right cultural column gains room');
  assert.equal(final.panel.visibility, 'hidden');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  result.passed = true;
  result.stageSamples = Object.fromEntries(stages.map(stage => [stage, samples.filter(sample => sample.phase === stage).length]));
  await page.screenshot({ path: `${output}/screenshots/production-brows-transition-final.png` });
  await writeFile(`${output}/production-transition.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, url, stageSamples: result.stageSamples, errors, failedResponses, evidence: `${output}/production-transition.json` }, null, 2));
} catch (error) {
  result.passed = false; result.failure = error.stack;
  await page.screenshot({ path: `${output}/screenshots/production-transition-failure.png` }).catch(() => {});
  await writeFile(`${output}/production-transition.json`, JSON.stringify(result, null, 2));
  throw error;
} finally { await browser.close(); }
