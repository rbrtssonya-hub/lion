import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pet = page => page.getByRole('button', { name: '与小醒对话', exact: true });
const dialog = page => page.getByRole('dialog', { name: '小醒 · 醒狮讲解员', exact: true });
const replies = page => page.locator('.xiaoxing-message.is-assistant');
async function expectLayeredPet(page) {
  await expect(pet(page)).toBeVisible();
  await expect(page.locator('.xiaoxing-avatar')).toHaveAttribute('data-layered', 'true');
  const layers = await page.locator('.xiaoxing-layer').evaluateAll(images => images.map(image =>
    ({ complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })));
  expect(layers).toHaveLength(9);
  expect(layers.every(image => image.complete && image.width === 1349 && image.height === 1166)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  page.xiaoxingErrors = [];
  page.on('pageerror', error => page.xiaoxingErrors.push(error.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    try { sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); } catch { /* The app also supports unavailable storage. */ }
  });
});
test.afterEach(async ({ page }) => { expect(page.xiaoxingErrors).toEqual([]); });

test('小醒随四章切换提供本地讲解和可返回的资料来源', async ({ page }, testInfo) => {
  await page.goto('/#/entry');
  await expectLayeredPet(page);
  await pet(page).screenshot({ path: testInfo.outputPath('xiaoxing-layered-idle.png'), omitBackground: true });
  await pet(page).click();
  await expect(page.getByLabel('向小醒提问', { exact: true })).toBeFocused();
  for (const [chapter, title] of [['entry', '入境'], ['model', '观形'], ['action', '动作'], ['state', '神态'], ['spread', '狮行远方']]) {
    await page.evaluate(route => { location.hash = `/${route}`; }, chapter);
    await expect(dialog(page).locator('.xiaoxing-title p')).toContainText(title);
    await dialog(page).getByRole('button', { name: '讲解本页', exact: true }).click();
    await expect(replies(page).last()).toHaveAttribute('data-mode', 'local');
    await expect(replies(page).last().locator('.xiaoxing-message-text')).not.toBeEmpty();
    await expect(replies(page).last().getByRole('navigation', { name: '回答来源' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: '语音讲解', exact: true })).toBeVisible();
  }
  await dialog(page).screenshot({ path: testInfo.outputPath('xiaoxing-panel-local-guide.png') });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(pet(page)).toBeFocused();
});

test('鼠标拖动与键盘移动保持在窗口内，拖动不误开面板并保存位置', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    if (!localStorage.getItem('nanfeng-xiaoxing-position-v1')) localStorage.setItem('nanfeng-xiaoxing-position-v1', JSON.stringify({ x: 1100, y: 600, width: 1440, height: 900 }));
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  const before = await pet(page).boundingBox();
  await page.mouse.move(before.x + 65, before.y + 60);
  await page.mouse.down();
  await page.mouse.move(before.x - 170, before.y - 60, { steps: 10 });
  await page.mouse.up();
  await expect(dialog(page)).toHaveCount(0);
  const moved = await pet(page).boundingBox();
  expect(moved.x).toBeLessThan(before.x - 200);
  expect(moved.y).toBeLessThan(before.y - 100);
  await pet(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await pet(page).boundingBox()).x).toBeCloseTo(moved.x - 16, 0);
  const saved = await pet(page).boundingBox();
  await page.reload();
  await expect(pet(page)).toBeVisible();
  expect((await pet(page).boundingBox()).x).toBeCloseTo(saved.x, 0);
  await page.setViewportSize({ width: 1024, height: 600 });
  await expect.poll(async () => { const box = await pet(page).boundingBox(); return box.y + box.height; }).toBeLessThanOrEqual(586);
  const resized = await pet(page).boundingBox();
  expect(resized.x).toBeGreaterThanOrEqual(14);
  expect(resized.x + resized.width).toBeLessThanOrEqual(1010);
  expect(resized.y + resized.height).toBeLessThanOrEqual(586);
  await page.reload();
  await expectLayeredPet(page);
  await expect.poll(async () => (await pet(page).boundingBox()).x).toBeCloseTo(resized.x, 0);
  await expect.poll(async () => (await pet(page).boundingBox()).y).toBeCloseTo(resized.y, 0);
  await page.evaluate(() => { location.hash = '/model'; });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect.poll(async () => (await pet(page).boundingBox()).x).toBeCloseTo(resized.x, 0);
  await pet(page).click();
  await dialog(page).evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const card = await dialog(page).boundingBox();
  expect(card.x).toBeGreaterThanOrEqual(14);
  expect(card.x + card.width).toBeLessThanOrEqual(1010);
  expect(card.y + card.height).toBeLessThanOrEqual(586);
});

test('断网保留问答与资料边界，未收录问题如实回应', async ({ page, context }) => {
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await context.setOffline(true);
  await page.getByLabel('向小醒提问', { exact: true }).fill('这些神态图片是自动情绪识别和评分吗？');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(replies(page).last()).toHaveAttribute('data-mode', 'local');
  await expect(replies(page).last()).toContainText(/定性|AI辅助|自动识别/);
  await page.getByLabel('向小醒提问', { exact: true }).fill('请告诉我太阳系之外某颗星球今天的天气');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(replies(page).last().locator('.xiaoxing-message-text')).toContainText(/未收录|没有收录|资料之外|资料中没有|暂未/);
  await expect(dialog(page).locator('.xiaoxing-service-label')).toHaveText('本地讲解');
});

test('首页来源入口真实切换到对应展板，鼠标拖动失焦恢复并释放拖动', async ({ page }) => {
  await page.goto('/#/entry');
  await expectLayeredPet(page);
  await pet(page).click();
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  await replies(page).last().getByRole('button', { name: '首页 · 岭南醒狮志', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.home-exhibit')).toHaveAttribute('data-active-panel', '0');
  await expect(page.locator('.home-exhibit')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#homeLionBook')).toBeVisible();
  const before = await pet(page).boundingBox();
  await page.mouse.move(before.x + 65, before.y + 60);
  await page.mouse.down();
  await page.mouse.move(before.x - 50, before.y + 20, { steps: 5 });
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-dragging', 'true');
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-dragging', 'false');
  expect((await pet(page).boundingBox()).x).toBeCloseTo(before.x, 0);
  await page.mouse.up();
  await pet(page).click();
  await expect(dialog(page)).toBeVisible();
});

test('联网上游测试夹具覆盖当前章节、思考状态和回答来源跳转', async ({ page }, testInfo) => {
  let request;
  await page.route('**/api/xiaoxing/chat', async route => {
    request = route.request().postDataJSON();
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({ json: { mode: 'online', answer: '这是智能接口的测试回答，用于验证当前章节与资料跳转。',
      sources: [{ id: 'test-entry', label: '测试资料 · 首页', chapter: 'entry' }] } });
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'listening');
  await expect.poll(() => page.locator('.xiaoxing-layer--mouth-closed').evaluate(element => getComputedStyle(element).opacity)).toBe('1');
  await expect.poll(() => page.locator('.xiaoxing-head-group').evaluate(element => parseFloat(getComputedStyle(element).rotate))).toBeLessThan(-3);
  await page.getByLabel('向小醒提问', { exact: true }).fill('讲讲醒狮神态');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'thinking');
  await expect.poll(() => page.locator('.xiaoxing-layer--brow-right').evaluate(element => parseFloat(getComputedStyle(element).translate.split(' ').at(-1)))).toBeLessThan(-1.8);
  await expect(replies(page).last()).toHaveAttribute('data-mode', 'online');
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'answering');
  const mouthFrames = await page.locator('.xiaoxing-avatar').evaluate(async element => {
    const frames = [];
    const until = performance.now() + 1250;
    while (performance.now() < until) {
      frames.push([getComputedStyle(element.querySelector('.xiaoxing-layer--mouth-talk')).opacity,
        getComputedStyle(element.querySelector('.xiaoxing-layer--mouth-smile')).opacity]);
      await new Promise(requestAnimationFrame);
    }
    return frames;
  });
  expect(mouthFrames.some(([talk, smile]) => talk === '1' && smile === '0')).toBe(true);
  expect(mouthFrames.some(([talk, smile]) => talk === '0' && smile === '1')).toBe(true);
  await pet(page).screenshot({ path: testInfo.outputPath('xiaoxing-layered-answering.png'), omitBackground: true });
  expect(request.chapter).toBe('state');
  expect(request.question).toBe('讲讲醒狮神态');
  await page.getByRole('button', { name: '测试资料 · 首页' }).click();
  await expect(page).toHaveURL(/#\/entry$/);
  await expect(dialog(page)).toHaveCount(0);
});

test('本页讲解能取消等待中的回答，减少动态仍可操作', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/xiaoxing/chat', async route => {
    await delayed;
    await route.fulfill({ json: { mode: 'online', answer: '不应出现的旧回答', sources: [] } }).catch(() => {});
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await page.getByLabel('向小醒提问', { exact: true }).fill('先帮我想一想');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'thinking');
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  release();
  await expect(replies(page).last()).toHaveAttribute('data-mode', 'local');
  await expect(dialog(page)).not.toContainText('不应出现的旧回答');
  const animations = await page.locator('.xiaoxing-avatar').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length);
  expect(animations).toBe(0);
  await page.keyboard.press('Escape');
  await expect(pet(page)).toBeFocused();
  const before = await pet(page).boundingBox();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await pet(page).boundingBox()).y).toBeCloseTo(before.y - 16, 0);
});

test('换章后结束旧思考，迟到的旧回答不会驱动新章节表情', async ({ page }) => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/xiaoxing/chat', async route => {
    await delayed;
    await route.fulfill({ json: { mode: 'online', answer: '过期的神态回答', sources: [] } }).catch(() => {});
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await page.getByLabel('向小醒提问', { exact: true }).fill('讲讲神态');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'thinking');
  await page.evaluate(() => { location.hash = '/action'; });
  await expect(dialog(page).locator('.xiaoxing-title p')).toContainText('动作');
  await expect(page.locator('.xiaoxing-companion')).not.toHaveAttribute('data-state', 'thinking', { timeout: 2000 });
  release();
  await expect(dialog(page)).not.toContainText('过期的神态回答');
});

test('待机时独立眼层真实眨眼，身体与脸部图层保持对齐', async ({ page }, testInfo) => {
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('.xiaoxing-avatar')).toHaveAttribute('data-animated', 'true');
  const blink = await page.locator('.xiaoxing-layer--eye-left').evaluate(async element => {
    const until = performance.now() + 7000;
    while (performance.now() < until) {
      const transform = getComputedStyle(element).transform;
      const scaleY = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).d;
      if (scaleY < .5) {
        // Freeze the naturally reached blink frame so the screenshot records
        // that actual state instead of a later reopened eye during capture.
        element.closest('.xiaoxing-avatar').getAnimations({ subtree: true }).forEach(animation => animation.pause());
        return { scaleY, transform };
      }
      await new Promise(requestAnimationFrame);
    }
    return null;
  });
  expect(blink?.scaleY).toBeLessThan(.5);
  expect(await page.locator('.xiaoxing-head-group > .xiaoxing-layer').count()).toBe(8);
  await pet(page).screenshot({ path: testInfo.outputPath('xiaoxing-layered-blink.png'), omitBackground: true });
});

test('网页可见但未聚焦时头身仍独立活动，悬停后眉眼明确进入倾听', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false }));
  await page.goto('/#/state');
  await expectLayeredPet(page);
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  await expect(page.locator('.xiaoxing-avatar')).toHaveAttribute('data-animated', 'true');
  const motion = await page.locator('.xiaoxing-avatar').evaluate(async element => {
    const samples = [];
    const until = performance.now() + 1800;
    while (performance.now() < until) {
      const head = new DOMMatrixReadOnly(getComputedStyle(element.querySelector('.xiaoxing-head-group')).transform);
      const body = new DOMMatrixReadOnly(getComputedStyle(element.querySelector('.xiaoxing-layer--body')).transform);
      samples.push({ head: Math.atan2(head.b, head.a) * 180 / Math.PI, body: body.m42 });
      await new Promise(requestAnimationFrame);
    }
    const range = key => Math.max(...samples.map(sample => sample[key])) - Math.min(...samples.map(sample => sample[key]));
    return { head: range('head'), body: range('body') };
  });
  expect(motion.head).toBeGreaterThan(.25);
  expect(motion.body).toBeGreaterThan(.15);
  await pet(page).hover();
  await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-state', 'listening');
  await expect.poll(() => page.locator('.xiaoxing-head-group').evaluate(element => parseFloat(getComputedStyle(element).rotate))).toBeLessThan(-3);
  await pet(page).screenshot({ path: testInfo.outputPath('xiaoxing-listening-default-size.png'), omitBackground: true });
});

test('语音明确开启后播放选定音色，收起继续、切章停止，动态回答通过同源服务朗读', async ({ page }) => {
  const speechRequests = [];
  // Reuse a packaged WAV as the external synthesis response fixture. The
  // request assertion checks the answer text; real voice matching is separate.
  const speechFixture = readFileSync(new URL('../../source/public/assets/xiaoxing/voice/state.wav', import.meta.url));
  await page.route('**/api/xiaoxing/speech', async route => {
    speechRequests.push({ method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() });
    await route.fulfill({ contentType: 'audio/wav', body: speechFixture });
  });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const NativeAudio = window.Audio;
    window.__xiaoxingRecordings = [];
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      if (/\/xiaoxing\/voice\/|^blob:/.test(String(args[0]))) window.__xiaoxingRecordings.push(audio);
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
    window.__xiaoxingSyntheticSpoken = 0;
    if (window.speechSynthesis) {
      const nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = utterance => { window.__xiaoxingSyntheticSpoken += 1; nativeSpeak(utterance); };
    }
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  expect(await page.evaluate(() => __xiaoxingRecordings.length)).toBe(0);
  await page.getByRole('button', { name: '语音讲解', exact: true }).click();
  await expect.poll(() => page.evaluate(() => __xiaoxingRecordings[0]?.currentTime ?? 0)).toBeGreaterThan(.02);
  expect(await page.evaluate(() => __xiaoxingRecordings[0].src)).toContain('/xiaoxing/voice/state.wav');
  await page.getByRole('button', { name: '收起小醒对话', exact: true }).click();
  const chapterVoice = page.getByRole('button', { name: '当前章节语音讲解', exact: true });
  await expect(chapterVoice).toBeVisible();
  const petBounds = await pet(page).boundingBox(), voiceBounds = await chapterVoice.boundingBox();
  expect(voiceBounds.x >= petBounds.x + petBounds.width || voiceBounds.x + voiceBounds.width <= petBounds.x).toBe(true);
  expect(voiceBounds.x + voiceBounds.width).toBeLessThanOrEqual(1440);
  expect(voiceBounds.y + voiceBounds.height).toBeLessThanOrEqual(900);
  expect(await page.evaluate(() => !__xiaoxingRecordings[0].paused && __xiaoxingRecordings[0].hasAttribute('src'))).toBe(true);
  await chapterVoice.click();
  expect(await page.evaluate(() => __xiaoxingRecordings[0].paused && !__xiaoxingRecordings[0].hasAttribute('src'))).toBe(true);
  await chapterVoice.click();
  await expect.poll(() => page.evaluate(() => __xiaoxingRecordings[1]?.currentTime ?? 0)).toBeGreaterThan(.02);
  await expect(chapterVoice).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { location.hash = '/action'; });
  expect(await page.evaluate(() => __xiaoxingRecordings[1].paused)).toBe(true);
  await expect(chapterVoice).toHaveAttribute('aria-pressed', 'false');
  await pet(page).click();
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  await page.getByLabel('向小醒提问', { exact: true }).fill('抖毛是什么动作？');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(replies(page).last()).toContainText('抖毛');
  await expect.poll(() => speechRequests.length).toBe(1);
  const answerText = await replies(page).last().locator('.xiaoxing-message-text').innerText();
  expect(speechRequests[0]).toEqual({ method: 'POST', url: `${new URL(page.url()).origin}/api/xiaoxing/speech`, body: { text: answerText } });
  await expect.poll(() => page.evaluate(() => __xiaoxingRecordings.at(-1)?.src || '')).toMatch(/^blob:/);
  await expect.poll(() => page.evaluate(() => __xiaoxingRecordings.at(-1)?.currentTime ?? 0)).toBeGreaterThan(.02);
  await expect(chapterVoice).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => __xiaoxingSyntheticSpoken)).toBe(0);
});

test('模拟迟到的声音播放回调在关闭语音后不能重新发声', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const NativeAudio = window.Audio;
    window.__xiaoxingPending = null;
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      if (String(args[0]).includes('/xiaoxing/voice/')) {
        audio.play = () => new Promise(resolve => { window.__xiaoxingPending = { audio, started: audio.onplaying, resolve }; });
      }
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  const toggle = page.getByRole('button', { name: '语音讲解', exact: true });
  await toggle.click();
  await expect.poll(() => page.evaluate(() => Boolean(__xiaoxingPending))).toBe(true);
  await toggle.click();
  await page.evaluate(() => { __xiaoxingPending.started(); __xiaoxingPending.resolve(); });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => __xiaoxingPending.audio.paused && !__xiaoxingPending.audio.hasAttribute('src'))).toBe(true);
  await expect.poll(() => page.locator('.xiaoxing-companion').getAttribute('data-state')).not.toBe('answering');
});

test('真实首页视频在小醒讲解时降低音量，收起聊天保留播报，停止与切章恢复原音量', async ({ page }) => {
  await page.goto('/#/entry');
  await expectLayeredPet(page);
  const video = page.locator('#entryLionVideo');
  const slider = page.locator('.home-page').getByRole('slider', { name: '音量', exact: true });
  const setVolume = async percentage => {
    await slider.focus();
    await slider.press('Home');
    for (let step = 0; step < percentage; step += 1) await slider.press('ArrowRight');
  };
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await setVolume(60);
  await expect.poll(() => video.evaluate(element => !element.paused)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.6, 2);
  await pet(page).click();
  await page.getByRole('button', { name: '语音讲解', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.108, 3);
  await setVolume(40);
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.072, 3);
  await page.locator('#toggleHomeAudio').click();
  await expect.poll(() => video.evaluate(element => element.muted)).toBe(true);
  await page.getByRole('button', { name: '收起小醒对话', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前章节语音讲解', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await video.evaluate(element => element.muted)).toBe(true);
  await page.locator('#toggleHomeAudio').click();
  await expect.poll(() => video.evaluate(element => !element.muted)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.072, 3);
  await page.getByRole('button', { name: '当前章节语音讲解', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.4, 2);
  expect(await video.evaluate(element => !element.muted)).toBe(true);
  await pet(page).click();
  await page.getByRole('button', { name: '讲解本页', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.volume)).toBeLessThan(.25);
  await page.evaluate(() => { location.hash = '/state'; });
  await expect.poll(() => video.evaluate(element => element.volume)).toBeCloseTo(.4, 2);
});

test('1366电脑窗口的神态对话靠右停放，中央主狮头保持完整可见', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/#/state');
  await expectLayeredPet(page);
  await pet(page).click();
  await dialog(page).evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const panel = await dialog(page).boundingBox();
  const lion = await page.locator('#expressionLionTrigger').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(950);
  expect(panel.x).toBeGreaterThanOrEqual(lion.x + lion.width);
  await page.screenshot({ path: testInfo.outputPath('xiaoxing-state-1366-central-lion-visible.png') });
});
