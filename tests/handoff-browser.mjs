import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const quick = process.argv.includes('--quick');
const ids = quick ? ['brows'] : ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'];
const poses = JSON.parse(await readFile('public/data/handoff-cameras.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
const errors = [], failedResponses = [], chapters = [];
let intentionalFailure = false;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !intentionalFailure) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400 && !intentionalFailure) failedResponses.push({ status: response.status(), url: response.url() }); });
await mkdir('artifacts/handoff/screenshots', { recursive: true });
const phase = name => page.waitForFunction(name => document.querySelector('.lion-experience')?.dataset.phase === name, name, { timeout: 30000 });
const pose = () => page.evaluate(() => window.__LION_ATLAS__.getCameraPose());
const closeArray = (a, b, tolerance = .00001) => assert.ok(a.every((value, i) => Math.abs(value - b[i]) < tolerance), `pose ${JSON.stringify(a)} matches ${JSON.stringify(b)}`);

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', { timeout: 180000 });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.chapter-control').count(), 6);
  assert.equal(await page.locator('.cultural-panel').count(), 0, 'home has no cultural explanation');
  assert.equal(await page.locator('.chapter-artwork').count(), 0, 'home only presents the real model');
  const homePose = await pose();
  await page.screenshot({ path: 'artifacts/handoff/screenshots/home-model-only.png' });
  for (const id of ids) {
    const before = await pose();
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
      await page.screenshot({ path: 'artifacts/handoff/screenshots/brows-mid-dissolve.png' });
    }
    await phase('study');
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
    await page.screenshot({ path: `artifacts/handoff/screenshots/${id}-final.png` });
    chapters.push({ id, endpoint, image: imageState, textMotion: { firstChar, lastChar } });
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
    await page.screenshot({path:'artifacts/handoff/screenshots/desktop-1280.png'});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth===window.innerWidth));
    assert.equal(await page.locator('.chapter-artwork').evaluate(img=>getComputedStyle(img).objectFit),'contain');
    await page.keyboard.press('Escape');
    await phase('overview');
  }
  // A rejected photo must safely return to a centered, interactive whole model.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', {timeout:180000});
  intentionalFailure = true;
  await page.route('**/images/chapters/crown.png', route => route.fulfill({status:503,body:'intentional network failure'}));
  await page.locator('[data-part="crown"]').click();
  await phase('overview');
  await page.waitForTimeout(2300);
  assert.equal(await page.evaluate(() => window.__LION_ATLAS__.interactive), true);
  const center = await page.locator('.visual-frame').evaluate(el=>{const b=el.getBoundingClientRect();return b.left+b.width/2});
  assert.ok(Math.abs(center - (await page.evaluate(()=>innerWidth))/2) < 1, 'failed load cannot leave a stale frame tween running');
  await page.unroute('**/images/chapters/crown.png');
  assert.deepEqual(errors, [], 'no browser errors');
  assert.deepEqual(failedResponses, [], 'all real artwork and model requests succeed');
  const result = { quick, baseURL, homePose, chapters, errors, failedResponses, checks: ['home model only',quick?'brows dedicated image':'six dedicated images','actual camera travel','matching 3:2 endpoint','uncropped full artwork','3D hidden and paused','visible GSAP cultural text','source geometry unchanged','return overview',...(!quick?['transition cancellation','real model click','1280px desktop layout']:[]),'failed image recovery'] };
  await writeFile(`artifacts/handoff/${quick?'quick':'browser'}-results.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({quick,chapters:chapters.map(c=>c.id),errors,checks:result.checks},null,2));
} finally { await browser.close(); }
