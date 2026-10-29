import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 1920, height: 1080 }, trace: 'off' });
test.setTimeout(300_000);

const states = [['joy', '喜'], ['anger', '怒'], ['sorrow', '哀'], ['delight', '乐'], ['motion', '动'], ['stillness', '静'], ['surprise', '惊'], ['doubt', '疑']];
const reviewDirectory = new URL('../../source/reviews/expression-depth/2026-10-28/', import.meta.url);
const stage = page => page.getByRole('region', { name: '醒狮八态纵深图鉴', exact: true });
const tour = page => stage(page).getByRole('region', { name: '自动巡游', exact: true });
const snapshot = page => page.evaluate(() => window.__LION_DEPTH_SCENE__);

async function prepare(page, { mode = 'webgl', readingDuration } = {}) {
  await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
  await page.addInitScript(readingDuration => {
    if (window !== window.top) return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (readingDuration !== undefined) localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ expressionTourReadingDuration: readingDuration }));
    window.__DEPTH_TOUR_AUDIO__ = [];
    window.__DEPTH_TOUR_AUDIO_EVENTS__ = [];
    window.__DEPTH_TOUR_HASH_EVENTS__ = [];
    window.addEventListener('hashchange', () => window.__DEPTH_TOUR_HASH_EVENTS__.push({ at: performance.now(), hash: location.hash }));
    // Observe native detached Audio elements without replacing their playback,
    // durations, clocks, event dispatch, source loading, or volume behavior.
    window.Audio = new Proxy(window.Audio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args);
        window.__DEPTH_TOUR_AUDIO__.push(audio);
        for (const type of ['playing', 'ended', 'error', 'pause']) audio.addEventListener(type, event => {
          if (!audio.currentSrc.includes('/expression-depth/audio/')) return;
          window.__DEPTH_TOUR_AUDIO_EVENTS__.push({
            at: performance.now(), type, trusted: event.isTrusted, src: audio.currentSrc,
            currentTime: audio.currentTime, duration: audio.duration, volume: audio.volume, muted: audio.muted,
            station: Number(document.querySelector('.expression-depth .auto-tour')?.getAttribute('data-station')),
          });
        });
        return audio;
      },
    });
  }, readingDuration);
  await page.goto(`/?inspect=1${mode === 'static' ? '&static=1' : ''}#/state`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 65_000 });
  await expect(stage(page)).toHaveClass(mode === 'webgl' ? /has-webgl/ : /is-static/);
  await page.evaluate(() => document.fonts.ready);
  await expect(stage(page).locator('.depth-scroll-viewport [data-depth-anchor]')).toHaveCount(11);
  if (mode === 'webgl') await expect.poll(async () => (await snapshot(page))?.cards.length).toBe(8);
  await page.evaluate(() => {
    const element = document.querySelector('.expression-depth .auto-tour');
    window.__DEPTH_TOUR_PHASES__ = [];
    const record = () => {
      const event = { at: performance.now(), phase: element.dataset.phase, station: Number(element.dataset.station), status: element.dataset.status };
      const previous = window.__DEPTH_TOUR_PHASES__.at(-1);
      if (!previous || event.phase !== previous.phase || event.station !== previous.station || event.status !== previous.status) window.__DEPTH_TOUR_PHASES__.push(event);
    };
    window.__DEPTH_TOUR_PHASE_OBSERVER__ = new MutationObserver(record);
    window.__DEPTH_TOUR_PHASE_OBSERVER__.observe(element, { attributes: true, attributeFilter: ['data-phase', 'data-station', 'data-status'] });
    record();
  });
}

async function waitForStation(page, station, timeout = 12_000) {
  await expect(tour(page)).toHaveAttribute('data-station', String(station), { timeout });
  await expect(tour(page)).toHaveAttribute('data-phase', 'viewing', { timeout });
  await expect(tour(page)).toHaveAttribute('data-status', 'running');
}

async function clickArtwork(page, index) {
  const bounds = (await snapshot(page)).cards[index].artworkPlaneBounds;
  const point = { x: bounds.centerX, y: bounds.centerY };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
  await page.mouse.click(point.x, point.y);
}

test('默认巡游从卷首走完八态，真实3秒五官、12秒解读、6秒运镜及八段自然完播旁白', async ({ page }, testInfo) => {
  const evidence = { startedAt: new Date().toISOString(), defaults: { moveSeconds: 6, readingSeconds: 12, volume: .25 }, states: [], errors: [] };
  page.on('pageerror', error => evidence.errors.push(error.message));
  try {
    await prepare(page);
    await expect.poll(async () => (await snapshot(page))?.chapter).toBe(0);
    expect((await snapshot(page)).faces.every(face => face.playCount === 0 && !face.playing)).toBe(true);
    await tour(page).getByRole('button', { name: '开始自动巡游', exact: true }).click();
    await expect(tour(page)).toHaveAttribute('data-status', 'running');
    for (let index = 0; index < states.length; index++) {
      const [id, title] = states[index];
      const station = index + 2;
      await waitForStation(page, station, index === 0 ? 35_000 : 12_000);
      await expect.poll(async () => (await snapshot(page))?.faces[index]?.ready).toBe(true);
      const before = await snapshot(page);
      expect(before.faces[index].playCount).toBe(0);
      expect(before.faces.every(face => !face.playing)).toBe(true);
      expect(before.faces.map(face => face.playCount)).toEqual(states.map((_, previous) => previous < index ? 1 : 0));
      await expect(stage(page).getByRole('dialog')).toHaveCount(0);
      await expect(stage(page).locator('.state-rail').getByRole('link', { name: title, exact: true })).toHaveAttribute('aria-current', 'location');
      await clickArtwork(page, index);
      await expect(tour(page)).toHaveAttribute('data-phase', 'animating');
      await expect.poll(async () => (await snapshot(page))?.faces[index]?.playing).toBe(true);
      const dialog = stage(page).getByRole('dialog');
      await expect(dialog).toHaveCount(1, { timeout: 6000 });
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(new RegExp(`^${title} · `));
      await expect(dialog.locator('.gallery-tour-reading strong')).toHaveText('12');
      await expect(tour(page)).toHaveAttribute('data-phase', 'reading');
      await expect.poll(async () => (await snapshot(page))?.faces[index]?.elapsed).toBe(3000);
      await expect(dialog).toHaveCount(0, { timeout: 16_000 });
      await expect(tour(page)).toHaveAttribute('data-phase', 'moving');
      await expect(tour(page)).toHaveAttribute('data-station', String(station + 1));
      await waitForStation(page, station + 1);
      const events = await page.evaluate(() => window.__DEPTH_TOUR_PHASES__);
      const animated = events.find(event => event.station === station && event.phase === 'animating');
      const reading = events.find(event => event.station === station && event.phase === 'reading');
      const departed = events.find(event => event.station === station + 1 && event.phase === 'moving');
      const arrived = events.find(event => event.station === station + 1 && event.phase === 'viewing');
      const audio = await page.evaluate(id => window.__DEPTH_TOUR_AUDIO_EVENTS__.filter(event => event.src.endsWith(`/${id}.wav`)), id);
      const ended = audio.find(event => event.type === 'ended');
      const timing = { id, title, station, faceMs: reading.at - animated.at, readingMs: departed.at - reading.at, moveMs: arrived.at - departed.at, audioEndedBeforeDepartureMs: ended ? departed.at - ended.at : null, audio };
      evidence.states.push(timing);
      expect(timing.faceMs, `${title}态真实五官时长`).toBeGreaterThanOrEqual(2800);
      expect(timing.faceMs).toBeLessThan(5000);
      expect(timing.readingMs, `${title}态默认阅读12秒`).toBeGreaterThanOrEqual(11_500);
      expect(timing.readingMs).toBeLessThan(14_000);
      expect(timing.moveMs, `${title}态离站后的默认6秒运镜`).toBeGreaterThanOrEqual(5300);
      expect(timing.moveMs).toBeLessThan(8000);
      expect(ended, `${title}态须在离站前自然完播`).toBeDefined();
      expect(ended.trusted).toBe(true);
      expect(ended.volume).toBe(.25);
      expect(ended.muted).toBe(false);
      expect(ended.currentTime).toBeCloseTo(ended.duration, 1);
      expect(ended.at).toBeLessThanOrEqual(departed.at);
      expect(audio.filter(event => event.type === 'error')).toEqual([]);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(new URL(page.url()).hash).toBe('#/state');
      console.log(`${title}态：动效 ${Math.round(timing.faceMs)}ms，阅读 ${Math.round(timing.readingMs)}ms，运镜 ${Math.round(timing.moveMs)}ms，旁白已自然完播。`);
    }
    await expect(tour(page)).toHaveAttribute('data-status', 'ended', { timeout: 6000 });
    expect((await snapshot(page)).faces.every(face => face.playCount === 1 && !face.playing)).toBe(true);
    expect(await page.evaluate(() => window.__DEPTH_TOUR_AUDIO_EVENTS__.filter(event => event.type === 'ended').length)).toBe(8);
    expect(await page.evaluate(() => window.__DEPTH_TOUR_HASH_EVENTS__)).toEqual([]);
    expect(evidence.errors).toEqual([]);
    evidence.status = 'passed';
  } catch (error) {
    evidence.status = 'failed';
    evidence.failure = error.message;
    throw error;
  } finally {
    evidence.finishedAt = new Date().toISOString();
    evidence.baseURL = testInfo.project.use.baseURL;
    const observed = await page.evaluate(() => ({ phases: window.__DEPTH_TOUR_PHASES__, audio: window.__DEPTH_TOUR_AUDIO_EVENTS__, hashes: window.__DEPTH_TOUR_HASH_EVENTS__ })).catch(() => ({}));
    Object.assign(evidence, observed);
    await mkdir(reviewDirectory, { recursive: true });
    await writeFile(new URL('timing.json', reviewDirectory), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
});

for (const mode of ['reduced', 'static']) test(`${mode}兜底可打开本态解读，visibilitychange暂停读秒且手动继续后恢复`, async ({ page }) => {
  test.setTimeout(45_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page, { mode, readingDuration: 3 });
  await expect(stage(page).locator('.scene-canvas canvas')).toHaveCount(0);
  await stage(page).locator('.state-rail').getByRole('link', { name: '喜', exact: true }).click();
  await expect(page.locator('#depth-joy .project-open')).toBeVisible();
  await tour(page).getByRole('button', { name: '开始自动巡游', exact: true }).click();
  await waitForStation(page, 2);
  await page.locator('#depth-joy .project-open').click();
  const dialog = stage(page).getByRole('dialog', { name: '喜 · 灵动欢喜', exact: true });
  await expect(dialog).toBeVisible();
  await expect(tour(page)).toHaveAttribute('data-phase', 'reading');
  // Exercise the visibility boundary deterministically; playback and timers
  // remain native. This simulates the document event, not a real OS tab switch.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(tour(page)).toHaveAttribute('data-status', 'paused');
  const remaining = await dialog.locator('.gallery-tour-reading').textContent();
  await page.waitForTimeout(3300);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.gallery-tour-reading')).toHaveText(remaining);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(tour(page)).toHaveAttribute('data-status', 'paused');
  await dialog.getByRole('button', { name: '继续巡游', exact: true }).click();
  await expect(tour(page)).toHaveAttribute('data-status', 'running');
  await expect(dialog).toHaveCount(0, { timeout: 6000 });
  await expect(tour(page)).toHaveAttribute('data-station', '3');
  await tour(page).getByRole('button', { name: '退出自动巡游', exact: true }).click();
  expect(new URL(page.url()).hash).toBe('#/state');
  expect(errors).toEqual([]);
});
