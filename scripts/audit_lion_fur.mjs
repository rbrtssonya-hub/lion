import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Actual native-render comparisons against the last shipped scene. The capture
// hooks exist only in intercepted Vite responses and never ship in the app.
// node scripts/audit_lion_fur.mjs --url=http://127.0.0.1:5198 --output=tmp/lion-fur-final
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const baseURL = args.url ?? 'http://127.0.0.1:5198';
const output = path.resolve(project, args.output ?? 'tmp/lion-fur-final');
const baselineRef = args.ref ?? '5b2a307';
const chapters = (args.chapters ?? 'theater,structure').split(',');
const views = (args.views ?? 'default,side,back').split(',');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const imports = code => [...code.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)].map(m => m[2]);
const report = { startedAt:new Date().toISOString(), revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), baselineRef, viewport:{width:1920,height:1080,deviceScaleFactor:1}, cases:[], errors:[], assets:[] };
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(project,'source/public/assets/models/lion-user-hair.json'),'utf8'));
for(const file of ['source/models/user-lion-2026-10-20.blend','source/public/assets/models/lion-user-full.glb','source/public/assets/models/lion-user-hair.json',...manifest.groups.map(g=>'source/public/'+g.path)]){
 const bytes=await readFile(path.join(project,file));report.assets.push({path:file,bytes:bytes.length,sha256:sha(bytes)});
}
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


const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--ignore-gpu-blocklist']});
try {
 for(const variant of ['before','after']){
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(()=>{if(window!==window.top)return;sessionStorage.setItem('nanfeng-lion:intro-seen:v1','1');sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1','1');localStorage.setItem('nanfeng-lion:developer-settings:v1',JSON.stringify({carouselAutoplay:false,pushPage:false}));});
  for(const name of ['lionScene.js','actionTheaterScene.js'])await context.route(`**/src/services/${name}*`,async route=>{
   const response=await route.fetch();await route.fulfill({response,body:injectHandles(await response.text(),name),contentType:'application/javascript'});
  });
  if(variant==='before')for(const name of ['lionHdriEnvironment.js','lionLightingSettings.js']){
   const relative=`src/services/${name}`,raw=await readFile(path.join(project,relative),'utf8');
   const baseline=execFileSync('git',['show',`${baselineRef}:${relative}`],{cwd:project,encoding:'utf8'});
   await context.route(`**/${relative}*`,async route=>{
    const response=await route.fetch(),served=await response.text(),original=imports(raw),resolved=imports(served);
    if(original.length!==resolved.length)throw new Error('Vite import count changed '+relative);
    const mapping=new Map(original.map((value,index)=>[value,resolved[index]]));
    const code=baseline.replace(/\bfrom\s*(['"])([^'"]+)\1/g,(match,q,value)=>{if(!mapping.has(value))throw new Error('Missing baseline import '+value);return `from ${q}${mapping.get(value)}${q}`;});
    await route.fulfill({response,body:code,contentType:'application/javascript'});
   });
  }
  const page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push({variant,error:String(error)}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({variant,error:message.text()});});
  for(const chapter of chapters){
   await page.goto(`${baseURL}/#/${chapter==='theater'?'action':'model'}`);
   await page.locator('#startupLoading').waitFor({state:'detached'});
   await page.waitForFunction(chapter=>{const h=globalThis.__lionLightingAudit?.[chapter];return h?.renderer.domElement.dataset.hdriState==='ready'&&h.fullLion.getDrawStatistics(h.renderer).groups===33;},chapter);
   // Only the inspection context suppresses programmatic playback after startup.
   // All four screen frames are then held at the same source time in both runs.
   await page.evaluate(async()=>{
    HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
    await Promise.all([...document.querySelectorAll('video')].map(async video=>{video.pause();if(video.readyState<2)return;await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);resolve();};video.addEventListener('seeked',done,{once:true});timer=setTimeout(done,1000);video.currentTime=1;});}));
   });
   for(const view of views){
    await positionView(page,chapter,view);
    if(chapter==='theater')await page.evaluate(chapter=>{const h=globalThis.__lionLightingAudit[chapter],direction=h.camera.position.clone().sub(h.controls.target).normalize();h.camera.position.copy(h.controls.target).addScaledVector(direction,3.8);h.camera.lookAt(h.controls.target);h.camera.updateMatrixWorld();h.render();},chapter);
    const name=`${variant}-${chapter}-${view}`,observation=await measure(page,chapter),{maskImage,...result}=observation;
    await writeFile(path.join(output,`${name}-mask.png`),Buffer.from(maskImage.split(',')[1],'base64'));
    const capture=await page.evaluate(chapter=>{
     const h=globalThis.__lionLightingAudit[chapter];h.render();const gl=h.renderer.getContext();
     const sourceMaterials=new Map(),geometries=[];
     h.fullLion.root.traverse(object=>{
      if(object.geometry)geometries.push({name:object.name,id:object.geometry.uuid,instances:object.geometry.instanceCount??1,indices:object.geometry.index?.count??0});
      for(const m of(Array.isArray(object.material)?object.material:[object.material]))if(m)sourceMaterials.set(m.uuid,{name:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,specularIntensity:m.specularIntensity,sheen:m.sheen,sheenColor:m.sheenColor?.toArray(),sheenRoughness:m.sheenRoughness,envMapIntensity:m.envMapIntensity,probe:m.userData.lionDiffuseProbe??null});
     });
     // A bounded same-device render sample, including GPU completion. These
     // timings describe this fixed view, not animation FPS or other computers.
     const timings=[];for(let index=0;index<20;index++){const started=performance.now();h.render();gl.finish();if(index>=4)timings.push(performance.now()-started);}
     timings.sort((a,b)=>a-b);
     return {camera:{matrixWorld:h.camera.matrixWorld.toArray(),projectionMatrix:h.camera.projectionMatrix.toArray(),near:h.camera.near,far:h.camera.far},lion:{matrixWorld:h.fullLion.root.matrixWorld.toArray()},viewport:{width:h.renderer.domElement.width,height:h.renderer.domElement.height},image:h.renderer.domElement.toDataURL('image/png'),materials:[...sourceMaterials.values()],geometries,performance:{samples:timings,medianMs:timings[Math.floor(timings.length/2)],p95Ms:timings[Math.floor(timings.length*.95)]},nodes:h.fullLion.root.children.slice(0,5).map(n=>({name:n.name,matrixWorld:n.matrixWorld.toArray()}))};
    },chapter);
    const {image,...camera}=capture;
    await writeFile(path.join(output,`${name}-canvas.png`),Buffer.from(image.split(',')[1],'base64'));
    await writeFile(path.join(output,`${name}-camera.json`),JSON.stringify(camera,null,2));
    await page.screenshot({path:path.join(output,`${name}.png`),animations:'disabled'});
    const assertions={allGroups:result.drawStatistics.groups===33,allStrands:result.drawStatistics.strands===2295421,allPoints:result.drawStatistics.points===19957105,noGLError:result.glError===0,materialsRestored:result.restoredMaterials,redVisible:result.metrics.red.pixels>100,ivoryVisible:result.metrics.ivory.pixels>100,probe:variant==='before'?camera.materials.every(m=>!m.probe):camera.materials.some(m=>m.probe?.status==='compiled')};
    report.cases.push({name,variant,chapter,view,...result,capture:camera,assertions});
    await writeFile(path.join(output,'audit.json'),JSON.stringify(report,null,2));
    console.log(`${name}: red<60 ${(100*result.metrics.red.ratios.redUnder60).toFixed(2)}%; ivory p5/95 ${result.metrics.ivory.luminance.p5}/${result.metrics.ivory.luminance.p95}; render ${capture.performance.medianMs.toFixed(2)}ms; checks ${Object.values(assertions).every(Boolean)}`);
   }
  }
  await context.close();
 }
} catch(error){report.errors.push({error:String(error.stack??error)});}
finally{await browser.close();}
report.comparisons=[];
for(const after of report.cases.filter(c=>c.variant==='after')){
 const before=report.cases.find(c=>c.variant==='before'&&c.chapter===after.chapter&&c.view===after.view);
 if(!before)continue;
 const materialFacts=c=>c.capture.materials.map(({probe,...value})=>value);
 report.comparisons.push({chapter:after.chapter,view:after.view,sameCamera:JSON.stringify(before.capture.camera)===JSON.stringify(after.capture.camera),samePose:JSON.stringify(before.capture.lion)===JSON.stringify(after.capture.lion),sameMaterials:JSON.stringify(materialFacts(before))===JSON.stringify(materialFacts(after)),sameCounts:JSON.stringify(before.statistics)===JSON.stringify(after.statistics),redUnder60:{before:before.metrics.red.ratios.redUnder60,after:after.metrics.red.ratios.redUnder60},ivoryRange:{before:before.metrics.ivory.luminance,after:after.metrics.ivory.luminance},renderMedianMs:{before:before.capture.performance.medianMs,after:after.capture.performance.medianMs}});
}
report.assetsUnchanged=true;for(const asset of report.assets)if(sha(await readFile(path.join(project,asset.path)))!==asset.sha256)report.assetsUnchanged=false;
report.finishedAt=new Date().toISOString();
report.passed=report.cases.length===2*chapters.length*views.length&&!report.errors.length&&report.cases.every(c=>Object.values(c.assertions).every(Boolean))&&report.comparisons.length===chapters.length*views.length&&report.comparisons.every(c=>c.sameCamera&&c.samePose&&c.sameMaterials&&c.sameCounts)&&report.assetsUnchanged;
await writeFile(path.join(output,'audit.json'),JSON.stringify(report,null,2));
console.log(`Native capture/integrity: ${report.passed?'PASS':'FAIL'}; visual judgement is independent.`);if(!report.passed)process.exitCode=1;
