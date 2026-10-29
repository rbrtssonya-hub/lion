import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ trace: 'off' });

async function openSurprise(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    const animate = Element.prototype.animate;
    window.faceAnimations = [];
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(animate, this, args);
      if (this.matches('[data-face-part]')) window.faceAnimations.push(animation);
      return animation;
    };
  });
  await page.goto('/#/state');
  await expect(page.locator('#expressionLion')).toBeVisible();
  await page.locator('.expression-state-button').filter({ hasText: '惊' }).click();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', '惊');
  await page.locator('.expression-lion-layer.is-current').evaluate(element =>
    Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
  await page.mouse.move(0, 0);
}

const rig = page => page.locator('.surprise-lion-rig');
async function sample(page, time) {
  return page.evaluate(async time => {
    for (const animation of window.faceAnimations.slice(-5)) {
      animation.pause();
      await animation.ready;
      animation.currentTime = time;
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
    return Object.fromEntries([...document.querySelectorAll('[data-face-part]')].map(element => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return [element.dataset.facePart, { x: matrix.e, y: matrix.f, sx: matrix.a, sy: matrix.d }];
    }));
  }, time);
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
  test(`惊态眉眼狮口按序独立运动并复位，保留主视觉尺寸 ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSurprise(page);
    await expect(rig(page)).toHaveAttribute('data-ready', 'true');
    const before = await page.locator('#expressionLion').boundingBox();
    await page.locator('#expressionLionTrigger').click();
    await expect.poll(() => page.evaluate(() => window.faceAnimations.length)).toBe(5);
    expect(await page.evaluate(() => window.faceAnimations.slice(-5).map(animation => {
      const { delay, duration } = animation.effect.getTiming();
      return delay + duration;
    }))).toEqual([3000, 3000, 3000, 3000, 3000]);
    const early = await sample(page, 45);
    expect(early['brow-left'].y).toBeLessThan(-.1);
    expect(early['eye-left'].sy).toBeCloseTo(1, 4);
    expect(early.jaw.y).toBeCloseTo(0, 4);
    const eyes = await sample(page, 150);
    expect(eyes['eye-left'].sy).toBeGreaterThan(1.001);
    expect(eyes['eye-right'].sy).toBeGreaterThan(1.001);
    expect(eyes.jaw.y).toBeCloseTo(0, 4);
    const peak = await sample(page, 320);
    expect(peak['brow-left'].y).toBeLessThan(-8);
    expect(peak['brow-right'].y).toBeLessThan(-8);
    expect(peak.jaw.y).toBeGreaterThan(3);
    await page.evaluate(() => window.faceAnimations.slice(-5).forEach(animation => animation.finish()));
    await expect(rig(page)).toHaveAttribute('data-playing', 'false');
    await page.mouse.move(0, 0);
    await expect.poll(() => page.locator('#expressionLionTrigger').evaluate(element => getComputedStyle(element).transform)).toBe('none');
    await expect.poll(() => page.locator('#expressionLion').evaluate(element => getComputedStyle(element).transform)).toBe('none');
    const after = await page.locator('#expressionLion').boundingBox();
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(await page.locator('#expressionLion').evaluate(image => image.tagName === 'IMG' && image.naturalWidth === 1254 && getComputedStyle(image).opacity === '1')).toBe(true);
  });
}

test('惊态真实播放约三秒，先停留再轻回收回应后自然复位', async ({ page }, testInfo) => {
  await openSurprise(page);
  await expect(rig(page)).toHaveAttribute('data-ready', 'true');
  await page.locator('#expressionLionTrigger').click();
  const playback = await page.evaluate(async () => {
    const animations = window.faceAnimations.slice(-5);
    await Promise.all(animations.map(animation => animation.ready));
    const finished = animations.map(animation => animation.finished.catch(() => {}));
    const brow = animations.find(animation => animation.effect.target.dataset.facePart === 'brow-left');
    const started = brow.startTime;
    const frames = [];
    await new Promise(resolve => {
      const tick = () => {
        const playing = document.querySelector('.surprise-lion-rig').dataset.playing;
        frames.push({ time: document.timeline.currentTime - started, playing,
          y: new DOMMatrixReadOnly(getComputedStyle(brow.effect.target).transform).f });
        if (playing === 'false' || document.timeline.currentTime - started > 3800) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await Promise.all(finished);
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { frames, elapsed: document.timeline.currentTime - started, playing: document.querySelector('.surprise-lion-rig').dataset.playing };
  });
  await writeFile(testInfo.outputPath('natural-playback.json'), JSON.stringify(playback, null, 2));
  await testInfo.attach('natural-three-second-playback', { body: JSON.stringify(playback, null, 2), contentType: 'application/json' });
  expect(playback.frames.some(frame => frame.time >= 650 && frame.time <= 1200 && frame.y < -20 && frame.playing === 'true')).toBe(true);
  expect(playback.frames.some(frame => frame.time >= 1500 && frame.time <= 1850 && frame.y > -17 && frame.y < -9 && frame.playing === 'true')).toBe(true);
  expect(playback.frames.some(frame => frame.time >= 2100 && frame.time <= 2420 && frame.y < -20 && frame.playing === 'true')).toBe(true);
  expect(playback.frames.some(frame => frame.time >= 2500 && frame.time < 3000 && frame.playing === 'true')).toBe(true);
  expect(playback.elapsed).toBeGreaterThanOrEqual(2950);
  expect(playback.elapsed).toBeLessThan(3800);
  expect(playback.playing).toBe('false');
});

test('惊态快速重播、切态、对照和减少动态立即取消五官动作', async ({ page }) => {
  await openSurprise(page);
  await expect(rig(page)).toHaveAttribute('data-ready', 'true');
  await page.locator('#expressionLionTrigger').click();
  await page.locator('#expressionLionTrigger').click();
  await expect.poll(() => page.evaluate(() => window.faceAnimations.length)).toBe(10);
  expect(await page.evaluate(() => window.faceAnimations.slice(0, 5).every(animation => animation.playState === 'idle'))).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(rig(page)).toHaveAttribute('data-playing', 'false');
  expect(await page.locator('#expressionLion').evaluate(image => getComputedStyle(image).opacity)).toBe('1');
  await page.locator('#expressionLionTrigger').click();
  expect(await page.evaluate(() => window.faceAnimations.length)).toBe(10);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#expressionLionTrigger').click();
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  await expect(rig(page)).toHaveAttribute('data-playing', 'false');
  expect(await page.evaluate(() => window.faceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
  await page.getByRole('button', { name: '八态浏览', exact: true }).click();
  await page.locator('#expressionLionTrigger').click();
  await page.locator('.expression-state-button').filter({ hasText: '怒' }).click();
  await expect(rig(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.faceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
});

test('补绘素材失败时惊态保留完整原图和点击解读', async ({ page }) => {
  await page.route('**/lion-surprise-underpaint-v1.png', route => route.abort());
  await openSurprise(page);
  await page.locator('#expressionLionTrigger').click();
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  expect(await page.locator('#expressionLion').evaluate(image => image.complete && image.naturalWidth === 1254 && getComputedStyle(image).opacity === '1')).toBe(true);
  expect(await page.evaluate(() => window.faceAnimations.length)).toBe(0);
});

test('离开神态的首帧取消五官动画，快速返回不续播旧动作', async ({ page }) => {
  await openSurprise(page);
  await expect(rig(page)).toHaveAttribute('data-ready', 'true');
  await page.locator('#expressionLionTrigger').click();
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(rig(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.faceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
  await page.evaluate(() => { location.hash = '/state'; });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.expression-face-rig')).toHaveAttribute('data-playing', 'false');
  expect(await page.evaluate(() => window.faceAnimations.every(animation => animation.playState === 'idle'))).toBe(true);
});
