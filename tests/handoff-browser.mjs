import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const output = process.env.ATLAS_EVIDENCE || 'artifacts/transition';
const quick = process.argv.includes('--quick');
const ids = quick ? ['brows'] : ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'];
const poses = JSON.parse(await readFile('public/data/handoff-cameras.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
const errors = [], failedResponses = [], chapters = [], resizes = [];
let intentionalFailure = false;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !intentionalFailure) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400 && !intentionalFailure) failedResponses.push({ status: response.status(), url: response.url() }); });
await mkdir(`${output}/screenshots`, { recursive: true });
const phase = name => page.waitForFunction(name => document.querySelector('.lion-experience')?.dataset.phase === name, name, { timeout: 30000 });
const pose = () => page.evaluate(() => window.__LION_ATLAS__.getCameraPose());
const closeArray = (a, b, tolerance = .00001) => assert.ok(a.every((value, i) => Math.abs(value - b[i]) < tolerance), `pose ${JSON.stringify(a)} matches ${JSON.stringify(b)}`);
const closeNumber = (actual, expected, label, tolerance = .3) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} matches ${expected}`);

// Sample painted geometry over time; phase names alone do not prove the sequence.
async function startSamples() {
  await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
    };
    const state = window.__ATLAS_TRANSITION_SAMPLES__ = { running: true, samples: [], last: -100 };
    state.capture = t => {
      const model = document.querySelector('.model-layer'), artwork = document.querySelector('.artwork-layer'), panel = document.querySelector('.cultural-panel');
      const canvas = window.__LION_ATLAS__.renderer.domElement;
      return { t, phase: document.querySelector('.lion-experience').dataset.phase,
        viewport: { width: innerWidth, height: innerHeight }, frame: rect('.visual-frame'), nav: rect('.chapter-controls'),
        canvas: { ...rect('.canvas-host canvas'), bufferWidth: canvas.width, bufferHeight: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight, pixelRatio: window.__LION_ATLAS__.renderer.getPixelRatio() },
        modelOpacity: Number(getComputedStyle(model).opacity), modelVisibility: getComputedStyle(model).visibility,
        artworkOpacity: Number(getComputedStyle(artwork).opacity), active: window.__LION_ATLAS__.active,
        panelOpacity: panel ? Number(getComputedStyle(panel).opacity) : 0,
        panelVisibility: panel ? getComputedStyle(panel).visibility : 'hidden' };
    };
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
}

async function stopSamples() {
  return page.evaluate(() => {
    const state = window.__ATLAS_TRANSITION_SAMPLES__;
    state.running = false;
    state.samples.push(state.capture(performance.now()));
    return state.samples;
  });
}

function assertFullScreen(sample, label) {
  const { width, height } = sample.viewport;
  const fullWidth = Math.floor(Math.min(width, height * 1.5) / 3) * 3;
  closeNumber(sample.frame.width, fullWidth, `${label}: largest complete 3:2 screen width`);
  closeNumber(sample.frame.height, fullWidth / 1.5, `${label}: largest complete 3:2 screen height`);
  closeNumber(sample.frame.x + sample.frame.width / 2, width / 2, `${label}: screen-centered x`);
  closeNumber(sample.frame.y + sample.frame.height / 2, height / 2, `${label}: screen-centered y`);
}

function assertCanvas(sample, label) {
  const referenceWidth = Math.floor(Math.min(sample.viewport.width, sample.viewport.height * 1.5) / 3) * 3;
  const scale = sample.frame.width / referenceWidth;
  closeNumber(sample.canvas.width, sample.viewport.width * scale, `${label}: canvas extends over the window width`);
  closeNumber(sample.canvas.height, sample.viewport.height * scale, `${label}: canvas extends over the window height`);
  closeNumber(sample.canvas.clientWidth, sample.viewport.width, `${label}: unscaled canvas matches window width`);
  closeNumber(sample.canvas.clientHeight, sample.viewport.height, `${label}: unscaled canvas matches window height`);
  if (['overview', 'travel', 'handoff'].includes(sample.phase)) {
    closeNumber(sample.canvas.x, 0, `${label}: no internal left canvas edge`);
    closeNumber(sample.canvas.y, 0, `${label}: no internal top canvas edge`);
  }
  closeNumber(sample.canvas.bufferWidth, Math.floor(sample.canvas.clientWidth * sample.canvas.pixelRatio), `${label}: drawing buffer width follows the unscaled layout size`, 1.1);
  closeNumber(sample.canvas.bufferHeight, Math.floor(sample.canvas.clientHeight * sample.canvas.pixelRatio), `${label}: drawing buffer height follows the unscaled layout size`, 1.1);
}

function assertTransition(samples, id) {
  // A chapter switch begins in the previous chapter's study view before switching.
  samples = samples.slice(samples.findIndex(sample => sample.phase === 'travel'));
  const stages = ['travel', 'handoff', 'arranging', 'study'];
  const first = stages.map(stage => samples.findIndex(sample => sample.phase === stage));
  assert.ok(first.every(index => index >= 0), `${id}: all four stages were observed: ${first}`);
  assert.ok(first.every((index, i) => i === 0 || index > first[i - 1]), `${id}: flight → dissolve → image movement → culture`);
  for (const sample of samples.filter(sample => ['travel', 'handoff'].includes(sample.phase))) {
    assertFullScreen(sample, `${id} ${sample.phase}`);
    assertCanvas(sample, `${id} ${sample.phase}`);
    if (sample.artworkOpacity < .999 || sample.phase === 'travel') {
      assert.equal(sample.modelVisibility, 'visible', 'the model occupies the full stage until the dissolve finishes');
      assert.equal(sample.active, true, 'real camera keeps rendering throughout the dissolve');
    }
    assert.equal(sample.panelVisibility, 'hidden', 'culture waits for the image to finish moving');
  }
  const dissolve = samples.filter(sample => sample.phase === 'handoff');
  assert.ok(dissolve.some(sample => sample.artworkOpacity > .08 && sample.artworkOpacity < .92), `${id}: actual intermediate full-screen image dissolve`);
  assert.ok(dissolve.some(sample => sample.modelOpacity > .08 && sample.modelOpacity < .92), `${id}: expanded model fades progressively with the picture`);
  const moving = samples.filter(sample => sample.phase === 'arranging');
  assert.ok(moving.length >= 3, `${id}: post-dissolve animation is observable over several frames`);
  for (const sample of moving) {
    assert.equal(sample.modelVisibility, 'hidden', 'only the completed image moves');
    assert.equal(sample.modelOpacity, 0);
    assert.equal(sample.active, false, 'model is paused before image movement starts');
    assert.ok(sample.artworkOpacity > .999, 'image replacement finishes before movement');
    assert.equal(sample.panelVisibility, 'hidden', 'text remains hidden during movement');
    closeNumber(sample.frame.width / sample.frame.height, 1.5, 'moving image keeps its full 3:2 composition', .0001);
  }
  assert.ok(moving[0].frame.width - moving.at(-1).frame.width > 100, 'GSAP visibly scales the image after conversion');
  assert.ok(moving[0].frame.x - moving.at(-1).frame.x > 10, 'GSAP visibly moves the image toward the left edge');
  assert.ok(moving[0].nav.x - moving.at(-1).nav.x > 50, 'bottom art controls animate left with the image');
  const final = samples.at(-1);
  assert.equal(final.phase, 'study');
  closeNumber(final.frame.x, 0, 'study image touches the left edge');
  closeNumber(final.frame.y, 0, 'study image touches the top edge');
  assert.ok(final.nav.x >= -.3 && final.nav.right <= final.frame.right + .3, 'six controls finish inside the left image column');
  assert.ok(final.nav.y > final.frame.bottom, 'art controls stay below the image');
}

const layoutSnapshot = () => page.evaluate(() => {
  const rect = selector => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  const canvas = window.__LION_ATLAS__.renderer.domElement;
  return { phase: document.querySelector('.lion-experience').dataset.phase,
    viewport: { width: innerWidth, height: innerHeight }, frame: rect('.visual-frame'), nav: rect('.chapter-controls'),
    canvas: { ...rect('.canvas-host canvas'), bufferWidth: canvas.width, bufferHeight: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight, pixelRatio: window.__LION_ATLAS__.renderer.getPixelRatio() } };
});

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.chapter-control').count(), 6);
  assert.equal(await page.locator('.cultural-panel').count(), 0, 'home has no cultural explanation');
  assert.equal(await page.locator('.chapter-artwork').count(), 0, 'home only presents the real model');
  const homePose = await pose();
  await page.screenshot({ path: `${output}/screenshots/home-model-only.png` });
  for (const id of ids) {
    const before = await pose();
    await startSamples();
    await page.locator(`[data-part="${id}"]`).click();
    await phase('travel');
    await page.waitForTimeout(260);
    const during = await pose();
    assert.notDeepEqual(during.position, before.position, `${id}: camera actually travels`);
    assert.equal(await page.locator('.cultural-panel').getAttribute('aria-hidden'), 'true', 'cultural text waits for image handoff');
    await phase('handoff');
    const endpoint = await pose(), expected = poses.parts.find(p => p.id === id);
    closeArray(endpoint.position, expected.position);
    closeArray(endpoint.target, expected.target);
    assert.ok(Math.abs(endpoint.aspect - 1.5) < .000001, `same 3:2 camera aperture as generation reference: ${endpoint.aspect}`);
    if (id === 'brows') {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}/screenshots/brows-mid-dissolve.png` });
    }
    await phase('arranging');
    if (id === 'brows') {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}/screenshots/brows-image-moving.png` });
    }
    await phase('study');
    const samples = await stopSamples();
    assertTransition(samples, id);
    const firstChar = await page.locator('.title-character').last().evaluate(element => getComputedStyle(element).transform);
    const imageState = await page.evaluate(() => {
      const img = document.querySelector('.chapter-artwork'), model = document.querySelector('.model-layer'), w = window.__LION_ATLAS__;
      const bounds = img.getBoundingClientRect(), frame = document.querySelector('.visual-frame').getBoundingClientRect();
      return { src: new URL(img.src).pathname, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, fit: getComputedStyle(img).objectFit,
        imageBounds: { width: bounds.width, height: bounds.height }, frameBounds: { width: frame.width, height: frame.height },
        modelOpacity: getComputedStyle(model).opacity, modelVisibility: getComputedStyle(model).visibility, active: w.active,
        frame: w.renderer.info.render.frame, unchanged: w.meshes.every(m => m.position.equals(m.userData.atlasOriginal.position)) };
    });
    assert.equal(imageState.src, `/images/chapters/${id}.png`, 'one dedicated artwork per control');
    assert.equal(imageState.fit, 'contain', 'full artwork, no cropping');
    assert.equal(imageState.naturalWidth / imageState.naturalHeight, 1.5);
    assert.equal(imageState.imageBounds.width, imageState.frameBounds.width);
    assert.equal(imageState.imageBounds.height, imageState.frameBounds.height);
    assert.equal(imageState.modelVisibility, 'hidden', 'real model completely hidden after handoff');
    assert.equal(imageState.modelOpacity, '0');
    assert.equal(imageState.active, false, '3D animation loop pauses while viewing the image');
    assert.ok(imageState.unchanged, 'source model is never separated or displaced');
    await page.waitForTimeout(2550);
    const lastChar = await page.locator('.title-character').last().evaluate(element => getComputedStyle(element).transform);
    assert.notEqual(firstChar, lastChar, 'GSAP actually animates the cultural typography');
    const afterFrame = await page.evaluate(() => window.__LION_ATLAS__.renderer.info.render.frame);
    assert.equal(afterFrame, imageState.frame, 'hidden model does not keep rendering');
    assert.equal(await page.locator('.cultural-panel').getAttribute('aria-hidden'), 'false');
    const culturalVisibility = await page.locator('.cultural-panel').evaluate(element => ({ opacity: getComputedStyle(element).opacity, visibility: getComputedStyle(element).visibility }));
    assert.equal(culturalVisibility.visibility, 'visible', 'cultural text actually paints on the right');
    assert.ok(Number(culturalVisibility.opacity) > .98, 'cultural text reaches full opacity');
    const studyLayout = await page.evaluate(() => {
      const frame = document.querySelector('.visual-frame').getBoundingClientRect(), column = document.querySelector('.cultural-column').getBoundingClientRect();
      return { frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height, right: frame.right }, column: { x: column.x, width: column.width, right: column.right }, viewportWidth: innerWidth };
    });
    assert.ok(studyLayout.column.width > studyLayout.viewportWidth * .30, 'right-hand reader gains meaningful horizontal space');
    assert.ok(studyLayout.frame.right < studyLayout.column.x, 'image and reader have a clear gap');
    assert.ok(studyLayout.column.right <= studyLayout.viewportWidth, 'reader stays in the viewport');
    await page.screenshot({ path: `${output}/screenshots/${id}-final.png` });
    chapters.push({ id, endpoint, image: imageState, samples, studyLayout, textMotion: { firstChar, lastChar } });
  }
  // Return restores the original overview instead of recomputing an arbitrary pose.
  await page.getByRole('button', { name: '返回整体', exact: true }).click();
  await phase('overview');
  closeArray((await pose()).position, homePose.position);
  closeArray((await pose()).target, homePose.target);
  assert.equal(await page.locator('.cultural-panel').count(), 0);
  assert.equal(await page.evaluate(() => window.__LION_ATLAS__.active), true);

  if (!quick) {
    // Interrupt both outward travel and a returning camera; the latest control wins.
    await page.locator('[data-part="brows"]').click();
    await page.waitForTimeout(180);
    await page.locator('[data-part="trim"]').click();
    await phase('study');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), 'trim');
    await page.getByRole('button', { name: '返回整体', exact: true }).click();
    await page.waitForTimeout(850);
    await page.locator('[data-part="mouth"]').click();
    await phase('study');
    await page.getByRole('button', { name: '返回整体', exact: true }).click();
    await phase('overview');
    closeArray((await pose()).position, homePose.position);

    // New cancellation boundaries: the image dissolve and its later GSAP movement.
    for (const interruptedStage of ['handoff', 'arranging']) {
      await page.locator('[data-part="crown"]').click();
      await phase(interruptedStage);
      await page.waitForTimeout(180);
      assert.equal(await page.locator('.lion-experience').getAttribute('data-phase'), interruptedStage, 'interrupt while the requested stage is still live');
      // A normal Playwright click waits for a moving navigation bar to settle.
      await page.locator('[data-part="beard"]').click({ force: true });
      await phase('study');
      assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'), 'beard', `last selection wins during ${interruptedStage}`);
      const finalLeft = await page.locator('.visual-frame').evaluate(el => el.getBoundingClientRect().left);
      closeNumber(finalLeft, 0, `interrupted ${interruptedStage} finishes at left edge`);
      assert.equal(await page.evaluate(() => window.__LION_ATLAS__.active), false);
      await page.keyboard.press('Escape');
      await phase('overview');
      closeArray((await pose()).position, homePose.position);
    }

    await page.locator('[data-part="body"]').click();
    await phase('arranging');
    await page.waitForTimeout(160);
    await page.keyboard.press('Escape');
    await phase('overview');
    closeArray((await pose()).position, homePose.position);
    const returnedFull = await page.evaluate(() => {
      const r = document.querySelector('.visual-frame').getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, frame: { x: r.x, y: r.y, width: r.width, height: r.height } };
    });
    assertFullScreen(returnedFull, 'return during image movement restores full-size model');

    // A resize changes the live interpolation geometry, never a saved pixel destination.
    for (const resizedStage of ['travel', 'handoff', 'arranging']) {
      await page.locator('[data-part="trim"]').click();
      await phase(resizedStage);
      await page.setViewportSize({ width: 1440, height: 900 });
      await phase('study');
      const final = await layoutSnapshot();
      assertCanvas(final, `${resizedStage} resize: scaled study canvas`);
      closeNumber(final.frame.x, 0, `${resizedStage} resize: final left`);
      closeNumber(final.frame.y, 0, `${resizedStage} resize: final top`);
      closeNumber(final.frame.width, Math.floor(Math.min(1440 * .62, (900 - 148) * 1.5) / 3) * 3, `${resizedStage} resize: recomputed image width`);
      closeNumber(final.frame.width / final.frame.height, 1.5, `${resizedStage} resize: image aspect`, .0001);
      assert.ok(final.nav.x >= -.3 && final.nav.right <= final.frame.right + .3, 'resized controls stay beneath the image');
      await page.waitForTimeout(1400);
      const settled = await layoutSnapshot();
      closeNumber(settled.frame.width, final.frame.width, `${resizedStage} resize: no late scale tween`);
      closeNumber(settled.frame.x, final.frame.x, `${resizedStage} resize: no late position tween`);
      await page.screenshot({ path: `${output}/screenshots/${resizedStage}-resize.png` });
      await page.keyboard.press('Escape');
      await phase('overview');
      const returned = await layoutSnapshot();
      assertFullScreen(returned, `${resizedStage} resize: overview uses current viewport`);
      assertCanvas(returned, `${resizedStage} resize: restored full-screen canvas`);
      closeArray((await pose()).position, homePose.position);
      resizes.push({ stage: resizedStage, final, settled, returned });
      await page.setViewportSize({ width: 1536, height: 960 });
      await page.waitForFunction(() => Math.abs(document.querySelector('.visual-frame').getBoundingClientRect().width - 1440) < .3);
    }

    // Real model surface, not just HTML navigation, starts the same experience.
    const pick = await page.evaluate(() => {
      const w = window.__LION_ATLAS__, canvas = w.renderer.domElement, box = canvas.getBoundingClientRect();
      for (let y=.3;y<.8;y+=.08) for(let x=.25;x<.8;x+=.08) {
        const p = { clientX:box.left+box.width*x,clientY:box.top+box.height*y };
        if (document.elementFromPoint(p.clientX,p.clientY)!==canvas) continue;
        const part=w.pick(p); if(part) return {x:p.clientX,y:p.clientY,id:part.id};
      }
    });
    assert.ok(pick);
    await page.mouse.click(pick.x,pick.y);
    await phase('study');
    assert.equal(await page.locator('.lion-experience').getAttribute('data-selected'),pick.id);
    await page.keyboard.press('Escape');
    await phase('overview');
    await page.setViewportSize({width:1280,height:800});
    await page.locator('[data-part="body"]').click();
    await phase('study');
    await page.waitForTimeout(1700);
    await page.screenshot({path:`${output}/screenshots/desktop-1280.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth===window.innerWidth));
    assert.equal(await page.locator('.chapter-artwork').evaluate(img=>getComputedStyle(img).objectFit),'contain');
    await page.keyboard.press('Escape');
    await phase('overview');
  }
  // A rejected photo must safely return to a centered, interactive whole model.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, {timeout:180000});
  intentionalFailure = true;
  await page.route('**/images/chapters/crown.png', route => route.fulfill({status:503,body:'intentional network failure'}));
  await page.locator('[data-part="crown"]').click();
  await page.getByRole('alert').waitFor();
  await phase('overview');
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(() => window.__LION_ATLAS__.interactive), true);
  const center = await page.locator('.visual-frame').evaluate(el=>{const b=el.getBoundingClientRect();return b.left+b.width/2});
  assert.ok(Math.abs(center - (await page.evaluate(()=>innerWidth))/2) < 1, 'failed load cannot leave a stale frame tween running');
  await page.unroute('**/images/chapters/crown.png');
  assert.deepEqual(errors, [], 'no browser errors');
  assert.deepEqual(failedResponses, [], 'all real artwork and model requests succeed');
  const result = { quick, baseURL, homePose, chapters, resizes, errors, failedResponses, checks: ['home model only',quick?'brows dedicated image':'six dedicated images','actual full-screen camera travel','matching 3:2 endpoint','stationary full-screen dissolve before image movement','GSAP image scale and top-left movement after model pause','art navigation follows image left','wider right-hand reader after image movement','uncropped full artwork','3D hidden and paused','visible GSAP cultural text','source geometry unchanged','return overview',...(!quick?['travel/handoff/arranging/return cancellation','resize during travel/handoff/arranging','real model click','1280px desktop layout']:[]),'failed image recovery'] };
  await writeFile(`${output}/${quick?'quick':'browser'}-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({quick,chapters:chapters.map(c=>c.id),errors,checks:result.checks},null,2));
} catch (error) {
  const samples = await page.evaluate(() => window.__ATLAS_TRANSITION_SAMPLES__?.samples || []).catch(() => []);
  await writeFile(`${output}/failure.json`, JSON.stringify({ failure: error.stack, chapters, resizes, samples, errors, failedResponses }, null, 2));
  await page.screenshot({ path: `${output}/screenshots/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
