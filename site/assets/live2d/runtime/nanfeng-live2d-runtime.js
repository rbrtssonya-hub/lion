(function () {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function assertDependencies() {
    if (!window.PIXI) throw new Error('PixiJS is unavailable');
    if (!window.PIXI.live2d?.Live2DModel) throw new Error('pixi-live2d-display Cubism adapter is unavailable');
    if (!window.Live2DCubismCore) throw new Error('Live2D Cubism Core is unavailable');
  }

  function playMotion(model, name, priority) {
    if (typeof model.motion === 'function') return model.motion(name, 0, priority);
    const manager = model.internalModel?.motionManager;
    if (manager && typeof manager.startMotion === 'function') return manager.startMotion(name, 0, priority);
    throw new Error(`Live2D motion is unavailable: ${name}`);
  }

  function setParameter(model, id, value) {
    const coreModel = model.internalModel?.coreModel;
    if (coreModel && typeof coreModel.setParameterValueById === 'function') {
      coreModel.setParameterValueById(id, value);
    }
  }

  function createModel({ canvas, modelUrl, motions = [] }) {
    assertDependencies();
    if (!canvas) throw new Error('Live2D canvas is missing');
    if (!modelUrl) throw new Error('Live2D model URL is missing');

    const host = canvas.parentElement;
    const app = new window.PIXI.Application({
      view: canvas,
      resizeTo: host,
      transparent: true,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    return window.PIXI.live2d.Live2DModel.from(modelUrl, { autoInteract: false }).then(async (model) => {
      model.anchor?.set?.(0.5, 1);
      app.stage.addChild(model);
      host._nanfengLive2DModel = model;
      host._nanfengLive2DApp = app;
      host._nanfengLive2DPlayMotion = (name, priority = 3) => playMotion(model, name, priority);

      // Cubism Core 1.6 stores renderOrders on the model while this adapter
      // reads drawables.renderOrders. Bridge the two layouts before the first
      // draw so the adapter can sort drawables instead of failing silently.
      const coreModel = model.internalModel?.coreModel;
      const rawCoreModel = coreModel?._model;
      if (rawCoreModel?.drawables && !rawCoreModel.drawables.renderOrders && rawCoreModel.renderOrders) {
        rawCoreModel.drawables.renderOrders = rawCoreModel.renderOrders;
      }

      // Keep Cubism updates and Pixi draws on one frame loop.
      model.autoUpdate = false;
      app.ticker.stop();
      let elapsedMs = 0;
      let previousTime = performance.now();
      let animationFrame = 0;
      const updateModel = (time) => {
        const deltaMs = clamp(time - previousTime, 0, 100);
        previousTime = time;
        elapsedMs += deltaMs;
        model.elapsedTime = elapsedMs;
        model.internalModel.update(deltaMs, elapsedMs);
        app.renderer.render(app.stage);
        animationFrame = window.requestAnimationFrame(updateModel);
      };
      animationFrame = window.requestAnimationFrame(updateModel);

      const fit = () => {
        const width = app.renderer.width;
        const height = app.renderer.height;
        const baseWidth = model.width / Math.max(model.scale.x, Number.EPSILON);
        const baseHeight = model.height / Math.max(model.scale.y, Number.EPSILON);
        const scale = Math.max(width / baseWidth, height / baseHeight);
        model.scale.set(scale);
        model.x = width * 0.5;
        model.y = height;
      };
      fit();
      const resizeObserver = new ResizeObserver(fit);
      if (host) resizeObserver.observe(host);

      const onPointerMove = (event) => {
        const rect = host.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 0, rect.width);
        const y = clamp(event.clientY - rect.top, 0, rect.height);
        if (typeof model.focus === 'function') model.focus(x, y);
        setParameter(model, 'ParamEyeBallX', (x / rect.width) * 2 - 1);
        setParameter(model, 'ParamEyeBallY', (y / rect.height) * 2 - 1);
      };
      host?.addEventListener('pointermove', onPointerMove);

      let blinkTimer;
      const scheduleBlink = () => {
        blinkTimer = window.setTimeout(() => {
          if (motions.includes('Blink')) playMotion(model, 'Blink', 2);
          scheduleBlink();
        }, 2800 + Math.random() * 2200);
      };
      if (motions.includes('Idle')) await playMotion(model, 'Idle', 1);
      scheduleBlink();

      return {
        model,
        app,
        playMotion: (name, priority = 3) => playMotion(model, name, priority),
        destroy() {
          window.clearTimeout(blinkTimer);
          window.cancelAnimationFrame(animationFrame);
          delete host._nanfengLive2DModel;
          delete host._nanfengLive2DApp;
          delete host._nanfengLive2DPlayMotion;
          host?.removeEventListener('pointermove', onPointerMove);
          resizeObserver.disconnect();
          app.destroy(true, { children: true, texture: false, baseTexture: false });
        },
      };
    }).catch((error) => {
      app.destroy(true, { children: true, texture: false, baseTexture: false });
      throw error;
    });
  }

  window.NanfengLive2DRuntime = { createModel };
}());
