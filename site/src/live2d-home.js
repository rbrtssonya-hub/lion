const manifestUrl = new URL('../assets/live2d/nanfeng-lion/model-manifest.json', import.meta.url).href;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function setStageState(stage, ready, status) {
  stage.dataset.live2dReady = String(ready);
  stage.dataset.live2dStatus = status;
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Live2D runtime failed to load: ${url}`));
    document.head.appendChild(script);
  });
}

async function loadRuntime(manifest) {
  if (window.NanfengLive2DRuntime) return window.NanfengLive2DRuntime;

  const runtime = manifest.runtime ?? {};
  const candidates = [
    { adapter: runtime.localRuntime, dependencies: runtime.localDependencies },
    { adapter: runtime.cdnRuntime, dependencies: runtime.cdnDependencies },
  ].filter((candidate) => candidate.adapter);
  let lastError;
  for (const candidate of candidates) {
    try {
      for (const dependency of candidate.dependencies ?? []) {
        await loadScript(new URL(dependency, manifestUrl).href);
      }
      await loadScript(new URL(candidate.adapter, manifestUrl).href);
      if (window.NanfengLive2DRuntime) return window.NanfengLive2DRuntime;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Live2D runtime is unavailable');
}

function setupTitleParallax(title) {
  if (!title) return;
  const root = title.closest('.final-home');
  if (!root || prefersReducedMotion()) return;

  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;

  const render = (time) => {
    const driftX = Math.sin(time / 2600) * 1.1;
    const driftY = Math.cos(time / 3100) * 0.8;
    title.style.setProperty('--title-shift-x', `${(pointerX * 4 + driftX).toFixed(2)}px`);
    title.style.setProperty('--title-shift-y', `${(pointerY * 3 + driftY).toFixed(2)}px`);
    frame = window.requestAnimationFrame(render);
  };

  root.addEventListener('pointermove', (event) => {
    const bounds = root.getBoundingClientRect();
    pointerX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    pointerY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
  });
  root.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
  });
  frame = window.requestAnimationFrame(render);

  return () => window.cancelAnimationFrame(frame);
}

async function initLive2DHomepage({ stage, title }) {
  if (!stage) return;
  const stopTitleParallax = setupTitleParallax(title);
  setStageState(stage, false, 'loading-manifest');

  try {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Live2D manifest request failed: ${response.status}`);
    const manifest = await response.json();

    if (manifest.status !== 'ready') {
      setStageState(stage, false, manifest.status ?? 'pending-cubism-export');
      return;
    }

    const runtime = await loadRuntime(manifest);
    if (typeof runtime.createModel !== 'function') {
      throw new Error('Live2D runtime does not expose createModel');
    }

    const modelUrl = new URL(manifest.model, manifestUrl).href;
    await runtime.createModel({
      canvas: stage.querySelector('#live2dCanvas'),
      modelUrl,
      motions: manifest.motions,
      parameters: manifest.parameters,
    });
    setStageState(stage, true, 'ready');
  } catch (error) {
    setStageState(stage, false, 'fallback-cover');
    console.error('Live2D homepage unavailable; keeping the cover artwork.', error);
  }

  return stopTitleParallax;
}

export { initLive2DHomepage };
