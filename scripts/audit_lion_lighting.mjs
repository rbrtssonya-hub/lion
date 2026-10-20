import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run against Vite development serving this checkout. Hooks exist only in the
// intercepted browser response; neither application files nor assets are edited.
// Example: node scripts/audit_lion_lighting.mjs --base-url 5198 \
//   --output tmp/lion-lighting-audit --baseline-ref 62bcd8e
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = { 'base-url': 'http://127.0.0.1:5198', output: 'tmp/lion-lighting-audit', 'baseline-ref': '62bcd8e', channel: 'chrome' };
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === '--help') {
    console.log('Usage: node scripts/audit_lion_lighting.mjs [--base-url PORT_OR_URL] [--output DIRECTORY] [--baseline-ref GIT_REF] [--channel chrome|chromium]');
    process.exit(0);
  }
  const [flag, inline] = argument.split(/=(.*)/s);
  const name = flag.replace(/^--/, '');
  if (!(name in options)) throw new Error(`Unknown option: ${argument}`);
  options[name] = inline ?? process.argv[++index];
  if (!options[name]) throw new Error(`Missing value: ${flag}`);
}
const baseURL = /^\d+$/.test(options['base-url']) ? `http://127.0.0.1:${options['base-url']}` : options['base-url'].replace(/\/$/, '');
const output = path.resolve(project, options.output);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fromImports = code => [...code.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)].map(match => match[2]);
const sceneFiles = ['lionScene.js', 'actionTheaterScene.js'];
const expected = { groups: 33, strands: 2295421, points: 19957105 };
const report = { version: 1, startedAt: new Date().toISOString(), baseURL, baselineRef: options['baseline-ref'], viewport: { width: 1920, height: 1080 }, expected, variants: [], comparisons: [], errors: [] };
await mkdir(output, { recursive: true });

// Read actual immutable asset bytes once. The source archive is optional on a
// fresh checkout; the deployed GLB and all 33 exact strand buffers are required.
const manifestPath = 'source/public/assets/models/lion-user-hair.json';
const manifestBytes = await readFile(path.join(project, manifestPath));
const manifest = JSON.parse(manifestBytes);
report.assets = [];
for (const relative of [manifestPath, 'source/public/assets/models/lion-user-full.glb', ...manifest.groups.map(group => `source/public/${group.path}`)]) {
  const bytes = await readFile(path.join(project, relative));
  report.assets.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
}
try {
  const relative = 'source/models/user-lion-2026-10-20.blend';
  const bytes = await readFile(path.join(project, relative));
  report.sourceArchive = { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
} catch (error) { if (error.code !== 'ENOENT') throw error; }
report.checkout = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).trim();
report.sceneSources = await Promise.all(sceneFiles.map(async name => ({ name, sha256: sha256(await readFile(path.join(project, 'src/services', name))) })));

function injectHandles(code, name) {
  if (name === 'lionScene.js') {
    const marker = "report({ phase: 'ready', message: '模型已载入 · 可交互' });";
    if (!code.includes(marker)) throw new Error('Structure hook marker missing');
    return code.replace(marker, `globalThis.__lionLightingAudit ??= {};
    globalThis.__lionLightingAudit.structure = {
      scene, camera, renderer, controls, fullLion, requestDraw,
      stop() { isActive = false; cancelAnimationFrame(animationFrame); animationFrame = 0; clearTimeout(settlingTimer); viewTween = null; controls.autoRotate = false; controls.enableDamping = false; },
      render() { renderer.render(scene, camera); updatePartAnchors(); updateDiagnostics(); },
    };
    ${marker}`);
  }
  const marker = 'ready = true;';
  if (!code.includes(marker)) throw new Error('Theater hook marker missing');
  return code.replace(marker, `${marker}
      globalThis.__lionLightingAudit ??= {};
      globalThis.__lionLightingAudit.theater = {
        scene, camera, renderer, controls, fullLion, lionRoot, requestDraw: requestFrame,
        stop() { visible = false; cancelAnimationFrame(animationFrame); animationFrame = 0; focusTween = null; controls.autoRotate = false; controls.enableDamping = false; controls.enabled = false; },
        render() { renderer.render(scene, camera); publishDiagnostics(); },
      };`);
}

async function installRoutes(context, baseline) {
  for (const name of sceneFiles) {
    const relative = `src/services/${name}`;
    const currentRaw = await readFile(path.join(project, relative), 'utf8');
    const raw = baseline ? execFileSync('git', ['show', `${options['baseline-ref']}:${relative}`], { cwd: project, encoding: 'utf8', maxBuffer: 2 ** 22 }) : null;
    await context.route(`**/${relative}*`, async route => {
      const response = await route.fetch();
      const served = await response.text();
      let code = served;
      if (baseline) {
        // Reuse this server's exact optimized module URLs so the baseline and
        // current renderer share the same Three build and loader instances.
        const originals = fromImports(currentRaw), resolved = fromImports(served);
        if (originals.length !== resolved.length) throw new Error(`Vite import mapping changed: ${name}`);
        const mapping = new Map(originals.map((source, index) => [source, resolved[index]]));
        code = raw.replace(/\bfrom\s*(['"])([^'"]+)\1/g, (match, quote, source) => {
          if (!mapping.has(source)) throw new Error(`Unresolved baseline import: ${name}: ${source}`);
          return `from ${quote}${mapping.get(source)}${quote}`;
        });
      }
      await route.fulfill({ response, body: injectHandles(code, name), contentType: 'application/javascript' });
    });
  }
}

async function positionView(page, chapter, view) {
  await page.evaluate(({ chapter, view }) => {
    const handle = globalThis.__lionLightingAudit[chapter];
    handle.stop();
    const { camera, controls, fullLion } = handle;
    if (!handle.originalCamera) handle.originalCamera = { position: camera.position.clone(), target: controls.target.clone() };
    camera.position.copy(handle.originalCamera.position);
    controls.target.copy(handle.originalCamera.target);
    if (chapter === 'theater') {
      // Equal phase in both variants; the complete lion keeps its source data.
      handle.lionRoot.rotation.y = ({ default: 0, front: 0, side: Math.PI / 2, back: Math.PI })[view];
      handle.scene.updateMatrixWorld(true);
    } else if (view !== 'default') {
      // Fit the complete mesh AND authored strand bounds from the live scene.
      const points = [];
      fullLion.root.traverse(object => {
        if (!object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const { min, max } = object.geometry.boundingBox;
        for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(camera.position.clone().set(x, y, z).applyMatrix4(object.matrixWorld));
      });
      const minimum = camera.position.clone().set(Infinity, Infinity, Infinity), maximum = minimum.clone().set(-Infinity, -Infinity, -Infinity);
      points.forEach(point => { minimum.min(point); maximum.max(point); });
      const target = minimum.clone().add(maximum).multiplyScalar(.5);
      const direction = camera.position.clone().fromArray(({ front: [0, .12, 1], side: [1, .12, 0], back: [0, .12, -1], underside: [.15, -1, .2] })[view]).normalize();
      const right = camera.up.clone().cross(direction).normalize(), up = direction.clone().cross(right).normalize();
      const verticalTan = Math.tan(camera.fov * Math.PI / 360);
      const horizontalTan = verticalTan * (camera.view?.enabled ? camera.view.fullWidth / camera.view.fullHeight : camera.aspect);
      let distance = 0;
      for (const point of points) {
        const relative = point.sub(target);
        distance = Math.max(distance, relative.dot(direction) + Math.abs(relative.dot(up)) / (verticalTan * .86), relative.dot(direction) + Math.abs(relative.dot(right)) / (horizontalTan * .86));
      }
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(direction, distance);
    }
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    handle.render();
  }, { chapter, view });
}

async function measure(page, chapter) {
  return page.evaluate(chapter => {
    const handle = globalThis.__lionLightingAudit[chapter];
    const { renderer, camera, scene, fullLion } = handle;
    handle.render();
    const gl = renderer.getContext(), width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4), mask = new Uint8Array(pixels.length);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const drawStatistics = fullLion.getDrawStatistics(renderer);
    const replacements = [], masks = new Map(), activeGeometries = [];
    const before = { background: scene.background, overrideMaterial: scene.overrideMaterial };
    let maskImage;
    try {
      scene.background = null;
      scene.overrideMaterial = null;
      scene.traverse(object => {
        if (!object.material) return;
        const original = object.material;
        replacements.push([object, original]);
        const replace = material => {
          const key = `${material.uuid}|${Boolean(object.userData.fullHair)}`;
          if (masks.has(key)) return masks.get(key);
          let clone;
          if (material.isShaderMaterial) {
            // Reflector uniforms contain render-target textures. Three's normal
            // clone intentionally drops them with a warning. Keep the original
            // live uniforms by reference for this synchronous diagnostic pass,
            // while copying the remaining shader state into a distinct material.
            const uniforms = Object.fromEntries(Object.entries(material.uniforms).map(([name, uniform]) => [name, { ...uniform, value: uniform.value?.isRenderTargetTexture ? null : uniform.value }]));
            clone = new material.constructor().copy(Object.assign(Object.create(material), { uniforms }));
            clone.uniforms = material.uniforms;
          } else clone = material.clone();
          const hook = material.onBeforeCompile;
          clone.onBeforeCompile = shader => {
            hook.call(material, shader, renderer);
            // Execute the complete source shader, including discard/depth and
            // map lookup, then mark actual hair albedo AFTER tone/color mapping.
            // Meshes remain black occluders. No object or strand is hidden.
            const color = object.userData.fullHair ? `
              vec3 auditAlbedo = diffuseColor.rgb;
              bool auditRed = auditAlbedo.r > .012 && auditAlbedo.r > auditAlbedo.g * 2.5 && auditAlbedo.r > auditAlbedo.b * 2.0;
              float auditMinimum = min(auditAlbedo.r, min(auditAlbedo.g, auditAlbedo.b));
              float auditMaximum = max(auditAlbedo.r, max(auditAlbedo.g, auditAlbedo.b));
              bool auditIvory = auditMinimum > .18 && auditMaximum < auditMinimum * 1.65;
              gl_FragColor = vec4(auditRed ? vec3(1., 0., 0.) : auditIvory ? vec3(0., 1., 0.) : vec3(0.), 1.);` : 'gl_FragColor = vec4(0., 0., 0., 1.);';
            shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, `${color}\n}`);
          };
          clone.customProgramCacheKey = () => `lion-lighting-audit-mask-v1:${material.customProgramCacheKey()}:${Boolean(object.userData.fullHair)}`;
          masks.set(key, clone);
          return clone;
        };
        object.material = Array.isArray(original) ? original.map(replace) : replace(original);
      });
      renderer.render(scene, camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      maskImage = renderer.domElement.toDataURL('image/png');
    } finally {
      replacements.forEach(([object, material]) => { object.material = material; });
      masks.forEach(material => material.dispose());
      scene.background = before.background;
      scene.overrideMaterial = before.overrideMaterial;
      handle.render();
    }
    const histograms = { red: new Uint32Array(256), ivory: new Uint32Array(256) };
    const values = { red: { pixels: 0, redUnder30: 0, redUnder60: 0, luminanceUnder20: 0 }, ivory: { pixels: 0, allChannels250: 0, anyChannel250: 0, allChannels245: 0 } };
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const isRed = mask[offset] > 250 && mask[offset + 1] < 5 && mask[offset + 2] < 5;
      const isIvory = mask[offset + 1] > 250 && mask[offset] < 5 && mask[offset + 2] < 5;
      if (!isRed && !isIvory) continue;
      const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
      const luminance = Math.round(.2126 * r + .7152 * g + .0722 * b);
      const value = values[isRed ? 'red' : 'ivory'];
      value.pixels += 1;
      histograms[isRed ? 'red' : 'ivory'][luminance] += 1;
      if (isRed) { value.redUnder30 += r < 30; value.redUnder60 += r < 60; value.luminanceUnder20 += luminance < 20; }
      else { value.allChannels250 += Math.min(r, g, b) >= 250; value.anyChannel250 += Math.max(r, g, b) >= 250; value.allChannels245 += Math.min(r, g, b) >= 245; }
    }
    for (const [name, value] of Object.entries(values)) {
      value.ratios = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'pixels').map(([key, count]) => [key, value.pixels ? count / value.pixels : null]));
      value.luminance = {};
      for (const percentile of [5, 25, 50, 75, 95, 99]) {
        let total = 0;
        value.luminance[`p${percentile}`] = null;
        for (let level = 0; level < 256; level += 1) {
          total += histograms[name][level];
          if (value.pixels && total >= value.pixels * percentile / 100) { value.luminance[`p${percentile}`] = level; break; }
        }
      }
      value.occupiedLuminanceLevels = histograms[name].filter(count => count > 0).length;
    }
    fullLion.root.traverse(object => {
      if (!object.userData.fullHair) return;
      activeGeometries.push({ name: object.name, id: object.geometry.uuid, instances: object.geometry.instanceCount, pointsPerStrand: object.userData.pointsPerStrand, sourcePoints: object.geometry.instanceCount * object.userData.pointsPerStrand, lineIndices: object.geometry.index.count, material: object.material.name });
    });
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { metrics: values, maskImage, canvas: { width, height, dataset: { ...renderer.domElement.dataset } }, camera: { position: camera.position.toArray(), target: handle.controls.target.toArray(), fov: camera.fov, projection: camera.projectionMatrix.toArray() }, statistics: fullLion.statistics, drawStatistics, geometries: activeGeometries, render: { ...renderer.info.render }, lighting: { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, lights: scene.children.filter(object => object.isLight).map(light => ({ name: light.name, type: light.type, intensity: light.intensity, color: `#${light.color.getHexString()}`, position: light.position.toArray() })) }, gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), glError: gl.getError(), restoredMaterials: replacements.every(([object, material]) => object.material === material) };
  }, chapter);
}

const browser = await chromium.launch({ channel: options.channel, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  for (const baseline of [true, false]) {
    const variant = { name: baseline ? 'baseline' : 'current', cases: [], console: [], pageErrors: [], failedRequests: [], cancelledMediaRequests: [], responseErrors: [] };
    report.variants.push(variant);
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await installRoutes(context, baseline);
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', error => variant.pageErrors.push(String(error)));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) variant.console.push({ type: message.type(), text: message.text().slice(0, 4000) }); });
    page.on('requestfailed', request => {
      const failure = { url: request.url(), error: request.failure()?.errorText };
      // Browsers cancel MP4 range downloads when preloaded video is replaced
      // or the context closes. Keep that evidence separate from asset failures.
      const cancelledVideo = failure.error === 'net::ERR_ABORTED' && request.resourceType() === 'media' && new URL(failure.url).pathname.endsWith('.mp4');
      (cancelledVideo ? variant.cancelledMediaRequests : variant.failedRequests).push(failure);
    });
    page.on('response', response => { if (response.status() >= 400) variant.responseErrors.push({ url: response.url(), status: response.status() }); });
    try {
      await page.goto(`${baseURL}/#/model`);
      await page.locator('#startupLoading').waitFor({ state: 'detached' });
      for (const [chapter, views] of [['structure', ['default', 'front', 'side', 'back', 'underside']], ['theater', ['default', 'front', 'side', 'back']]]) {
        if (chapter === 'theater') await page.locator('.site-header [data-route="action"]').click();
        await page.waitForFunction(chapter => {
          const handle = globalThis.__lionLightingAudit?.[chapter];
          return handle?.fullLion.getDrawStatistics(handle.renderer).groups === 33;
        }, chapter);
        for (const view of views) {
          const name = `${variant.name}-${chapter}-${view}`;
          await positionView(page, chapter, view);
          const observation = await measure(page, chapter);
          const { maskImage, ...result } = observation;
          const screenshot = `${name}.png`, mask = `${name}-mask.png`;
          await writeFile(path.join(output, mask), Buffer.from(maskImage.split(',')[1], 'base64'));
          await page.screenshot({ path: path.join(output, screenshot), animations: 'disabled' });
          const assertions = {
            allGroupsSubmitted: result.drawStatistics.groups === expected.groups,
            allStrandsSubmitted: result.drawStatistics.strands === expected.strands,
            allPointsSubmitted: result.drawStatistics.points === expected.points,
            geometryStrandsRetained: result.geometries.reduce((sum, geometry) => sum + geometry.instances, 0) === expected.strands,
            geometryPointsRetained: result.geometries.reduce((sum, geometry) => sum + geometry.sourcePoints, 0) === expected.points,
            visibleRedHairMeasured: result.metrics.red.pixels > 100,
            visibleIvoryHairMeasured: result.metrics.ivory.pixels > 100,
            noGLError: result.glError === 0,
            materialsRestored: result.restoredMaterials,
          };
          variant.cases.push({ chapter, view, screenshot, mask, ...result, assertions });
          console.log(`${name}: red<30 ${(100 * result.metrics.red.ratios.redUnder30).toFixed(2)}%, white>=250 ${(100 * result.metrics.ivory.ratios.allChannels250).toFixed(2)}%, drawn ${result.drawStatistics.groups}/${result.drawStatistics.strands}`);
        }
      }
    } catch (error) { variant.failure = String(error.stack ?? error); report.errors.push({ variant: variant.name, error: variant.failure }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }

for (const current of report.variants.find(variant => variant.name === 'current')?.cases ?? []) {
  const baseline = report.variants[0].cases.find(candidate => candidate.chapter === current.chapter && candidate.view === current.view);
  if (!baseline) continue;
  report.comparisons.push({ chapter: current.chapter, view: current.view, sameCamera: JSON.stringify(baseline.camera) === JSON.stringify(current.camera), sameSourceCounts: JSON.stringify(baseline.statistics) === JSON.stringify(current.statistics), redBlackUnder30: { before: baseline.metrics.red.ratios.redUnder30, after: current.metrics.red.ratios.redUnder30 }, redBlackUnder60: { before: baseline.metrics.red.ratios.redUnder60, after: current.metrics.red.ratios.redUnder60 }, ivoryClipped250: { before: baseline.metrics.ivory.ratios.allChannels250, after: current.metrics.ivory.ratios.allChannels250 }, ivoryHighlightRange: { before: baseline.metrics.ivory.luminance.p95 - baseline.metrics.ivory.luminance.p5, after: current.metrics.ivory.luminance.p95 - current.metrics.ivory.luminance.p5 } });
}
// Verify that the audit itself left every runtime source asset byte unchanged.
report.assetsUnchanged = true;
for (const asset of report.assets) if (sha256(await readFile(path.join(project, asset.path))) !== asset.sha256) report.assetsUnchanged = false;
if (report.sourceArchive) report.sourceArchiveUnchanged = sha256(await readFile(path.join(project, report.sourceArchive.path))) === report.sourceArchive.sha256;
report.finishedAt = new Date().toISOString();
report.runtimeChecksPassed = report.variants.length === 2 && report.variants.every(variant => variant.cases.length === 9 && !variant.failure && !variant.pageErrors.length && !variant.failedRequests.length && !variant.responseErrors.length && !variant.console.some(message => message.type === 'error' || /THREE\.WebGLProgram|shader error|VALIDATE_STATUS|GL_INVALID/i.test(message.text)) && variant.cases.every(test => Object.values(test.assertions).every(Boolean))) && report.comparisons.length === 9 && report.comparisons.every(comparison => comparison.sameCamera && comparison.sameSourceCounts) && report.assetsUnchanged && report.sourceArchiveUnchanged !== false;
await writeFile(path.join(output, 'lighting-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Report: ${path.join(output, 'lighting-audit.json')}`);
console.log(`Runtime integrity checks: ${report.runtimeChecksPassed ? 'passed' : 'failed'}; pixel measurements require visual review.`);
if (!report.runtimeChecksPassed) process.exitCode = 1;
