import * as THREE from 'three';

/**
 * Embedded adaptation of Codrops Depth Gallery's Gallery / Engine / Scroll.
 * Copyright (c) 2009 - 2025 Codrops (https://codrops.com), MIT License.
 * The complete original notice is retained in
 * source/references/codrops-depth-gallery-LICENSE.txt.
 *
 * React owns selection and input. This service owns only the local WebGL view;
 * it deliberately does not install the original demo's global scroll handlers.
 */
export function createCultureDepthGallery({ canvas, items, onReady, onError }) {
  const container = canvas.parentElement;
  const planeGap = 5;
  const cameraDistance = 6;
  const slotCount = 8;
  const textures = new Map();
  const planes = [];
  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const trailPoints = [];
  let disposed = false;
  let failed = false;
  let ready = false;
  let active = false;
  let frame = 0;
  let lastFrameTime = 0;
  let position = 0;
  let targetPosition = 0;
  let sequenceOffset = 0;
  let transition = null;
  let viewWidth = 1;
  let viewHeight = 1;
  let renderer;
  let resizeObserver;

  const modulo = (value, count) => ((value % count) + count) % count;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#eee2cd', 8, 28);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 70);
  camera.position.z = cameraDistance;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const trailGeometry = new THREE.BufferGeometry();
  const trailAttribute = new THREE.BufferAttribute(new Float32Array(32 * 3), 3);
  trailAttribute.setUsage(THREE.DynamicDrawUsage);
  trailGeometry.setAttribute('position', trailAttribute);
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: '#c9aa68',
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  trail.frustumCulled = false;
  trail.renderOrder = 100;
  scene.add(trail);

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrameTime = 0;
  }

  function fail(error) {
    if (disposed || failed) return;
    failed = true;
    dispose();
    onError?.(error);
  }

  function requestDraw() {
    if (!disposed && !failed && ready && active && !document.hidden && !frame) {
      frame = requestAnimationFrame(draw);
    }
  }

  function updatePlanes(velocity = 0) {
    // Rebase the world every step so long-running, bidirectional loops retain
    // small coordinates while the camera still travels through actual depth.
    const origin = Math.floor(position);
    const cameraStep = position - origin;
    const horizontalGap = viewWidth * 0.51;
    camera.position.set(cameraStep * horizontalGap, 0, cameraDistance - cameraStep * planeGap);

    planes.forEach((plane, slot) => {
      const sequence = origin + slot - 2;
      const index = modulo(sequence + sequenceOffset, items.length);
      const item = items[index];
      const texture = textures.get(item.src);
      const image = texture.image;
      const aspect = (image.naturalWidth || image.width || item.width) /
        (image.naturalHeight || image.height || item.height);
      const height = Math.min(viewHeight * 0.78, viewWidth * 0.79 / aspect);
      const distance = sequence - position;
      const opacity = THREE.MathUtils.smoothstep(distance, -0.9, -0.04) *
        (1 - THREE.MathUtils.smoothstep(distance, 3.5, 5.2)) /
        (1 + Math.max(0, distance) * 0.75);
      const parallax = Math.max(0.35, 1 - Math.abs(distance) * 0.12);

      if (plane.material.map !== texture) {
        plane.material.map = texture;
        plane.material.needsUpdate = true;
      }
      plane.scale.set(height * aspect, height, 1);
      plane.position.set(
        (sequence - origin) * horizontalGap - viewWidth * 0.08 + pointerCurrent.x * 0.16 * parallax,
        Math.sin(distance * 0.9) * viewHeight * 0.026 + pointerCurrent.y * 0.08 * parallax,
        -(sequence - origin) * planeGap,
      );
      plane.rotation.set(-pointerCurrent.y * velocity * 0.012, pointerCurrent.x * velocity * 0.018, 0);
      plane.material.opacity = opacity;
      plane.visible = opacity > 0.001;
    });
  }

  function updateTrail(time) {
    while (trailPoints.length && time - trailPoints[0].time > 360) trailPoints.shift();
    trail.visible = trailPoints.length > 1;
    if (!trail.visible) return false;
    const depth = 4.8;
    const factor = depth / cameraDistance;
    trail.position.copy(camera.position);
    trailPoints.forEach((point, index) => {
      trailAttribute.setXYZ(index, point.x * viewWidth * 0.5 * factor, point.y * viewHeight * 0.5 * factor, -depth);
    });
    trailAttribute.needsUpdate = true;
    trailGeometry.setDrawRange(0, trailPoints.length);
    trailMaterial.opacity = 0.32 * Math.max(0, 1 - (time - trailPoints.at(-1).time) / 360);
    return true;
  }

  function render(time, velocity = 0) {
    updatePlanes(velocity);
    const trailMoving = updateTrail(time);
    renderer.clear();
    renderer.render(scene, camera);
    return trailMoving;
  }

  function draw(time) {
    frame = 0;
    if (disposed || failed || !ready || !active || document.hidden) return;
    const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 48) : 0;
    lastFrameTime = time;
    const previous = position;
    if (transition) {
      transition.elapsed += elapsed;
      const progress = Math.min(transition.elapsed / transition.duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      position = THREE.MathUtils.lerp(transition.from, transition.to, eased);
      if (progress === 1) {
        position = transition.to;
        transition = null;
      }
    }
    pointerCurrent.lerp(pointerTarget, 1 - Math.exp(-Math.max(elapsed, 1) * 0.006));
    const pointerMoving = pointerCurrent.distanceToSquared(pointerTarget) > 0.000001;
    if (!pointerMoving) pointerCurrent.copy(pointerTarget);
    const velocity = elapsed ? THREE.MathUtils.clamp((position - previous) * 1000 / elapsed, -3, 3) : 0;
    const trailMoving = render(time, velocity);
    if (transition || pointerMoving || trailMoving) requestDraw();
    else lastFrameTime = 0;
  }

  function resize() {
    if (disposed || failed || !renderer) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    camera.aspect = bounds.width / bounds.height;
    camera.updateProjectionMatrix();
    viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * cameraDistance;
    viewWidth = viewHeight * camera.aspect;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(Math.round(bounds.width), Math.round(bounds.height), false);
    if (ready) {
      // Static draws also keep an inactive view correct after container resize.
      render(performance.now());
      requestDraw();
    }
  }

  function onPointerMove(event) {
    if (!active || document.hidden || disposed || failed) return;
    const bounds = container.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerTarget.set(
      THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(1 - (event.clientY - bounds.top) / bounds.height * 2, -1, 1),
    );
    const time = performance.now();
    trailPoints.push({ x: pointerTarget.x, y: pointerTarget.y, time });
    if (trailPoints.length > 32) trailPoints.shift();
    requestDraw();
  }

  function onPointerLeave() {
    pointerTarget.set(0, 0);
    requestDraw();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
      trailPoints.length = 0;
      pointerTarget.set(0, 0);
    } else requestDraw();
  }

  function onContextLost(event) {
    event.preventDefault();
    fail(new Error('首页纵深照片画廊的 WebGL 上下文已丢失。'));
  }

  function select(index, continuousPosition) {
    if (disposed || failed || !items.length || !Number.isFinite(index)) return;
    const safeIndex = modulo(Math.round(index), items.length);
    const nextPosition = Number.isFinite(continuousPosition)
      ? Math.round(continuousPosition)
      : targetPosition + modulo(safeIndex - modulo(targetPosition, items.length), items.length);
    sequenceOffset = modulo(safeIndex - nextPosition, items.length);
    if (!ready) {
      position = targetPosition = nextPosition;
      return;
    }
    if (nextPosition === targetPosition) return;
    targetPosition = nextPosition;
    if (!active || document.hidden) {
      position = nextPosition;
      transition = null;
      render(performance.now());
      return;
    }
    transition = {
      from: position,
      to: nextPosition,
      elapsed: 0,
      duration: Math.min(900, 720 + Math.abs(nextPosition - position) * 60),
    };
    requestDraw();
  }

  function setActive(value) {
    active = Boolean(value);
    if (active) requestDraw();
    else {
      stop();
      trailPoints.length = 0;
      pointerTarget.set(0, 0);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver?.disconnect();
    container?.removeEventListener('pointermove', onPointerMove);
    container?.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    window.removeEventListener('resize', resize);
    planes.forEach((plane) => plane.material.dispose());
    geometry.dispose();
    trailGeometry.dispose();
    trailMaterial.dispose();
    textures.forEach((texture) => texture.dispose());
    textures.clear();
    scene.clear();
    if (renderer) {
      if (!renderer.getContext().isContextLost()) renderer.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }

  const service = { select, setActive, resize, dispose };
  try {
    if (!container || !items.length) throw new Error('首页纵深照片画廊缺少容器或照片。');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    canvas.addEventListener('webglcontextlost', onContextLost);
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    } else window.addEventListener('resize', resize, { passive: true });
    resize();
  } catch (error) {
    queueMicrotask(() => fail(error));
    return service;
  }

  const loader = new THREE.TextureLoader();
  Promise.all([...new Set(items.map((item) => item.src))].map(async (src) => {
    const texture = await loader.loadAsync(src);
    // TextureLoader cannot cancel in-flight images; dispose late completions
    // as well as textures already owned by an unmounted React component.
    if (disposed || failed) {
      texture.dispose();
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.set(src, texture);
  })).then(() => {
    if (disposed || failed) return;
    for (let slot = 0; slot < slotCount; slot += 1) {
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
      });
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);
      planes.push(plane);
    }
    ready = true;
    resize();
    // Draw before revealing the canvas, including when the view is inactive.
    render(performance.now());
    onReady?.();
    requestDraw();
  }).catch(fail);

  return service;
}
