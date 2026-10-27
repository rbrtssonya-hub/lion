import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run against the development server to inspect the real renderer and camera.
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const output = process.env.ATLAS_EVIDENCE || 'artifacts/viewport';
const cameras = JSON.parse(await readFile('public/data/handoff-cameras.json', 'utf8'));
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [], failedResponses = [];
let intentionalFailure = false;
const result = { url, errors, failedResponses };
let releaseImage;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !intentionalFailure) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400 && !intentionalFailure) failedResponses.push({ url: response.url(), status: response.status() }); });
const phase = name => page.waitForFunction(name => document.querySelector('.lion-experience')?.dataset.phase === name, name, { timeout: 45000 });
const near = (actual, expected, label, tolerance = .01) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.chapter-control').count(), 6);
  assert.equal(await page.locator('.model-guide').count(), 0, 'overview retains only the six bottom controls');
  result.assets = await page.evaluate(async () => {
    const variants=['16x10/','16x9/','','ultrawide/'], ids=['brows','crown','beard','body','trim','mouth'];
    return Promise.all(variants.flatMap(variant=>ids.map(id=>new Promise((resolve,reject)=>{const image=new Image(); image.onload=()=>resolve({url:`/images/fullscreen/${variant}${id}.png`,width:image.naturalWidth,height:image.naturalHeight}); image.onerror=()=>reject(new Error(`failed image ${variant}${id}`)); image.src=`/images/fullscreen/${variant}${id}.png`;}))));
  });
  assert.equal(result.assets.length,24, 'six chapter images exist for each of four aspect variants');
  assert.ok(result.assets.every(item=>item.width>1000 && item.height>700),'all source images have usable resolution');

  // Delay the real chapter image so the real body endpoint can be inspected at full opacity.
  const held = new Promise(resolve => { releaseImage = resolve; });
  await page.route('**/images/fullscreen/16x9/body.png', async route => { await held; await route.continue(); });
  await page.locator('.chapter-control[data-part="body"]').click();
  await phase('travel');
  await page.waitForTimeout(3000);
  result.endpoint = await page.evaluate(() => {
    const w = window.__LION_ATLAS__, canvas = w.renderer.domElement, camera = w.camera;
    const image = document.querySelector('.chapter-artwork').getBoundingClientRect();
    const apertureWidth = image.height * 1.5;
    const frame = {x:(innerWidth-apertureWidth)/2,y:image.y,width:apertureWidth,height:image.height,right:(innerWidth+apertureWidth)/2};
    const box = canvas.getBoundingClientRect();
    const reference = camera.clone();
    reference.clearViewOffset(); reference.aspect = 1.5; reference.updateProjectionMatrix();
    const projection = w.registry.all().map(part => {
      const actual = part.center.clone().project(camera), old = part.center.clone().project(reference);
      return { id: part.id, actual: [(actual.x + 1) * innerWidth / 2, (1 - actual.y) * innerHeight / 2],
        original: [frame.x + (old.x + 1) * frame.width / 2, frame.y + (1 - old.y) * frame.height / 2] };
    });
    w.renderer.render(w.scene, camera);
    const gl = w.renderer.getContext(), rgba = new Uint8Array(4), samples = [];
    const ratio = w.renderer.getPixelRatio();
    for (let y = 70; y < innerHeight - 135; y += 24) for (let x = 12; x < innerWidth - 12; x += 16) {
      if (x >= frame.x - 8 && x <= frame.right + 8) continue;
      w.raycaster.setFromCamera({ x: x / innerWidth * 2 - 1, y: 1 - y / innerHeight * 2 }, camera);
      const hit = w.raycaster.intersectObjects(w.meshes, false).find(item => item.object.visible);
      if (!hit) continue;
      gl.readPixels(Math.floor(x * ratio), Math.floor((innerHeight - y) * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      if (rgba[3] > 100) samples.push({ x, y, rgba: [...rgba], source: hit.object.userData.sourceName || hit.object.name });
    }
    return { phase: document.querySelector('.lion-experience').dataset.phase, pose: w.getCameraPose(), projection, samples,
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height, right: frame.right },
      canvas: { x: box.x, y: box.y, width: box.width, height: box.height },
      artworkOpacity: Number(getComputedStyle(document.querySelector('.artwork-layer')).opacity) };
  });
  const endpoint = result.endpoint, registered = cameras.parts.find(part => part.id === 'body');
  assert.equal(endpoint.phase, 'travel');
  assert.equal(endpoint.artworkOpacity, 0);
  near(endpoint.canvas.x, 0, 'canvas x'); near(endpoint.canvas.y, 0, 'canvas y');
  near(endpoint.canvas.width, 1920, 'canvas width'); near(endpoint.canvas.height, 1080, 'canvas height');
  endpoint.pose.position.forEach((value, i) => near(value, registered.position[i], 'body camera position', .00001));
  endpoint.pose.target.forEach((value, i) => near(value, registered.target[i], 'body camera target', .00001));
  near(endpoint.pose.aspect, 1.5, 'original camera aspect', .00001);
  for (const p of endpoint.projection) { near(p.actual[0], p.original[0], `${p.id} original x`); near(p.actual[1], p.original[1], `${p.id} original y`); }
  assert.ok(endpoint.samples.filter(p => p.x < endpoint.frame.x).length > 5, 'actual model paints beyond the former left edge');
  assert.ok(endpoint.samples.filter(p => p.x > endpoint.frame.right).length > 5, 'actual model paints beyond the former right edge');
  await page.screenshot({ path: `${output}/screenshots/body-endpoint.png` });

  // Pause the actual GSAP timeline at a midpoint so the screenshots record the real
  // handoff and return frames without racing a short animation in slow software GL.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => /\/deps\/gsap\.js(?:\?|$)/.test(entry.name));
    if (!resource) throw new Error('Vite GSAP module was not loaded');
    window.__viewportTestGsap = (await import(resource.name)).gsap;
  });
  await page.evaluate(() => { window.__viewportTestGsap.globalTimeline.timeScale(.25); });
  const captureFrame = async (stage, target, file) => {
    await page.waitForFunction(({ stage, target }) => {
      const root = document.querySelector('.lion-experience'), model = document.querySelector('.model-layer'), image = document.querySelector('.artwork-layer');
      const m = Number(getComputedStyle(model).opacity), a = Number(getComputedStyle(image).opacity);
      if (root.dataset.phase !== stage || Math.abs(a - target) > .06 || m < .05 || m > .95) return false;
      window.__viewportTestGsap.globalTimeline.pause();
      return true;
    }, { stage, target }, { timeout: 45000 });
    const state = await page.evaluate(() => ({ phase: document.querySelector('.lion-experience').dataset.phase,
      model: Number(getComputedStyle(document.querySelector('.model-layer')).opacity),
      artwork: Number(getComputedStyle(document.querySelector('.artwork-layer')).opacity), active: window.__LION_ATLAS__.active }));
    assert.equal(state.phase, stage); assert.equal(state.active, true);
    assert.ok(state.model > .05 && state.model < .95 && state.artwork > .05 && state.artwork < .95, `${stage} both layers are partially visible`);
    near(state.artwork, target, `${stage} image fade stage`, .07);
    near(state.model + state.artwork, 1, `${stage} model and picture fade together`, .025);
    await page.screenshot({ path: `${output}/screenshots/${file}.png` });
    await page.evaluate(() => { window.__viewportTestGsap.globalTimeline.resume(); });
    return state;
  };
  releaseImage();
  result.handoff = [];
  for (const target of [.2, .5, .8]) result.handoff.push(await captureFrame('handoff', target, `body-handoff-${target}`));
  await phase('study');
  await page.getByRole('button', { name: '返回整体', exact: true }).click();
  result.returning = [];
  for (const target of [.8, .5, .2]) result.returning.push(await captureFrame('returning', target, `body-return-${target}`));
  await phase('overview');
  await page.evaluate(() => { window.__viewportTestGsap.globalTimeline.timeScale(1); });
  result.desktops = [];
  for (const size of [{width:1920,height:1020,variant:'reference'},{width:1920,height:1080,variant:'16x9'},{width:1536,height:960,variant:'16x10'},{width:2560,height:1080,variant:'ultrawide'},{width:1700,height:1000,variant:'16x9'},{width:2200,height:1080,variant:'reference'}]) {
    await page.setViewportSize({width:size.width,height:size.height});
    await page.waitForTimeout(200);
    await page.locator('.chapter-control[data-part="body"]').click();
    await phase('handoff');
    await captureFrame('handoff', .5, `handoff-${size.width}x${size.height}`);
    const geometry = await page.evaluate(() => {
      const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
      const image=document.querySelector('.chapter-artwork'), img=rect('.chapter-artwork'), frame=rect('.artwork-layer'), canvas=rect('.canvas-host canvas');
      const edges=[...document.querySelectorAll('.artwork-edge, .artwork-extension')];
      const w=window.__LION_ATLAS__, camera=w.camera, reference=camera.clone();
      reference.clearViewOffset(); reference.aspect=1.5; reference.updateProjectionMatrix();
      const apertureWidth=img.height*1.5, apertureX=(innerWidth-apertureWidth)/2;
      const projection=w.registry.all().map(part => {const actual=part.center.clone().project(camera), old=part.center.clone().project(reference); return {id:part.id,actual:[(actual.x+1)*innerWidth/2,(1-actual.y)*innerHeight/2],expected:[apertureX+(old.x+1)*apertureWidth/2,img.y+(1-old.y)*img.height/2]};});
      return {size:{width:innerWidth,height:innerHeight},image:img,frame,edgeCount:edges.length,canvas,src:new URL(image.src).pathname,natural:{width:image.naturalWidth,height:image.naturalHeight},fit:getComputedStyle(image).objectFit,mask:getComputedStyle(image).maskImage,filter:getComputedStyle(image).filter,projection};
    });
    near(geometry.frame.x,0,'artwork left edge',.5); near(geometry.frame.y,0,'artwork top edge',.5);
    near(geometry.frame.width,size.width,'artwork window width',.5); near(geometry.frame.height,size.height,'artwork window height',.5);
    near(geometry.canvas.width,size.width,'canvas window width',.5); near(geometry.canvas.height,size.height,'canvas window height',.5);
    assert.equal(geometry.src,size.variant==='reference'?'/images/fullscreen/body.png':`/images/fullscreen/${size.variant}/body.png`,'correct artwork for viewport aspect');
    assert.equal(geometry.edgeCount,0,'no blurred or stretched edge extensions');
    assert.ok(geometry.image.x>=-.5 && geometry.image.y>=-.5 && geometry.image.right<=size.width+.5 && geometry.image.bottom<=size.height+.5,'full source image remains inside window');
    assert.equal(geometry.fit,'contain');
    assert.equal(geometry.mask,'none','the original image is fully unmasked');
    assert.equal(geometry.filter,'none','the original image is not blurred');
    near(geometry.image.width/geometry.image.height,geometry.natural.width/geometry.natural.height,'image preserves source aspect',.001);
    for (const p of geometry.projection) {near(p.actual[0],p.expected[0],`${p.id} registered x`,.5);near(p.actual[1],p.expected[1],`${p.id} registered y`,.5);}
    await phase('study');
    assert.equal(await page.locator('.cultural-column').evaluate(el=>el.children.length),0,'reserved right column is empty');
    await page.screenshot({path:`${output}/screenshots/study-${size.width}x${size.height}.png`});
    result.desktops.push(geometry);
    await page.keyboard.press('Escape');
    await phase('overview');
  }
  // Rapid changes in the finished view must settle on the latest decoded image.
  await page.setViewportSize({width:1536,height:960});
  await page.waitForTimeout(200);
  await page.locator('.chapter-control[data-part="body"]').click();
  await phase('study');
  for (const size of [{width:1920,height:1080},{width:1536,height:960},{width:2560,height:1080},{width:1920,height:1020}]) await page.setViewportSize(size);
  await page.waitForFunction(() => new URL(document.querySelector('.chapter-artwork').src).pathname === '/images/fullscreen/body.png', null, {timeout:30000});
  await page.waitForTimeout(600);
  assert.equal(new URL(await page.locator('.chapter-artwork').getAttribute('src'),url).pathname,'/images/fullscreen/body.png','latest resize wins');
  assert.equal(await page.locator('.variant-outgoing').count(),0,'old resize transition completes');
  await page.screenshot({path:`${output}/screenshots/rapid-resize.png`});
  await page.keyboard.press('Escape');
  await phase('overview');

  // A failed alternate decode retains the existing image; retry after recovery.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, {timeout:180000});
  await page.setViewportSize({width:1536,height:960});
  await page.waitForTimeout(200);
  await page.locator('.chapter-control[data-part="body"]').click();
  await phase('study');
  intentionalFailure = true;
  await page.route('**/images/fullscreen/16x9/body.png',route=>route.fulfill({status:503,body:'intentional alternate failure'}));
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForTimeout(1800);
  assert.equal(new URL(await page.locator('.chapter-artwork').getAttribute('src'),url).pathname,'/images/fullscreen/16x10/body.png','failed alternate keeps old decoded artwork');
  assert.equal(await page.locator('.chapter-artwork').evaluate(el=>el.complete && el.naturalWidth>0),true,'retained artwork remains usable');
  await page.unroute('**/images/fullscreen/16x9/body.png');
  intentionalFailure = false;
  await page.setViewportSize({width:1536,height:960});
  await page.setViewportSize({width:1920,height:1080});
  await page.waitForFunction(() => new URL(document.querySelector('.chapter-artwork').src).pathname === '/images/fullscreen/16x9/body.png', null, {timeout:30000});
  await page.keyboard.press('Escape');
  await phase('overview');
  assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
  result.passed = true;
  await writeFile(`${output}/viewport-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, bodyPixelsLeft: endpoint.samples.filter(p => p.x < endpoint.frame.x).length,
    bodyPixelsRight: endpoint.samples.filter(p => p.x > endpoint.frame.right).length, handoff: result.handoff, returning: result.returning, errors, failedResponses }, null, 2));
} catch (error) {
  result.passed = false; result.failure = error.stack;
  await page.screenshot({ path: `${output}/screenshots/failure.png` }).catch(() => {});
  await writeFile(`${output}/viewport-results.json`, JSON.stringify(result, null, 2));
  throw error;
} finally { releaseImage?.(); await browser.close(); }
