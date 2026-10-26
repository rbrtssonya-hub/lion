import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Capture the actual default action scene without adding hooks to shipped code.
// Start Vite, then: node scripts/capture_action_scene.mjs --url=http://127.0.0.1:5191
// Existing scene.json is protected; pass --overwrite to replace a snapshot.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const separator = value.indexOf('=');
  return separator < 0 ? [value.replace(/^--/, ''), true] : [value.slice(2, separator), value.slice(separator + 1)];
}));
const output = path.resolve(root, args.output ?? 'tmp/action-blender-export/snapshot');
const baseURL = args.url ?? 'http://127.0.0.1:5191';
const snapshotPath = path.join(output, 'scene.json');
const overwrite = args.overwrite === true || args.overwrite === 'true';
if (existsSync(snapshotPath) && !overwrite) throw new Error(`Refusing to overwrite ${snapshotPath}; pass --overwrite explicitly.`);
await mkdir(path.join(output, 'textures'), { recursive: true });
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: false }));
  });
  await context.route('**/src/services/actionTheaterScene.js*', async route => {
    const response = await route.fetch();
    const code = await response.text();
    const marker = 'ready = true;';
    if (!code.includes(marker)) throw new Error('Action scene capture hook marker changed');
    await route.fulfill({ response, contentType: 'application/javascript', body: code.replace(marker, `${marker}
      globalThis.__actionSceneExport = {
        scene, camera, renderer, controls, fullLion, lionRoot, drums, architecture, screenRecords, screenDefinitions,
        stop() { visible = false; cancelAnimationFrame(animationFrame); animationFrame = 0; focusTween = null; controls.autoRotate = false; controls.enableDamping = false; controls.enabled = false; },
        render() { renderer.render(scene, camera); publishDiagnostics(); },
      };`) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${baseURL}/#/action`);
  console.log('Action route opened; waiting for native scene resources.');
  try {
    await page.waitForFunction(() => {
      const h = globalThis.__actionSceneExport;
      return h && h.renderer.domElement.dataset.hdriState === 'ready' && h.drums.stats.status === 'ready'
        && h.fullLion.getDrawStatistics(h.renderer).groups === 33;
    }, null, { timeout: 90_000 });
  } catch (error) {
    console.error(JSON.stringify(await page.evaluate(() => {
      const h = globalThis.__actionSceneExport;
      return { handle: Boolean(h), dataset: { ...document.querySelector('.action-theater__canvas')?.dataset },
        statistics: h?.fullLion.statistics, draws: h?.fullLion.getDrawStatistics(h.renderer), drums: h?.drums.stats,
        text: document.body.innerText.slice(-1600) };
    })));
    console.error(errors);
    throw error;
  }
  console.log('Scene resources ready; holding videos at 0.1 seconds.');
  const pause = page.getByRole('button', { name: '暂停动作视频', exact: true });
  if (await pause.count()) await pause.click();
  await page.evaluate(async () => {
    const h = globalThis.__actionSceneExport;
    h.stop();
    h.lionRoot.rotation.y = 0;
    await Promise.all([...h.screenRecords.values()].map(async record => {
      const video = record.video;
      if (!video) throw new Error('Screen has no real source video');
      video.pause();
      if (video.readyState < 2) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video decode timeout')), 30_000);
        video.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.load();
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video seek timeout')), 30_000);
        video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.currentTime = Math.min(0.1, video.duration / 2);
      });
      record.videoTexture.needsUpdate = true;
    }));
    h.scene.updateMatrixWorld(true);
    h.camera.updateMatrixWorld(true);
    h.render();
  });
  const snapshot = await page.evaluate(() => {
    const h = globalThis.__actionSceneExport;
    const geometries = new Map(), materials = new Map(), textures = new Map();
    const meshes = [], lights = [], anchors = [];
    const screensByMesh = new Map([...h.screenRecords].map(([id, record]) => [record.object.uuid, { id, ...record }]));
    const underLion = object => { for (let n = object; n; n = n.parent) if (n === h.fullLion.root) return true; return false; };
    const array = attribute => attribute ? Array.from({ length: attribute.count * attribute.itemSize }, (_, index) => attribute[['getX', 'getY', 'getZ', 'getW'][index % attribute.itemSize]](Math.floor(index / attribute.itemSize))) : null;
    const readTexture = (texture, screen) => {
      if (!texture) return null;
      const key = screen ? `${texture.uuid}-screen` : texture.uuid;
      if (textures.has(key)) return textures.get(key).path;
      const image = texture.image;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = image.videoWidth || image.width;
      canvas.height = image.videoHeight || image.height;
      if (!canvas.width || !canvas.height) throw new Error(`Undecoded texture ${texture.name}`);
      if (image.data) {
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        const channels = image.data.length / (canvas.width * canvas.height);
        for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
          for (let channel = 0; channel < 4; channel += 1) data[pixel * 4 + channel] = channel < channels ? image.data[pixel * channels + channel] : 255;
        }
        ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
      } else if (screen) {
        // Bake the screen's contain shader into a portable static PNG.
        const width = canvas.width, height = canvas.height;
        const scale = screen.contain;
        canvas.width = 1920; canvas.height = 1080;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, width, height,
          canvas.width * (1 - scale.x) / 2, canvas.height * (1 - scale.y) / 2,
          canvas.width * scale.x, canvas.height * scale.y);
      } else ctx.drawImage(image, 0, 0);
      const filename = `textures/${key}.png`;
      textures.set(key, { id: key, path: filename, name: texture.name, flipY: texture.flipY,
        repeat: texture.repeat.toArray(), offset: texture.offset.toArray(), rotation: texture.rotation,
        center: texture.center.toArray(), colorSpace: texture.colorSpace, width: canvas.width, height: canvas.height,
        screenContained: Boolean(screen), source: image.currentSrc || image.src || null, png: canvas.toDataURL('image/png') });
      return filename;
    };
    const readMaterial = (material, screen) => {
      if (materials.has(material.uuid)) return material.uuid;
      const result = { id: material.uuid, name: material.name, type: material.type,
        color: material.color?.toArray(), metalness: material.metalness, roughness: material.roughness,
        emissive: material.emissive?.toArray(), emissiveIntensity: material.emissiveIntensity,
        clearcoat: material.clearcoat, clearcoatRoughness: material.clearcoatRoughness,
        specularIntensity: material.specularIntensity, specularColor: material.specularColor?.toArray(),
        side: material.side, transparent: material.transparent, opacity: material.opacity,
        alphaTest: material.alphaTest, normalScale: material.normalScale?.toArray(), envMapIntensity: material.envMapIntensity,
        screenContained: Boolean(screen) };
      for (const field of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap', 'alphaMap', 'aoMap']) result[field] = readTexture(material[field], field === 'map' ? screen : null);
      materials.set(material.uuid, result);
      return material.uuid;
    };
    h.scene.traverseVisible(object => {
      if (underLion(object) || object.name === 'Theater_Polished_Stone_Reflection') return;
      if (object.isLight) {
        lights.push({ name: object.name, type: object.type, color: object.color.toArray(), intensity: object.intensity,
          matrixWorld: object.matrixWorld.toArray(), target: object.target?.getWorldPosition(object.position.clone()).toArray(),
          groundColor: object.groundColor?.toArray(), angle: object.angle, penumbra: object.penumbra,
          distance: object.distance, decay: object.decay, castShadow: object.castShadow });
      } else if (object.isMesh) {
        const geometry = object.geometry;
        if (!geometries.has(geometry.uuid)) geometries.set(geometry.uuid, { id: geometry.uuid, name: geometry.name,
          position: array(geometry.attributes.position), normal: array(geometry.attributes.normal), uv: array(geometry.attributes.uv),
          index: array(geometry.index), groups: geometry.groups });
        const screen = screensByMesh.get(object.uuid);
        const material = Array.isArray(object.material) ? object.material.map(value => readMaterial(value, screen)) : readMaterial(object.material, screen);
        if (object.isInstancedMesh) {
          const matrix = object.matrixWorld.clone();
          for (let index = 0; index < object.count; index += 1) {
            object.getMatrixAt(index, matrix);
            matrix.premultiply(object.matrixWorld);
            meshes.push({ name: object.name, geometry: geometry.uuid, material, matrixWorld: matrix.toArray(), sourceType: object.type, instanceIndex: index, castShadow: object.castShadow, receiveShadow: object.receiveShadow });
          }
        } else meshes.push({ name: object.name, geometry: geometry.uuid, material, matrixWorld: object.matrixWorld.toArray(), sourceType: object.type, castShadow: object.castShadow, receiveShadow: object.receiveShadow });
      } else if (object.isObject3D && !object.isScene && !object.isCamera) anchors.push({ name: object.name, type: object.type, matrixWorld: object.matrixWorld.toArray() });
    });
    const screens = h.screenDefinitions.map(definition => {
      const record = h.screenRecords.get(definition.id);
      return { ...definition, brightness: record.brightness, contain: record.contain.toArray(), screenContained: true,
        video: record.video.currentSrc || record.video.src, videoWidth: record.video.videoWidth, videoHeight: record.video.videoHeight,
        videoTime: record.video.currentTime, texture: materials.get(record.material.uuid).map };
    });
    const canvas = h.renderer.domElement;
    // preserveDrawingBuffer is false: read pixels in the same JS task as render.
    h.render();
    const canvasPNG = canvas.toDataURL('image/png');
    return { schemaVersion: 1, coordinateSystem: 'THREE_COLUMN_MAJOR_Y_UP_METERS',
      camera: { matrixWorld: h.camera.matrixWorld.toArray(), projectionMatrix: h.camera.projectionMatrix.toArray(), near: h.camera.near, far: h.camera.far, fov: h.camera.fov, view: h.camera.view, target: h.controls.target.toArray() },
      lion: { matrixWorld: h.fullLion.root.matrixWorld.toArray(), statistics: h.fullLion.statistics, drawStatistics: h.fullLion.getDrawStatistics(h.renderer) },
      viewport: { width: canvas.width, height: canvas.height },
      environment: { settings: JSON.parse(canvas.dataset.hdriSettings), source: canvas.dataset.hdriName, exposure: h.renderer.toneMappingExposure, background: h.scene.background.toArray() },
      architecture: { parameters: h.architecture.parameters, componentCounts: h.architecture.root.userData.componentCounts },
      drums: h.drums.stats, geometries: [...geometries.values()], materials: [...materials.values()], textures: [...textures.values()], meshes, lights, anchors, screens,
      canvasPNG };
  });
  for (const texture of snapshot.textures) {
    await writeFile(path.join(output, texture.path), Buffer.from(texture.png.split(',')[1], 'base64'));
    delete texture.png;
  }
  await writeFile(path.join(output, 'web-canvas.png'), Buffer.from(snapshot.canvasPNG.split(',')[1], 'base64'));
  delete snapshot.canvasPNG;
  await page.screenshot({ path: path.join(output, 'web-page.png'), animations: 'disabled' });
  snapshot.revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  snapshot.capturedAt = new Date().toISOString();
  snapshot.errors = errors;
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  if (snapshot.lion.statistics.groups !== 33 || snapshot.lion.statistics.strands !== 2295421 || snapshot.screens.length !== 4) throw new Error('Incomplete source capture');
  await writeFile(snapshotPath, JSON.stringify(snapshot), { flag: overwrite ? 'w' : 'wx' });
  console.log(JSON.stringify({ output, geometries: snapshot.geometries.length, materials: snapshot.materials.length, textures: snapshot.textures.length, meshes: snapshot.meshes.length, lights: snapshot.lights.length, lion: snapshot.lion.statistics, screens: snapshot.screens.map(value => ({ id: value.id, videoTime: value.videoTime })) }, null, 2));
} finally {
  await browser.close();
}
