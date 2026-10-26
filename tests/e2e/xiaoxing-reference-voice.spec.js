import { test, expect } from '@playwright/test';

const pet = page => page.getByRole('button', { name: '与小醒对话', exact: true });
const playback = page => page.getByRole('button', { name: '当前章节语音讲解', exact: true });
const answer = '醒狮抖毛通过短促的连续动作，让狮身显得精神而有力量。这段动态回答应使用你选定的小醒参考音色。';

// The network stands in for the external model only. Chrome decodes and plays
// this real PCM WAV through the application's unmodified Audio lifecycle.
const samples = 8000 * 8;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let index = 0; index < samples; index += 1) wav.writeInt16LE(Math.round(Math.sin(index * Math.PI / 20) * 300), 44 + index * 2);

test.beforeEach(async ({ page }) => {
  page.voiceErrors = [];
  page.on('pageerror', error => page.voiceErrors.push(error.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    const NativeAudio = window.Audio;
    window.__referenceVoiceAudio = [];
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      if (/\/xiaoxing\/voice\/|^blob:/.test(String(args[0]))) window.__referenceVoiceAudio.push(audio);
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    window.__referenceVoiceRevoked = [];
    URL.revokeObjectURL = url => { window.__referenceVoiceRevoked.push(url); nativeRevoke(url); };
    window.__referenceVoiceFallbacks = 0;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: 'Microsoft Yaoyao', lang: 'zh-CN' }],
      addEventListener() {}, removeEventListener() {}, cancel() {},
      speak() { window.__referenceVoiceFallbacks += 1; },
    } });
  });
  await page.route('**/xiaoxing/voice/*.wav', route => route.fulfill({ contentType: 'audio/wav', body: wav }));
  await page.route('**/api/xiaoxing/chat', route => route.fulfill({ json: { mode: 'online', answer, sources: [] } }));
});

test.afterEach(async ({ page }) => { expect(page.voiceErrors).toEqual([]); });

async function enableAndAsk(page) {
  await page.goto('/#/state');
  await expect(pet(page)).toBeVisible();
  await playback(page).click();
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'true');
  await playback(page).click();
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'false');
  await pet(page).click();
  await page.getByLabel('向小醒提问', { exact: true }).fill('抖毛是什么动作？');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect(page.locator('.xiaoxing-message.is-assistant').last()).toContainText(answer);
}

test('动态回答经同源语音接口后播放真实Blob音频，收起聊天仍继续且停止恢复页面音量', async ({ page }) => {
  let request;
  await page.route('**/api/xiaoxing/speech', async route => {
    request = { method: route.request().method(), url: route.request().url(), body: route.request().postDataJSON() };
    await route.fulfill({ contentType: 'audio/wav', body: wav });
  });
  await enableAndAsk(page);
  await expect.poll(() => request).toBeTruthy();
  expect(request).toEqual({ method: 'POST', url: 'http://127.0.0.1:42833/api/xiaoxing/speech', body: { text: answer } });
  await expect.poll(() => page.evaluate(() => __referenceVoiceAudio.find(audio => audio.src.startsWith('blob:'))?.currentTime || 0)).toBeGreaterThan(.02);
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'true');
  const objectURL = await page.evaluate(() => __referenceVoiceAudio.at(-1).src);
  await page.evaluate(async base64 => {
    const audio = document.createElement('audio');
    audio.id = 'referenceVoicePageMedia'; audio.loop = true; audio.volume = .65;
    audio.src = `data:audio/wav;base64,${base64}`; document.body.append(audio); await audio.play();
  }, wav.toString('base64'));
  await expect.poll(() => page.locator('#referenceVoicePageMedia').evaluate(audio => audio.volume)).toBeCloseTo(.117, 3);
  await page.getByRole('button', { name: '收起小醒对话', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '小醒 · 醒狮讲解员' })).toHaveCount(0);
  const before = await page.evaluate(() => __referenceVoiceAudio.at(-1).currentTime);
  await expect.poll(() => page.evaluate(() => __referenceVoiceAudio.at(-1).currentTime)).toBeGreaterThan(before + .03);
  await playback(page).click();
  expect(await page.evaluate(() => __referenceVoiceAudio.at(-1).paused && !__referenceVoiceAudio.at(-1).hasAttribute('src'))).toBe(true);
  expect(await page.evaluate(() => __referenceVoiceRevoked)).toContain(objectURL);
  await expect.poll(() => page.locator('#referenceVoicePageMedia').evaluate(audio => audio.volume)).toBeCloseTo(.65, 3);
  expect(await page.evaluate(() => __referenceVoiceFallbacks)).toBe(0);
});

test('准备中可从常驻键停止，页面音量保持原值且迟到结果不能开声', async ({ page }) => {
  let release;
  let requested = false;
  let aborted = false;
  page.on('requestfailed', request => { if (request.url().endsWith('/api/xiaoxing/speech')) aborted = true; });
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/xiaoxing/speech', async route => {
    requested = true;
    await delayed;
    await route.fulfill({ contentType: 'audio/wav', body: wav }).catch(() => {});
  });
  await enableAndAsk(page);
  await expect.poll(() => requested).toBe(true);
  await expect(playback(page)).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.xiaoxing-voice-status')).toContainText('正在准备声音');
  await page.evaluate(async base64 => {
    const audio = document.createElement('audio');
    audio.id = 'referenceVoicePageMedia'; audio.loop = true; audio.volume = .65;
    audio.src = `data:audio/wav;base64,${base64}`; document.body.append(audio); await audio.play();
  }, wav.toString('base64'));
  await expect.poll(() => page.locator('#referenceVoicePageMedia').evaluate(audio => audio.currentTime)).toBeGreaterThan(.02);
  expect(await page.locator('#referenceVoicePageMedia').evaluate(audio => audio.volume)).toBeCloseTo(.65, 3);
  await playback(page).click();
  await expect(playback(page)).toHaveAttribute('aria-busy', 'false');
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => aborted).toBe(true);
  release();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => __referenceVoiceAudio.filter(audio => audio.src.startsWith('blob:')).length)).toBe(0);
  expect(await page.locator('#referenceVoicePageMedia').evaluate(audio => audio.volume)).toBeCloseTo(.65, 3);
  expect(await page.evaluate(() => __referenceVoiceFallbacks)).toBe(0);
});

test('语音服务失败保留文字并说明声音暂不可用，已有中文女声也不冒充选定音色', async ({ page }) => {
  let requested = false;
  await page.route('**/api/xiaoxing/speech', async route => {
    requested = true;
    await route.fulfill({ status: 503, json: { error: 'unavailable' } });
  });
  await enableAndAsk(page);
  await expect.poll(() => requested).toBe(true);
  await expect(page.locator('.xiaoxing-voice-status')).toContainText('声音暂不可用');
  await expect(page.locator('.xiaoxing-message.is-assistant').last()).toContainText(answer);
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(playback(page)).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => __referenceVoiceFallbacks)).toBe(0);
});

test('四章五处固定导览直接使用对应音频，不请求动态合成服务', async ({ page }) => {
  let speechRequests = 0;
  await page.route('**/api/xiaoxing/speech', async route => {
    speechRequests += 1;
    await route.fulfill({ status: 503, json: { error: 'unexpected' } });
  });
  await page.goto('/#/entry');
  for (const chapter of ['entry', 'model', 'action', 'state', 'spread']) {
    await page.evaluate(route => { location.hash = `/${route}`; }, chapter);
    await expect(page.locator('.xiaoxing-companion')).toHaveAttribute('data-chapter', chapter);
    await expect(playback(page)).toBeVisible();
    await playback(page).click();
    await expect.poll(() => page.evaluate(() => __referenceVoiceAudio.at(-1)?.currentTime || 0)).toBeGreaterThan(.02);
    expect(await page.evaluate(() => __referenceVoiceAudio.at(-1).src)).toContain(`/xiaoxing/voice/${chapter}.wav`);
    await playback(page).click();
  }
  expect(speechRequests).toBe(0);
  expect(await page.evaluate(() => __referenceVoiceFallbacks)).toBe(0);
});

test('长回答只合成前1200字并向用户说明朗读范围', async ({ page }) => {
  const longAnswer = '这是关于醒狮动作的补充说明。'.repeat(100);
  let requestedText;
  await page.route('**/api/xiaoxing/chat', route => route.fulfill({ json: { mode: 'online', answer: longAnswer, sources: [] } }));
  await page.route('**/api/xiaoxing/speech', async route => {
    requestedText = route.request().postDataJSON().text;
    await route.fulfill({ contentType: 'audio/wav', body: wav });
  });
  await page.goto('/#/state');
  await expect(pet(page)).toBeVisible();
  await playback(page).click();
  await expect(playback(page)).toHaveAttribute('aria-pressed', 'true');
  await playback(page).click();
  await pet(page).click();
  await page.getByLabel('向小醒提问', { exact: true }).fill('详细介绍醒狮动作');
  await page.getByRole('button', { name: '发送问题', exact: true }).click();
  await expect.poll(() => requestedText).toBeTruthy();
  expect(requestedText).toBe(longAnswer.slice(0, 1200));
  await expect(page.locator('.xiaoxing-message.is-assistant').last()).toContainText(longAnswer);
  await expect(page.getByRole('button', { name: '语音讲解', exact: true })).toHaveAttribute('title', /前\s*1200\s*字/);
});
