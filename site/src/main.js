const modelUrl = new URL('../assets/models/lion-overall.glb', import.meta.url).href;
const dataUrl = new URL('../data/lion-structure.json', import.meta.url).href;

const state = {
  hotspots: [],
  selectedId: null,
  model: null,
  controls: null,
  sceneReady: false,
};

function hasUsableWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!context) return false;
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : '';
    return !/swiftshader|software rasterizer|llvmpipe/i.test(renderer);
  } catch {
    return false;
  }
}

const $ = (selector) => document.querySelector(selector);
const introVideo = $('#introVideo');
const modelStage = $('#modelStage');
const chapterStage = $('#chapterStage');
const transitionVeil = $('#transitionVeil');
const modelStatus = $('#modelStatus');
const loadingPanel = $('#loadingPanel');
const loadingText = $('#loadingText');
const entryGate = $('#entryGate');
const entryFeedback = $('#entryFeedback');
const entryTitleArt = $('.entry-title-art');
const entryLionVideo = $('#entryLionVideo');
const enterWork = $('#enterWork');
const structureLayer = $('#structureLayer');
const structureDepth = $('#structureDepth');
const structureDepthValue = $('#structureDepthValue');
const chapterContent = {
  action: {
    index: '04 / 06',
    kicker: '动作章节 / MOTION',
    title: '动作',
    lead: '从入场、摆头到收势，动作模块将在时间轴中记录醒狮的节奏变化。',
    module: 'MODULE 04',
    panelTitle: '动作时间轴',
    panelText: '这里将接入动作视频、关键帧和动作说明，形成可浏览的动作信息层。',
    nodes: ['入场', '展开', '收势'],
  },
  state: {
    index: '05 / 06',
    kicker: '神态章节 / EXPRESSION',
    title: '神态',
    lead: '通过眼神、摆头和嘴部变化，记录醒狮由静到动的神态线索。',
    module: 'MODULE 05',
    panelTitle: '神态观察',
    panelText: '这里将接入神态视频与定格分析，建立动作和神态之间的对应关系。',
    nodes: ['注视', '警觉', '唤醒'],
  },
  score: {
    index: '06 / 06',
    kicker: '评分章节 / CRITERIA',
    title: '评分',
    lead: '将醒狮的造型、动作和神态整理为可阅读的观察维度。',
    module: 'MODULE 06',
    panelTitle: '评价维度',
    panelText: '这里将接入资料来源和评价指标，形成透明、可追溯的展示模块。',
    nodes: ['造型', '动作', '神态'],
  },
};

const ui = {
  panelIndex: $('#panelIndex'),
  panelKicker: $('#panelKicker'),
  panelTitle: $('#panelTitle'),
  panelMaterial: $('#panelMaterial'),
  panelDescription: $('#panelDescription'),
  panelFunction: $('#panelFunction'),
  panelSource: $('#panelSource'),
  hotspotList: $('#hotspotList'),
  hotspots: $('#hotspots'),
};

function setStatus(message) {
  modelStatus.textContent = message;
}

function setActiveRoute(route) {
  document.querySelectorAll('[data-route]').forEach((button) => {
    const active = button.dataset.route === route;
    button.classList.toggle('is-current', active);
    button.toggleAttribute('aria-current', active);
  });
}

function showModelStage(chapter = 'model') {
  document.body.classList.remove('is-transitioning');
  document.body.classList.remove('is-chapter', 'is-intro');
  document.body.classList.add('is-model');
  document.body.dataset.state = 'model';
  modelStage.setAttribute('aria-hidden', 'false');
  chapterStage.setAttribute('aria-hidden', 'true');
  modelStage.dataset.chapter = chapter;
  setStructureMode(chapter === 'structure');
  setStatus(chapter === 'structure' ? '结构框架 · 模型可视化' : '整体模型 · 可交互');
  setActiveRoute(chapter);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function transitionToModel(afterShow) {
  if (document.body.classList.contains('is-model')) {
    afterShow?.();
    return;
  }
  document.body.classList.add('is-transitioning');
  introVideo.pause();
  window.setTimeout(() => {
    showModelStage();
    afterShow?.();
  }, 280);
}

function startIntro() {
  document.body.dataset.state = 'intro';
  document.body.classList.remove('is-model', 'is-chapter');
  document.body.classList.add('is-intro');
  modelStage.setAttribute('aria-hidden', 'true');
  chapterStage.setAttribute('aria-hidden', 'true');
  setStructureMode(false);
  setActiveRoute('intro');
  if (introVideo.ended) introVideo.currentTime = 0;
  const playAttempt = introVideo.play();
  if (playAttempt?.catch) {
    playAttempt.catch((error) => console.warn('Intro video autoplay was blocked.', error));
  }
}

function showChapterStage(route) {
  const content = chapterContent[route];
  if (!content) return;
  document.body.classList.remove('is-transitioning', 'is-model', 'is-intro');
  document.body.classList.add('is-chapter');
  document.body.dataset.state = route;
  modelStage.setAttribute('aria-hidden', 'true');
  chapterStage.setAttribute('aria-hidden', 'false');
  chapterStage.dataset.chapter = route;
  setStructureMode(false);
  $('#chapterIndex').textContent = content.index;
  $('#chapterKicker').textContent = content.kicker;
  $('#chapterTitle').textContent = content.title;
  $('#chapterLead').textContent = content.lead;
  $('#chapterPanelIndex').textContent = content.module;
  $('#chapterPanelTitle').textContent = content.panelTitle;
  $('#chapterPanelText').textContent = content.panelText;
  $('#chapterTrack').innerHTML = `<span class="chapter-track-line"></span>${content.nodes.map((node, index) => `<button type="button"><b>0${index + 1}</b><span>${node}</span></button>`).join('')}`;
  setActiveRoute(route);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateStructureDepth(value = structureDepth.value) {
  const depth = Number(value);
  structureLayer?.style.setProperty('--structure-depth', `${depth / 100}`);
  if (structureDepthValue) structureDepthValue.value = `${depth}%`;
  structureLayer?.querySelectorAll('.structure-callout').forEach((callout) => {
    callout.classList.toggle('is-revealed', Number(callout.dataset.depth) <= depth);
  });
}

function setStructureMode(active) {
  if (!structureLayer || !structureDepth) return;
  modelStage.classList.toggle('is-structure', active);
  structureLayer.hidden = !active;
  if (active) updateStructureDepth();
}

function setupStructureMode() {
  structureDepth?.addEventListener('input', (event) => updateStructureDepth(event.target.value));
  updateStructureDepth();
}

function setupIntro() {
  introVideo.addEventListener('ended', () => transitionToModel(), { once: true });
  introVideo.addEventListener('error', () => {
    console.error('Intro video unavailable.');
  });
}

function setupEntryLionVideo() {
  if (!entryLionVideo) return;
  entryLionVideo.addEventListener('error', () => {
    entryGate?.classList.add('entry-video-error');
    console.error('Homepage lion loop video unavailable; showing poster fallback.');
  });
  const playAttempt = entryLionVideo.play();
  playAttempt?.catch?.(() => {
    entryGate?.classList.add('entry-video-paused');
  });
}

function setupTitleMotion(title) {
  if (!title) return;
  const root = title.closest('.final-home');
  const titleLayer = title.closest('.entry-title-live2d');
  if (!root || !titleLayer || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;

  const render = (time) => {
    const driftX = Math.sin(time / 2600) * 2.4;
    const driftY = Math.cos(time / 3100) * 2.2;
    title.style.setProperty('--title-shift-x', `${(pointerX * 10 + driftX).toFixed(2)}px`);
    title.style.setProperty('--title-shift-y', `${(pointerY * 7 + driftY).toFixed(2)}px`);
    frame = window.requestAnimationFrame(render);
  };

  root.addEventListener('pointermove', (event) => {
    const bounds = root.getBoundingClientRect();
    pointerX = Math.min(1, Math.max(-1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    pointerY = Math.min(1, Math.max(-1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
  });
  root.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
  });
  frame = window.requestAnimationFrame(render);

  return () => window.cancelAnimationFrame(frame);
}

function showEntryFeedback(message) {
  entryFeedback.textContent = message;
  entryFeedback.classList.add('is-visible');
  window.clearTimeout(showEntryFeedback.timeoutId);
  showEntryFeedback.timeoutId = window.setTimeout(() => {
    entryFeedback.classList.remove('is-visible');
  }, 2400);
}

function routeFromEntry(route) {
  setActiveRoute(route);
  if (route === 'intro') {
    if (document.body.dataset.state === 'intro') return;
    window.setTimeout(startIntro, 360);
    return;
  }
  if (route === 'model') {
    transitionToModel(() => showModelStage('model'));
    return;
  }
  if (route === 'structure') {
    transitionToModel(() => showModelStage('structure'));
    return;
  }
  if (chapterContent[route]) {
    showChapterStage(route);
  }
}

function setupEntryInteractions() {
  enterWork.dataset.interactionsReady = 'true';
  enterWork.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    routeFromEntry('intro');
  });
  entryGate.addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) routeFromEntry(routeButton.dataset.route);
  });
  document.addEventListener('click', (event) => {
    const routeButton = event.target.closest('.chapter-route');
    if (routeButton) routeFromEntry(routeButton.dataset.route);
  });
}

async function createScene() {
  const container = $('#sceneContainer');
  let THREE;
  let OrbitControls;
  let GLTFLoader;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch (error) {
    console.error(error);
    loadingPanel.style.display = 'none';
    loadingText.textContent = '3D引擎暂不可用 · 保留结构预览';
    setStatus('3D引擎待载入 · 结构预览');
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b100f);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
  camera.position.set(2.7, 1.15, 4.1);

  if (!hasUsableWebGL()) {
    loadingPanel.style.display = 'none';
    loadingText.textContent = '3D引擎暂不可用 · 保留结构预览';
    setStatus('3D引擎待载入 · 结构预览');
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.error('Overall model WebGL unavailable', error);
    loadingPanel.style.display = 'none';
    loadingText.textContent = '3D引擎暂不可用 · 保留结构预览';
    setStatus('3D引擎待载入 · 结构预览');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.42;
  controls.minDistance = 1.8;
  controls.maxDistance = 8;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xd5c7a4, 0x0b1513, 1.9));
  const key = new THREE.DirectionalLight(0xffe2b2, 3.3);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8eb5a3, 1.8);
  rim.position.set(4, 3, -4);
  scene.add(rim);
  const fill = new THREE.PointLight(0xa84431, 5, 7, 2);
  fill.position.set(-2, 1.2, 2.4);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x0a0e0d, transparent: true, opacity: 0.72 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.15;
  scene.add(ground);

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener('resize', resize);
  resize();

  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      state.model = gltf.scene;
      state.model.name = 'LionHead_Overall';
      state.model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) object.material.needsUpdate = true;
      });
      const box = new THREE.Box3().setFromObject(state.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      state.model.position.sub(center);
      state.model.position.y -= maxSize * 0.03;
      state.model.scale.setScalar(2.2 / maxSize);
      scene.add(state.model);
      camera.position.set(2.7, 1.05, 4.0);
      controls.target.set(0, 0.08, 0);
      controls.update();
      state.sceneReady = true;
      loadingPanel.style.display = 'none';
      $('#modelFallback').style.opacity = '0';
      setStatus('模型已载入 · 可交互');
    },
    (event) => {
      if (event.total) {
        loadingText.textContent = `正在载入醒狮模型 ${Math.round((event.loaded / event.total) * 100)}%`;
      }
    },
    () => {
      loadingText.textContent = '模型载入失败 · 保留结构预览';
      setStatus('模型载入失败 · 结构预览');
    }
  );

  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  render();

  $('#toggleRotate').addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    $('#toggleRotate').classList.toggle('active', controls.autoRotate);
  });

  state.controls = controls;
}

function renderHotspots() {
  ui.hotspots.replaceChildren();
  ui.hotspotList.replaceChildren();
  state.hotspots.forEach((item, index) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'hotspot';
    marker.dataset.id = item.id;
    marker.style.left = item.position.left;
    marker.style.top = item.position.top;
    marker.setAttribute('aria-label', `查看${item.name}`);
    marker.innerHTML = `<span aria-hidden="true">+</span><span class="hotspot-label">${item.name}</span>`;
    marker.addEventListener('click', () => selectHotspot(item.id));
    ui.hotspots.appendChild(marker);

    const listButton = document.createElement('button');
    listButton.type = 'button';
    listButton.dataset.id = item.id;
    listButton.innerHTML = `<span class="list-number">${String(index + 1).padStart(2, '0')}</span><span class="list-name">${item.name}</span>`;
    listButton.addEventListener('click', () => selectHotspot(item.id));
    ui.hotspotList.appendChild(listButton);
  });
}

function selectHotspot(id) {
  const item = state.hotspots.find((hotspot) => hotspot.id === id);
  if (!item) return;
  state.selectedId = id;
  const index = state.hotspots.indexOf(item) + 1;
  ui.panelIndex.textContent = `${String(index).padStart(2, '0')} / ${String(state.hotspots.length).padStart(2, '0')}`;
  ui.panelKicker.textContent = item.kicker;
  ui.panelTitle.textContent = item.name;
  ui.panelMaterial.textContent = item.material;
  ui.panelDescription.textContent = item.description;
  ui.panelFunction.textContent = item.function;
  ui.panelSource.textContent = item.sourceTag;
  document.querySelectorAll('.hotspot, .hotspot-list button').forEach((element) => {
    element.classList.toggle('active', element.dataset.id === id);
  });
}

async function loadData() {
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    const data = await response.json();
    state.hotspots = data.hotspots;
    renderHotspots();
    selectHotspot(state.hotspots[0]?.id);
  } catch (error) {
    console.error(error);
    ui.panelDescription.textContent = '结构数据暂时无法载入，请检查本地服务路径。';
    ui.panelFunction.textContent = '模型仍可继续浏览。';
    ui.panelSource.textContent = '数据状态 · 待检查';
  }
}

setupIntro();
setupEntryLionVideo();
setupEntryInteractions();
setupStructureMode();
setupTitleMotion(entryTitleArt);
createScene();
loadData();
