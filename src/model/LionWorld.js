import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { PartRegistry } from './PartRegistry.js';
import { frameLayout } from '../interaction/layout.mjs';
import adaptation from '../content/model-adaptation.json';
import { gsap } from 'gsap';

// All six editorial endpoints are composed in the same complete 3:2 aperture.
// Offsets are fractions of the measured part's bounds, never mesh transforms.
const HANDOFF_FRAMINGS = {
  brows: { direction: [0.30, 0.05, 1], offset: [0.10, -0.10, 0], distanceFactor: 1.0, description: '前部斜视眉眼，眉弧围合双眼' },
  crown: { direction: [0.38, 0.85, 1], offset: [0, 0.10, 0], distanceFactor: 1.55, description: '高位斜视额冠，额珠与冠饰呈层叠关系' },
  beard: { direction: [0.60, -0.17, 1], offset: [0, -0.10, 0.05], distanceFactor: 1.05, description: '低位侧视垂须，白色纤维形成主体' },
  body: { direction: [1, 0.36, -0.08], offset: [0, 0, 0], distanceFactor: 0.85, description: '近侧视织锦躯干，横向铺展纹样' },
  trim: { direction: [0.85, 0.85, -1], offset: [0, 0.10, -0.15], distanceFactor: 1.02, description: '高位后斜视云边，连续红色起伏形成节律' },
  mouth: { direction: [0.25, -0.20, 1], offset: [0, -0.05, 0.05], distanceFactor: 0.95, description: '正前低位口部，牙弧、舌与须构成横向层次' },
};

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
const v = (a) => new THREE.Vector3(...a);
const ease = t => 1 - Math.pow(1 - t, 3);

function releaseGraph(root, extras = []) {
  const geometries = new Set(), materials = new Set(extras), textures = new Set(), images = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const value of [object.material, object.userData.atlasOriginal?.material]) {
      if (value) (Array.isArray(value) ? value : [value]).forEach(material => materials.add(material));
    }
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    material.dispose();
  });
  geometries.forEach(geometry => { geometry.disposeBoundsTree?.(); geometry.dispose(); });
  textures.forEach(texture => {
    const data = texture.source?.data;
    (Array.isArray(data) ? data : [data]).forEach(image => { if (image?.close) images.add(image); });
    texture.dispose();
  });
  images.forEach(image => image.close());
}

/** Owns rendering and GPU resources. React only owns the interface. */
export class LionWorld {
  constructor(container, options) {
    this.container = container;
    this.options = options;
    this.disposed = false;
    this.active = true;
    this.interactive = true;
    this.mode = 'original';
    this.selected = null;
    this.hovered = null;
    this.meshes = [];
    this.resources = new Set();
    this.cameraDirection = v(options.cameraDirection || [6, 3, 8]).normalize();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.02, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '醒狮三维模型，拖动旋转，滚轮缩放，点击部位进入研究');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.89;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.addEventListener('start', () => { this.transition = null; this.cancelFlight(); });
    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a9796, 0.75));
    const key = new THREE.DirectionalLight(0xfff3e1, 1.7);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: 0.1, far: 20 });
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.018;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd6eeed, 0.5);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(environment, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.6;
    environment.dispose();
    pmrem.dispose();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.pointer = new THREE.Vector2();
    this.makeGround();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.bindEvents();
    this.lastStats = performance.now();
    this.frames = 0;
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
  }

  makeGround() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(55,37,21,.26)');
    gradient.addColorStop(0.55, 'rgba(65,44,25,.11)');
    gradient.addColorStop(1, 'rgba(65,44,25,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    this.resources.add(texture);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 5), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.025;
    this.scene.add(ground);
    this.ground = ground;
  }

  async load(url, definitions) {
    try {
      this.draco = new DRACOLoader().setDecoderPath('/draco/');
      const gltf = await new GLTFLoader().setDRACOLoader(this.draco).loadAsync(url, event => {
        if (!this.disposed && event.total) this.options.onProgress?.(event.loaded / event.total * 90);
      });
      if (this.disposed) {
        releaseGraph(gltf.scene);
        return;
      }
      this.model = new THREE.Group();
      this.model.add(gltf.scene);
      this.scene.add(this.model);
      this.model.updateMatrixWorld(true);
      const originalBounds = new THREE.Box3().setFromObject(this.model);
      const size = originalBounds.getSize(new THREE.Vector3());
      const center = originalBounds.getCenter(new THREE.Vector3());
      this.sourceScale = 5.2 / Math.max(size.x, size.y, size.z);
      this.model.scale.setScalar(this.sourceScale);
      this.model.position.set(-center.x * this.sourceScale, -originalBounds.min.y * this.sourceScale, -center.z * this.sourceScale);
      this.model.updateMatrixWorld(true);
      const geometries = new Set();
      this.model.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (let parent = mesh.parent; parent; parent = parent.parent) {
          if (parent.userData.atlasPart) {
            mesh.userData = { ...parent.userData, ...mesh.userData };
            break;
          }
        }
        mesh.userData.derivedHair = mesh.userData.derivation === 'sampled-original-hair-ribbon';
        mesh.castShadow = !mesh.userData.derivedHair;
        mesh.receiveShadow = true;
        if (!mesh.userData.derivedHair && (mesh.userData.sourceParticleEmitter || adaptation.emitterSources.includes(mesh.userData.sourceName))) {
          const offsetMaterial = material => {
            const copy = material.clone();
            copy.polygonOffset = true;
            copy.polygonOffsetFactor = -4;
            copy.polygonOffsetUnits = -4;
            this.adaptedOriginalMaterials ||= new Set();
            this.adaptedOriginalMaterials.add(material);
            return copy;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(offsetMaterial) : offsetMaterial(mesh.material);
        }
        mesh.userData.atlasOriginal = {
          position: mesh.position.clone(),
          material: mesh.material,
          visible: mesh.visible,
          center: new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()),
        };
        this.meshes.push(mesh);
        geometries.add(mesh.geometry);
      });
      let indexed = 0;
      for (const geometry of geometries) {
        if ((geometry.index?.count || geometry.attributes.position.count) > 9000) geometry.computeBoundsTree({ maxLeafSize: 12 });
        if (++indexed % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        if (this.disposed) return;
      }
      this.registry = new PartRegistry(this.model, definitions);
      this.bounds = new THREE.Box3().setFromObject(this.model);
      this.overallCenter = this.bounds.getCenter(new THREE.Vector3());
      this.fitOverall(false);
      if (this.pendingView) { this.setView(this.pendingView); this.pendingView = null; }
      this.options.onReady?.(this.registry, { meshes: this.meshes.length, sourceScale: this.sourceScale });
      this.options.onProgress?.(100);
    } catch (error) {
      if (!this.disposed) this.options.onError?.(error.message || '模型加载失败');
    }
  }

  setView({ selected, mode }) {
    if (!this.registry) { this.pendingView = { selected, mode }; return; }
    this.resize(false);
    const changed = this.selected !== selected;
    if (changed && !this.selected && selected) this.savedOverview = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.selected = selected;
    this.mode = mode;
    this.applyAppearance();
    if (changed) {
      if (selected) {
        const part = this.registry.get(selected);
        if (part) {
          this.registry.analyze(selected);
          this.fitPart(part);
        }
      } else if (this.savedOverview) {
        this.moveCamera(this.savedOverview.position, this.savedOverview.target);
      } else this.fitOverall();
    }
  }

  materialVariant(material, kind) {
    const key = `${material.uuid}:${kind}`;
    this.materialCache ||= new Map();
    if (this.materialCache.has(key)) return this.materialCache.get(key);
    const copy = material.clone();
    if (kind === 'wireframe') {
      copy.wireframe = true;
      copy.color?.set('#a54435');
      copy.map = null;
      copy.transparent = false;
      copy.opacity = 1;
      copy.metalness = 0;
      copy.roughness = 1;
    } else if (kind === 'hover') {
      copy.emissive?.set('#6c2110');
      copy.emissiveIntensity = 0.3;
    }
    this.materialCache.set(key, copy);
    return copy;
  }

  applyAppearance() {
    for (const mesh of this.meshes) {
      const base = mesh.userData.atlasOriginal;
      const part = this.registry.meshToPart.get(mesh.uuid);
      const relevant = !this.selected || part?.id === this.selected;
      mesh.visible = base.visible;
      const kind = this.mode === 'wireframe' && relevant ? 'wireframe' : (part?.id === this.hovered ? 'hover' : null);
      mesh.material = kind ? (Array.isArray(base.material) ? base.material.map(m => this.materialVariant(m, kind)) : this.materialVariant(base.material, kind)) : base.material;
    }
  }

  fitOverall(animate = true) {
    if (!this.bounds) return;
    const size = this.bounds.getSize(new THREE.Vector3());
    const aspectFactor = this.camera.aspect < 1 ? 1 / this.camera.aspect : 1;
    const distance = Math.max(size.x, size.y, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(17))) * 0.99 * Math.min(aspectFactor, 1.8);
    const position = this.overallCenter.clone().add(this.cameraDirection.clone().multiplyScalar(distance));
    this.moveCamera(position, this.overallCenter, animate);
  }

  fitPart(part) {
    const pose = this.getPartPose(part.id);
    if (pose) this.moveCamera(v(pose.position), v(pose.target));
  }

  getPartPose(id) {
    const part = this.registry?.get(id);
    if (!part) return null;
    const framing = HANDOFF_FRAMINGS[id];
    const size = part.size;
    const target = part.center.clone().add(new THREE.Vector3(...framing.offset).multiply(size));
    const distance = Math.max(size.x, size.y, size.z, 0.65) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * framing.distanceFactor;
    const position = target.clone().add(v(framing.direction).normalize().multiplyScalar(distance));
    return { id, position: position.toArray(), target: target.toArray(), fov: this.camera.fov, aspect: 1.5, framing, bounds: { min: part.bounds.min.toArray(), max: part.bounds.max.toArray() } };
  }

  getCameraPose() {
    return { position: this.camera.position.toArray(), target: this.controls.target.toArray(), fov: this.camera.fov, aspect: this.camera.aspect, selected: this.selected };
  }

  setInteractive(value) {
    this.interactive = !!value;
    this.controls.enabled = this.interactive;
    this.controls.autoRotate = false;
    this.hovered = null;
    this.down = null;
    this.renderer.domElement.style.cursor = this.interactive ? 'grab' : 'default';
    if (this.registry) this.applyAppearance();
    this.options.onHover?.(null);
    if (!this.interactive) this.options.onLabels?.([]);
  }

  setActive(value) {
    this.active = !!value;
    if (!this.active) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    } else if (!this.disposed && !document.hidden && !this.frame) {
      this.lastStats = performance.now();
      this.frames = 0;
      this.frame = requestAnimationFrame(this.animate);
    }
  }

  cancelFlight() {
    this.cameraFlight?.kill();
    this.cameraFlight = null;
    if (this.flightResolver) this.flightResolver({ completed: false });
    this.flightResolver = null;
    if (this.controls) this.controls.enableDamping = true;
  }

  flyCameraTo(pose, { duration = 2.2, onComplete } = {}) {
    this.cancelFlight();
    if (this.disposed) return Promise.resolve({ completed: false });
    this.setActive(true);
    this.transition = null;
    this.controls.enableDamping = false;
    this.controls.update();
    const fromTarget = this.controls.target.clone(), target = v(pose.target);
    const fromVector = this.camera.position.clone().sub(fromTarget);
    const toVector = v(pose.position).sub(target);
    const fromRadius = fromVector.length(), toRadius = toVector.length();
    const fromDirection = fromVector.normalize(), toDirection = toVector.normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(fromDirection, toDirection);
    const identity = new THREE.Quaternion(), interpolated = new THREE.Quaternion();
    const state = { t: 0 };
    const update = () => {
      const t = state.t;
      interpolated.slerpQuaternions(identity, rotation, t);
      const direction = fromDirection.clone().applyQuaternion(interpolated);
      const arc = Math.sin(Math.PI * t) * Math.max(fromRadius, toRadius) * 0.10;
      this.controls.target.lerpVectors(fromTarget, target, t);
      this.camera.position.copy(this.controls.target).addScaledVector(direction, THREE.MathUtils.lerp(fromRadius, toRadius, t) + arc);
      this.controls.update();
      this.camera.updateMatrixWorld();
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(resolve => {
      this.flightResolver = resolve;
      const finish = () => {
        state.t = 1;
        update();
        this.cameraFlight = null;
        this.flightResolver = null;
        this.controls.enableDamping = true;
        this.renderer.render(this.scene, this.camera);
        onComplete?.();
        resolve({ completed: true });
      };
      if (duration <= 0 || reduced) finish();
      else this.cameraFlight = gsap.to(state, { t: 1, duration, ease: 'power2.inOut', onUpdate: update, onComplete: finish });
    });
  }

  flyToPart(id, options = {}) {
    const pose = this.getPartPose(id);
    if (!pose) return Promise.resolve({ completed: false });
    if (!this.selected && !this.savedOverview) this.savedOverview = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.selected = id;
    this.mode = 'original';
    this.setInteractive(false);
    return this.flyCameraTo(pose, options);
  }

  restoreOverview(options = {}) {
    this.setInteractive(false);
    const overview = this.savedOverview;
    this.selected = null;
    this.mode = 'original';
    if (this.registry) this.applyAppearance();
    if (!overview) {
      this.fitOverall(false);
      return Promise.resolve({ completed: true });
    }
    return this.flyCameraTo({ position: overview.position.toArray(), target: overview.target.toArray() }, options).then(result => {
      if (result.completed) this.savedOverview = null;
      return result;
    });
  }

  moveCamera(position, target, animate = true) {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      this.transition = null;
      return;
    }
    this.transition = { start: performance.now(), from: this.camera.position.clone(), targetFrom: this.controls.target.clone(), position: position.clone(), target: target.clone() };
  }

  reset() { this.selected ? this.fitPart(this.registry.get(this.selected)) : this.fitOverall(); }
  setAutoRotate(value) { this.controls.autoRotate = value; }
  zoom(factor) {
    const position = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);
    this.moveCamera(position, this.controls.target);
  }

  resize(refit = true) {
    // The artwork's GSAP scale also transforms this hidden host. Measure its
    // layout size so a window resize cannot shrink the canvas a second time.
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    if (this.options.overscan) {
      // The reference 3:2 aperture is centered inside the fitted full image.
      // Extend the model view to the viewport edges, including any paper margins.
      const aperture = frameLayout(width, height, this.options.getReferenceAspect?.());
      this.camera.setViewOffset(aperture.width, aperture.height, -aperture.homeX, -aperture.homeY, width, height);
    } else {
      this.camera.clearViewOffset();
      this.camera.aspect = this.options.fixedAspect || 1.5;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(width, height, false);
    // Camera pose stays fixed when the window or hidden picture resizes;
    // only the registered aperture and drawing buffer are recalculated.
    if (!this.active && !this.disposed) this.renderer.render(this.scene, this.camera);
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    this.events = [];
    const on = (name, handler) => { canvas.addEventListener(name, handler); this.events.push([name, handler]); };
    on('pointerdown', e => { if (this.interactive) this.down = [e.clientX, e.clientY]; });
    on('pointermove', e => {
      if (!this.interactive || !this.registry || e.buttons || performance.now() - (this.lastPick || 0) < 90) return;
      this.lastPick = performance.now();
      const part = this.pick(e);
      if (part?.id !== this.hovered) {
        this.hovered = part?.id || null;
        canvas.style.cursor = part ? 'pointer' : 'grab';
        this.applyAppearance();
        this.options.onHover?.(part?.id || null);
      }
    });
    on('pointerleave', () => { this.hovered = null; if (this.registry) this.applyAppearance(); this.options.onHover?.(null); });
    on('pointerup', e => {
      if (!this.interactive || !this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
      const part = this.pick(e);
      if (part) this.options.onSelect?.(part.id);
      this.down = null;
    });
    this.visibility = () => {
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = null; }
      else if (this.active && !this.frame) { this.lastStats = performance.now(); this.frames = 0; this.frame = requestAnimationFrame(this.animate); }
    };
    document.addEventListener('visibilitychange', this.visibility);
  }

  pick(event) {
    if (!this.registry) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes.filter(m => m.visible), false);
    for (const hit of hits) {
      const part = this.registry.meshToPart.get(hit.object.uuid);
      // The first visible surface owns selection; unmapped surfaces are intentionally inert.
      return part || null;
    }
    return null;
  }

  updateLabels(now) {
    if (this.options.labels === false || !this.interactive || !this.registry || now - (this.lastLabels || 0) < 40) return;
    this.lastLabels = now;
    const candidates = [];
    for (const part of this.registry.all()) {
      const anchor = part.center.clone();
      const ndc = anchor.clone().project(this.camera);
      if (ndc.z > 1 || ndc.z < -1 || Math.abs(ndc.x) > 0.95 || Math.abs(ndc.y) > 0.92 || (this.selected && part.id !== this.selected)) continue;
      // Surface ownership test, at a lower frequency than the render loop.
      if (now - (part.lastOcclusion || 0) > 280) {
        part.lastOcclusion = now;
        const direction = anchor.clone().sub(this.camera.position).normalize();
        this.raycaster.set(this.camera.position, direction);
        const first = this.raycaster.intersectObjects(this.meshes.filter(m => m.visible), false)[0];
        const owner = first && this.registry.meshToPart.get(first.object.uuid);
        part.occluded = first && owner?.id !== part.id && first.distance < this.camera.position.distanceTo(anchor) - 0.15;
      }
      if (part.occluded && !this.selected) continue;
      candidates.push({ id: part.id, x: (ndc.x + 1) * this.width / 2, y: (1 - ndc.y) * this.height / 2, visible: true });
    }
    // Preserve the projected anchor exactly. Secondary labels are omitted when
    // their footprint conflicts; shifting the entire button would falsify its
    // relationship to the 3D point. Check all accepted labels, not only neighbors.
    const priority = item => item.id === this.selected ? 2 : item.id === this.hovered ? 1 : 0;
    candidates.sort((a, b) => priority(b) - priority(a) || a.y - b.y || a.x - b.x);
    const accepted = [];
    for (const candidate of candidates) {
      const collides = accepted.some(other => Math.abs(candidate.x - other.x) < 132
        && Math.abs(candidate.y - other.y) < 34);
      if (!collides) accepted.push(candidate);
    }
    this.options.onLabels?.(accepted);
  }

  animate(now) {
    if (this.disposed || !this.active || document.hidden) { this.frame = null; return; }
    this.frame = requestAnimationFrame(this.animate);
    if (this.transition) {
      const t = Math.min(1, (now - this.transition.start) / 850);
      const a = ease(t);
      this.camera.position.lerpVectors(this.transition.from, this.transition.position, a);
      this.controls.target.lerpVectors(this.transition.targetFrom, this.transition.target, a);
      if (t === 1) this.transition = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(now);
    this.frames++;
    if (now - this.lastStats > 1000) {
      this.options.onStats?.({ fps: Math.round(this.frames * 1000 / (now - this.lastStats)), calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, textures: this.renderer.info.memory.textures, geometries: this.renderer.info.memory.geometries });
      this.frames = 0;
      this.lastStats = now;
    }
  }

  dispose() {
    this.cancelFlight();
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
    this.events.forEach(([name, handler]) => this.renderer.domElement.removeEventListener(name, handler));
    this.controls.dispose();
    releaseGraph(this.scene, [...(this.materialCache?.values() || []), ...(this.adaptedOriginalMaterials || [])]);
    this.scene.traverse(object => object.shadow?.dispose());
    this.envTarget.dispose();
    this.draco?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
