import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });

const states = [
  { id: 'joy', name: '喜' }, { id: 'anger', name: '怒' },
  { id: 'sorrow', name: '哀' }, { id: 'delight', name: '乐' },
  { id: 'motion', name: '动' }, { id: 'stillness', name: '静' },
  { id: 'surprise', name: '惊' }, { id: 'doubt', name: '疑' },
];
const parts = ['brow-left', 'brow-right', 'eye-left', 'eye-right', 'jaw'];
const rig = (page, id) => page.locator(`.expression-lion-layer.is-current .expression-face-rig${id ? `[data-expression-id="${id}"]` : ''}`);
const animationCount = page => page.evaluate(() => window.eightFaceAnimations.length);

async function prepare(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, bookAutoplay: false }));
    window.eightFaceAnimations = [];
    // Observe the browser's native animations without replacing their effects,
    // timing, cancellation, finished promises, or computed SVG transforms.
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(nativeAnimate, this, args);
      if (this.matches('[data-face-part]')) window.eightFaceAnimations.push(animation);
      return animation;
    };
  });
  await page.goto('/#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await expect(page.locator('#expressionLion')).toBeVisible();
}

async function select(page, state, { ready = true } = {}) {
  await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name: state.name, exact: true }).click();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', state.name);
  await page.locator('.expression-lion-layer.is-current').evaluate(element =>
    Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
  await page.mouse.move(0, 0);
  if (ready) await expect(rig(page, state.id)).toHaveAttribute('data-ready', 'true');
}

async function originalImage(page, state) {
  return page.locator('#expressionLion').evaluate(async (image, state) => {
    await image.decode();
    const style = getComputedStyle(image);
    return { tag: image.tagName, source: new URL(image.currentSrc).pathname,
      alt: image.alt, width: image.naturalWidth, height: image.naturalHeight,
      opacity: style.opacity, transform: style.transform,
      expectedSource: `/assets/expression/lion-${state.id}-v2.png` };
  }, state);
}

async function assertOriginal(page, state) {
  // Pointer movement and reduced-motion changes can start the existing 220 ms
  // image hover transition. Compare the restored geometry after it settles.
  await page.mouse.move(0, 0);
  await expect.poll(() => page.locator('#expressionLion').evaluate(image => getComputedStyle(image).transform)).toBe('none');
  const image = await originalImage(page, state);
  expect(image.tag).toBe('IMG');
  expect(image.source).toBe(image.expectedSource);
  expect(image.alt).toBe(`${state.name}态醒狮，按用户八态参考图AI辅助提取`);
  expect([image.width, image.height]).toEqual([1254, 1254]);
  expect(image.opacity).toBe('1');
  expect(image.transform).toBe('none');
}

async function start(page, id, target = '#expressionLionTrigger') {
  const before = await animationCount(page);
  await page.locator(target).click();
  await expect.poll(() => animationCount(page)).toBe(before + 5);
  await expect(rig(page, id)).toHaveAttribute('data-playing', 'true');
  return before;
}

async function sample(page, time) {
  return page.evaluate(async time => {
    for (const animation of window.eightFaceAnimations.slice(-5)) {
      animation.pause();
      await animation.ready;
      animation.currentTime = time;
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
    const current = document.querySelector('.expression-lion-layer.is-current .expression-face-rig');
    return Object.fromEntries([...current.querySelectorAll('[data-face-part]')].map(element => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return [element.dataset.facePart, [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]];
    }));
  }, time);
}

async function finish(page, id) {
  await page.evaluate(async () => {
    const animations = window.eightFaceAnimations.slice(-5);
    const finished = animations.map(animation => animation.finished.catch(() => {}));
    animations.forEach(animation => animation.finish());
    await Promise.all(finished);
  });
  await expect(rig(page, id)).toHaveAttribute('data-playing', 'false');
  await page.mouse.move(0, 0);
  await expect.poll(() => page.locator('#expressionLionTrigger').evaluate(element => getComputedStyle(element).transform)).toBe('none');
}

const distance = (left, right) => Math.max(...left.map((value, index) => Math.abs(value - right[index])));
const signature = matrices => JSON.stringify(parts.map(part => matrices[part].map(value => Math.round(value * 1000) / 1000)));

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
  test(`八态眉眼狮口真实独立运动、各态轨迹不同并原位复原 ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    const samples = {};
    for (const state of states) {
      await test.step(`${state.name}：保留原图，五部位各播三秒`, async () => {
        await select(page, state);
        await assertOriginal(page, state);
        const before = await page.locator('#expressionLion').boundingBox();
        const triggerBefore = await page.locator('#expressionLionTrigger').boundingBox();
        await expect(rig(page, state.id).locator('[data-face-part]')).toHaveCount(5);
        await start(page, state.id);
        await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
        expect(await page.evaluate(() => window.eightFaceAnimations.slice(-5).map(animation => {
          const timing = animation.effect.getTiming();
          return { part: animation.effect.target.dataset.facePart,
            total: Number(timing.delay) + Number(timing.duration), iterations: timing.iterations };
        }))).toEqual(expect.arrayContaining(parts.map(part => ({ part, total: 3000, iterations: 1 }))));
        const matrices = await sample(page, 900);
        expect(Object.keys(matrices).sort()).toEqual([...parts].sort());
        for (const part of parts) {
          expect(distance(matrices[part], [1, 0, 0, 1, 0, 0]), `${state.name}/${part} must visibly transform`).toBeGreaterThan(.01);
        }
        // Mirrored eyes and brows are permitted, but eyes, brows, and mouth
        // cannot all be copies of the same whole-image transform.
        for (const eye of ['eye-left', 'eye-right']) {
          expect(distance(matrices[eye], matrices.jaw), `${state.name}/${eye} versus mouth`).toBeGreaterThan(.01);
          expect(distance(matrices[eye], matrices[eye.replace('eye', 'brow')]), `${state.name}/${eye} versus brow`).toBeGreaterThan(.01);
        }
        expect(distance(matrices['brow-left'], matrices.jaw), `${state.name}/brow versus mouth`).toBeGreaterThan(.01);
        samples[state.id] = matrices;
        expect(await page.locator('#expressionLion').evaluate(image => getComputedStyle(image).opacity)).toBe('0');
        await finish(page, state.id);
        await assertOriginal(page, state);
        const after = await page.locator('#expressionLion').boundingBox();
        const triggerAfter = await page.locator('#expressionLionTrigger').boundingBox();
        for (const property of ['x', 'y', 'width', 'height']) {
          expect(after[property], `${state.name}/image ${property}`).toBeCloseTo(before[property], 0);
          expect(triggerAfter[property], `${state.name}/trigger ${property}`).toBeCloseTo(triggerBefore[property], 0);
        }
        expect(await page.evaluate(() => window.eightFaceAnimations.slice(-5).every(animation => animation.playState === 'idle'))).toBe(true);
      });
    }
    expect(new Set(Object.values(samples).map(signature)).size, 'eight expression-specific computed motion signatures').toBe(8);
    await testInfo.attach(`all-eight-computed-transforms-${viewport.width}`, { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  });
}

for (const [index, state] of states.entries()) {
  test(`${state.name}态快速重播、减少动态、对照、切态和离章取消真实五官动画`, async ({ page }) => {
    await prepare(page);
    await select(page, state);
    await start(page, state.id);
    await start(page, state.id);
    expect(await page.evaluate(() => window.eightFaceAnimations.slice(0, 5).every(animation => animation.playState === 'idle'))).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(rig(page, state.id)).toHaveAttribute('data-playing', 'false');
    await assertOriginal(page, state);
    const reducedCount = await animationCount(page);
    await page.locator('#expressionLionTrigger').click();
    expect(await animationCount(page)).toBe(reducedCount);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await start(page, state.id);
    await page.getByRole('button', { name: '神态对照', exact: true }).click();
    await expect(rig(page, state.id)).toHaveAttribute('data-playing', 'false');
    expect(await page.evaluate(() => window.eightFaceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
    await page.getByRole('button', { name: '八态浏览', exact: true }).click();
    await start(page, state.id);
    await select(page, states[(index + 1) % states.length]);
    expect(await page.evaluate(() => window.eightFaceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
    await expect(rig(page, state.id)).toHaveCount(0);
    await select(page, state);
    await start(page, state.id);
    await page.locator('.site-nav-item[data-route="entry"]').click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
    await expect(rig(page, state.id)).toHaveCount(0);
    expect(await page.evaluate(() => window.eightFaceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
    await page.evaluate(() => { location.hash = '/state'; });
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
    await expect(rig(page, state.id)).toHaveAttribute('data-playing', 'false');
    await assertOriginal(page, state);
  });

  test(`${state.name}态补绘加载失败仍显示可解码原图并保留详细解读`, async ({ page }) => {
    let failures = 0;
    await page.route(`**/lion-${state.id}-underpaint-v1.png`, route => { failures += 1; return route.abort(); });
    await prepare(page);
    await select(page, state, { ready: false });
    await expect.poll(() => failures).toBeGreaterThan(0);
    await expect(rig(page, state.id)).toHaveAttribute('data-ready', 'false');
    await page.locator('#expressionLionTrigger').click();
    await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
    await expect(page.locator('#expressionDetailTitle')).toHaveText(`${state.name}态怎么看`);
    await assertOriginal(page, state);
    expect(await animationCount(page)).toBe(0);
    await expect(rig(page, state.id)).toHaveAttribute('data-playing', 'false');
  });
}

test('喜态原生自然播放三秒，停留和再次回应均发生后自动恢复原图', async ({ page }, testInfo) => {
  const state = states[0];
  await prepare(page);
  await select(page, state);
  await start(page, state.id);
  const playback = await page.evaluate(async () => {
    const animations = window.eightFaceAnimations.slice(-5);
    await Promise.all(animations.map(animation => animation.ready));
    // Capture these promises before the component cancels completed effects.
    const finished = animations.map(animation => animation.finished.catch(() => {}));
    const started = Math.min(...animations.map(animation => animation.startTime));
    const face = document.querySelector('.expression-face-rig');
    const frames = [];
    await new Promise(resolve => {
      const tick = () => {
        frames.push({ time: document.timeline.currentTime - started, playing: face.dataset.playing,
          parts: animations.map(animation => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(animation.effect.target).transform);
            return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
          }) });
        if (face.dataset.playing === 'false' || document.timeline.currentTime - started > 3800) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await Promise.all(finished);
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { frames, elapsed: document.timeline.currentTime - started, playing: face.dataset.playing };
  });
  await writeFile(testInfo.outputPath('joy-natural-playback.json'), JSON.stringify(playback, null, 2));
  await testInfo.attach('joy-natural-three-second-playback', { body: JSON.stringify(playback, null, 2), contentType: 'application/json' });
  const moved = frame => frame.parts.every(matrix => distance(matrix, [1, 0, 0, 1, 0, 0]) > .01);
  expect(playback.frames.some(frame => frame.time >= 650 && frame.time <= 1200 && frame.playing === 'true' && moved(frame))).toBe(true);
  expect(playback.frames.some(frame => frame.time >= 2100 && frame.time <= 2450 && frame.playing === 'true' && moved(frame))).toBe(true);
  expect(playback.frames.some(frame => frame.time >= 2500 && frame.time < 3000 && frame.playing === 'true')).toBe(true);
  expect(playback.elapsed).toBeGreaterThanOrEqual(2950);
  expect(playback.elapsed).toBeLessThan(3800);
  expect(playback.playing).toBe('false');
  await page.mouse.move(0, 0);
  await assertOriginal(page, state);
});

test('八态提示按钮及主狮头 Enter、Space 均触发各自五官和原详细解读', async ({ page }) => {
  await prepare(page);
  for (const state of states) {
    await select(page, state);
    await start(page, state.id, '#expressionInteractionHint');
    await expect(page.locator('#expressionDetailTitle')).toHaveText(`${state.name}态怎么看`);
    await finish(page, state.id);
    for (const key of ['Enter', 'Space']) {
      await page.locator('#expressionLionTrigger').focus();
      const before = await animationCount(page);
      await page.keyboard.press(key);
      await expect.poll(() => animationCount(page)).toBe(before + 5);
      await expect(rig(page, state.id)).toHaveAttribute('data-playing', 'true');
      await expect(page.locator('#expressionDetailTitle')).toHaveText(`${state.name}态怎么看`);
      await finish(page, state.id);
      await assertOriginal(page, state);
    }
  }
});
