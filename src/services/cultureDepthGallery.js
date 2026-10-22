import * as THREE from 'three';
import { cultureGalleryPointerBounds, cultureGalleryRightSide } from '../features/home/cultureGalleryHitArea.js';

/**
 * Embedded adaptation of Codrops Depth Gallery's Gallery / Engine / Scroll.
 * Copyright (c) 2009 - 2025 Codrops (https://codrops.com), MIT License.
 * The complete original notice is retained in
 * source/references/codrops-depth-gallery-LICENSE.txt.
 *
 * React owns selection and input. This service owns only the local WebGL view;
 * it deliberately does not install the original demo's global scroll handlers.
 */
export function createCultureDepthGallery({ canvas, items, onReady, onError, onFocusChange, onNext, settings }) {
  const container = canvas.parentElement;
  const planeGap = 5;
  const cameraDistance = 6;
  const slotCount = 8;
  const textures = new Map();
  const planes = [];
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const originalCursor = canvas.style.cursor;
  const config = { transitionDuration: 800, focusScale: 1.04 };
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
  let focused = false;
  let focusScale = 1;
  let lastPointer = null;
  let renderer;
  let resizeObserver;

  const modulo = (value, count) => ((value % count) + count) % count;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#eee2cd', 8, 28);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 70);
  camera.position.z = cameraDistance;
  const geometry = new THREE.PlaneGeometry(1, 1);

  function transitionDuration(distance) {
    return Math.min(config.transitionDuration * 1.5,
      config.transitionDuration + Math.max(0, Math.abs(distance) - 1) * 120);
  }

  function setSettings(nextSettings) {
    if (disposed || failed) return;
    const duration = nextSettings?.transitionDuration;
    const scale = nextSettings?.focusScale;
    if (Number.isFinite(duration)) config.transitionDuration = THREE.MathUtils.clamp(duration, 300, 1600);
    if (Number.isFinite(scale)) config.focusScale = THREE.MathUtils.clamp(scale, 1.01, 1.10);
    if (transition) {
      const progress = transition.elapsed / transition.duration;
      transition.duration = transitionDuration(transition.to - transition.from);
      transition.elapsed = progress * transition.duration;
    }
    requestDraw();
  }

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

  function updatePlanes() {
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
      const zoom = 1 + (focusScale - 1) * Math.max(0, 1 - Math.abs(distance));

      if (plane.material.map !== texture) {
        plane.material.map = texture;
        plane.material.needsUpdate = true;
      }
      plane.scale.set(height * aspect * zoom, height * zoom, 1);
      plane.position.set(
        (sequence - origin) * horizontalGap - viewWidth * 0.08,
        Math.sin(distance * 0.9) * viewHeight * 0.026,
        -(sequence - origin) * planeGap,
      );
      plane.rotation.set(0, 0, 0);
      plane.material.opacity = opacity;
      plane.visible = opacity > 0.001;
      plane.userData.sequence = sequence;
    });
  }

  function render() {
    updatePlanes();
    renderer.clear();
    renderer.render(scene, camera);
  }

  function draw(time) {
    frame = 0;
    if (disposed || failed || !ready || !active || document.hidden) return;
    const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 48) : 0;
    lastFrameTime = time;
    let settled = false;
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
        settled = true;
      }
    }
    const targetScale = focused ? config.focusScale : 1;
    focusScale = THREE.MathUtils.lerp(focusScale, targetScale, 1 - Math.exp(-Math.max(elapsed, 1) * 0.018));
    const focusMoving = Math.abs(focusScale - targetScale) > 0.00001;
    if (!focusMoving) focusScale = targetScale;
    render();
    // Travel can move a photograph away from an existing hover. A photograph
    // arriving under a parked pointer must not acquire hover and stop autoplay.
    if (settled) releaseInvalidFocus();
    if (transition || focusMoving) requestDraw();
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
      render();
      releaseInvalidFocus();
      requestDraw();
    }
  }

  function setFocused(value) {
    if (disposed || failed || focused === value) return;
    focused = value;
    canvas.style.cursor = focused ? 'pointer' : originalCursor;
    onFocusChange?.(focused);
    requestDraw();
  }

  function hitsPhoto(event, frontOnly = false) {
    if (!ready || !active || document.hidden || disposed || failed) return false;
    // Pointer coordinates can outlive scrolling, resizing, or a covering panel.
    // The visible canvas must still be the actual target at that screen point.
    const bounds = cultureGalleryPointerBounds(container, canvas, event);
    if (!bounds) return false;
    const candidates = planes.filter(plane => plane.visible &&
      (!frontOnly || plane.userData.sequence === Math.round(position)));
    if (!candidates.length) return false;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2);
    camera.updateMatrixWorld();
    candidates.forEach(plane => plane.updateWorldMatrix(true, false));
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(candidates, false).length > 0;
  }

  function hitsFront(event) { return hitsPhoto(event, true); }

  function hitsAdvanceArea(event) {
    if (!ready || !active || document.hidden || disposed || failed) return false;
    const bounds = cultureGalleryPointerBounds(container, canvas, event);
    return cultureGalleryRightSide(container, event, bounds) || hitsPhoto(event);
  }

  function updateCursor(event) {
    canvas.style.cursor = event && hitsAdvanceArea(event) ? 'pointer' : originalCursor;
  }

  function onPointerMove(event) {
    if (!active || document.hidden || disposed || failed) return;
    // Re-evaluate on actual input only: a click's camera animation must not
    // repeatedly blur / refocus a stationary pointer as images pass beneath it.
    lastPointer = { clientX: event.clientX, clientY: event.clientY };
    setFocused(hitsFront(event));
    updateCursor(event);
  }

  function onPointerLeave() {
    lastPointer = null;
    setFocused(false);
    canvas.style.cursor = originalCursor;
  }

  function releaseInvalidFocus() {
    if (focused && (!lastPointer || !hitsFront(lastPointer))) setFocused(false);
    updateCursor(lastPointer);
  }

  function onPointerOut(event) {
    if (!event.relatedTarget) onPointerLeave();
  }

  function onClick(event) {
    if (event.button !== 0 || !hitsAdvanceArea(event)) return;
    lastPointer = { clientX: event.clientX, clientY: event.clientY };
    // Rear images and their gaps advance without taking the front-photo hover
    // pause. Only an actual front-photo hit may focus and slightly enlarge it.
    setFocused(hitsFront(event));
    updateCursor(event);
    onNext?.();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
      onPointerLeave();
      focusScale = 1;
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
      focusScale = 1;
      render();
      return;
    }
    transition = {
      from: position,
      to: nextPosition,
      elapsed: 0,
      duration: transitionDuration(nextPosition - position),
    };
    requestDraw();
  }

  function setActive(value) {
    active = Boolean(value);
    if (active) requestDraw();
    else {
      stop();
      const wasFocused = focused;
      onPointerLeave();
      focusScale = 1;
      if (wasFocused && ready && !disposed && !failed && !document.hidden) render();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resizeObserver?.disconnect();
    container?.removeEventListener('pointermove', onPointerMove);
    container?.removeEventListener('pointerenter', onPointerMove);
    container?.removeEventListener('pointerleave', onPointerLeave);
    container?.removeEventListener('click', onClick);
    window.removeEventListener('scroll', releaseInvalidFocus, true);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('pointercancel', onPointerLeave, true);
    window.removeEventListener('pointerout', onPointerOut);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    window.removeEventListener('resize', resize);
    planes.forEach((plane) => plane.material.dispose());
    geometry.dispose();
    // Unmount cleanup is intentionally silent; React owns the retiring view.
    focused = false;
    lastPointer = null;
    canvas.style.cursor = originalCursor;
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

  const service = { select, setActive, setSettings, syncPointer: onPointerMove, resize, dispose };
  setSettings(settings);
  try {
    if (!container || !items.length) throw new Error('首页纵深照片画廊缺少容器或照片。');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    canvas.addEventListener('webglcontextlost', onContextLost);
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerenter', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    container.addEventListener('click', onClick);
    window.addEventListener('scroll', releaseInvalidFocus, { capture: true, passive: true });
    window.addEventListener('blur', onPointerLeave);
    window.addEventListener('pointercancel', onPointerLeave, { capture: true, passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    // Viewport height can change without resizing this fixed-height container.
    window.addEventListener('resize', resize, { passive: true });
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
    render();
    onReady?.();
    requestDraw();
  }).catch(fail);

  return service;
}
