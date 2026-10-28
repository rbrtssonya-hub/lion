// Measure real desktop Chromium video presentation; run against a built preview
// server, for example MAP_REVIEW_ORIGIN=http://127.0.0.1:4187 node ...
// MAP_PERF_FPS=24 can be used while the 60 fps asset is not yet available.
// The measurements describe this browser/host only, not a general FPS guarantee.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import os from 'node:os';

const origin = process.env.MAP_REVIEW_ORIGIN || 'http://127.0.0.1:4187';
const output = resolve(process.env.MAP_PERF_OUTPUT || 'tmp/spread-map-performance.json');
const channel = process.env.MAP_PERF_CHANNEL || 'chrome';
const headless = process.env.MAP_PERF_HEADLESS !== 'false';
const frameRates = process.env.MAP_PERF_FPS ? process.env.MAP_PERF_FPS.split(',').map(Number) : [24, 60];
if (!frameRates.length || frameRates.some(rate => rate !== 24 && rate !== 60)) throw new Error('MAP_PERF_FPS must be 24, 60, or 24,60');
const viewport = { width: 1440, height: 900 };
const report = {
  generatedAt: new Date().toISOString(), origin, viewport, channel, headless,
  host: { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() },
  browser: {}, samples: [], errors: [], status: 'running',
};
await mkdir(dirname(output), { recursive: true });
let browser;
try {
  browser = await chromium.launch({ channel, headless });
  report.browser.version = browser.version();
  try {
    const cdp = await browser.newBrowserCDPSession();
    const info = await cdp.send('SystemInfo.getInfo');
    report.browser.gpu = info.gpu;
    await cdp.detach();
  } catch (error) { report.browser.gpuError = error.message; }
  for (const fps of frameRates) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await context.addInitScript(rate => {
      if (window !== top) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ spreadMapFrameRate: rate, spreadMapPlaybackRate: 1 }));
    }, fps);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/#/spread`);
      await page.locator('#spreadStage').waitFor();
      await page.locator('.spread-map-viewport').scrollIntoViewIfNeeded();
      await page.waitForFunction(rate => document.querySelector('.spread-map')?.dataset.mapFrameRate === String(rate), fps);
      const environment = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl');
        const extension = gl?.getExtension('WEBGL_debug_renderer_info');
        return { userAgent: navigator.userAgent, devicePixelRatio: window.devicePixelRatio,
          screen: { width: screen.width, height: screen.height }, visibilityState: document.visibilityState,
          webglVendor: gl ? gl.getParameter(extension ? extension.UNMASKED_VENDOR_WEBGL : gl.VENDOR) : null,
          webglRenderer: gl ? gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : null };
      });
      await page.evaluate(rate => {
        const map = document.querySelector('.spread-map');
        const video = document.querySelector(`.spread-map-video[data-direction="forward"][data-frame-rate="${rate}"]`);
        if (!video || !video.requestVideoFrameCallback || !video.getVideoPlaybackQuality) throw new Error('Video frame measurement APIs unavailable');
        const quality = () => {
          const q = video.getVideoPlaybackQuality();
          return { totalVideoFrames: q.totalVideoFrames, droppedVideoFrames: q.droppedVideoFrames, corruptedVideoFrames: q.corruptedVideoFrames };
        };
        const record = window.__mapPerformance = { fps: rate, source: video.currentSrc || video.src,
          readyStateBeforeClick: video.readyState, bufferedBeforeClick: [...Array(video.buffered.length)].map((_, i) => [video.buffered.start(i), video.buffered.end(i)]),
          qualityBefore: quality(), clickAt: performance.now(), samples: [], sawMotion: false, firstVisibleAt: null, finishedAt: null, failure: null };
        let callbackId;
        const sample = (now, metadata) => {
          if (!video.paused && !record.finishedAt) record.samples.push({ now, mediaTime: metadata.mediaTime,
            expectedDisplayTime: metadata.expectedDisplayTime, presentationTime: metadata.presentationTime,
            presentedFrames: metadata.presentedFrames, processingDuration: metadata.processingDuration });
          if (!record.finishedAt) callbackId = video.requestVideoFrameCallback(sample);
        };
        const observer = new MutationObserver(() => {
          const motion = map.dataset.mapMotion;
          if (video.dataset.visible === 'true' && record.firstVisibleAt === null) record.firstVisibleAt = performance.now();
          if (motion === 'moving') record.sawMotion = true;
          if (motion === 'failed' || (record.sawMotion && motion === 'idle')) {
            record.finishedAt = performance.now();
            record.failure = motion === 'failed' ? 'video playback failed' : null;
            record.qualityAfter = quality();
            record.finalMediaTime = video.currentTime;
            record.finalPaused = video.paused;
            record.videoWidth = video.videoWidth;
            record.videoHeight = video.videoHeight;
            video.cancelVideoFrameCallback(callbackId);
            observer.disconnect();
          }
        });
        observer.observe(map, { attributes: true, attributeFilter: ['data-map-motion'] });
        observer.observe(video, { attributes: true, attributeFilter: ['data-visible'] });
        callbackId = video.requestVideoFrameCallback(sample);
        document.getElementById('spread-level-world').click();
      }, fps);
      await page.waitForFunction(() => window.__mapPerformance?.finishedAt !== null, null, { timeout: 25_000 });
      const raw = await page.evaluate(() => window.__mapPerformance);
      if (raw.failure || !raw.sawMotion || raw.samples.length < 2 || errors.length) throw new Error(JSON.stringify({ failure: raw.failure, sawMotion: raw.sawMotion, samples: raw.samples.length, errors }));
      const intervals = raw.samples.slice(1).map((frame, index) => frame.now - raw.samples[index].now);
      const sorted = [...intervals].sort((a, b) => a - b);
      const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
      const first = raw.samples[0], last = raw.samples.at(-1);
      const threshold = 1500 / fps;
      const longFrames = intervals.filter(interval => interval > threshold);
      const qualityDelta = Object.fromEntries(Object.keys(raw.qualityAfter).map(key => [key, raw.qualityAfter[key] - raw.qualityBefore[key]]));
      report.samples.push({ fps, environment, ...raw,
        summary: { firstFrameCallbackWaitMs: first.now - raw.clickAt,
          firstVisibleAttributeWaitMs: raw.firstVisibleAt === null ? null : raw.firstVisibleAt - raw.clickAt,
          finishedWaitMs: raw.finishedAt - raw.clickAt,
          callbackCount: raw.samples.length, elapsedBetweenCallbacksMs: last.now - first.now,
          callbackRatePerSecond: (raw.samples.length - 1) * 1000 / (last.now - first.now),
          mediaTimeStart: first.mediaTime, mediaTimeEnd: last.mediaTime,
          medianIntervalMs: percentile(0.5), p95IntervalMs: percentile(0.95), maxIntervalMs: sorted.at(-1),
          longFrameThresholdMs: threshold, longFrameCount: longFrames.length, qualityDelta } });
    } catch (error) {
      report.errors.push({ fps, message: error.message, pageErrors: errors,
        partial: await page.evaluate(() => window.__mapPerformance || null).catch(() => null) });
    } finally { await context.close(); }
  }
  report.status = report.errors.length ? 'failed' : 'measured';
} catch (error) {
  report.errors.push({ message: error.message });
  report.status = 'failed';
} finally {
  if (browser) await browser.close();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ output, status: report.status, samples: report.samples.map(({ fps, summary }) => ({ fps, ...summary })), errors: report.errors.map(({ fps, message }) => ({ fps, message })) }, null, 2));
if (report.status !== 'measured') process.exitCode = 1;
