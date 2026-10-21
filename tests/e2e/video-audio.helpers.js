import { expect } from '@playwright/test';

export async function recordVideoAudio(page) {
  await page.addInitScript(() => {
    const audit = window.videoAudioAudit = { plays: [], overlaps: [], rejections: [] };
    const id = video => video.dataset.actionId || video.id;
    const sample = kind => {
      const audible = [...document.querySelectorAll('video')].filter(video => !video.paused && !video.muted && video.volume > 0).map(id);
      if (audible.length > 1 && audit.overlaps.length < 20) audit.overlaps.push({ kind, audible });
    };
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      audit.plays.push({ id: id(this), volume: this.volume, muted: this.muted });
      const result = nativePlay.call(this);
      result?.catch(error => audit.rejections.push({ id: id(this), name: error.name }));
      sample('play-call');
      return result;
    };
    const muted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
    Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
      ...muted,
      set(value) { muted.set.call(this, value); sample('muted-change'); },
    });
    for (const event of ['play', 'playing', 'pause', 'volumechange']) document.addEventListener(event, () => sample(event), true);
  });
}

export async function expectLowVolumeWithoutOverlap(page) {
  const audit = await page.evaluate(() => window.videoAudioAudit);
  expect(audit.plays.length).toBeGreaterThan(0);
  expect(audit.plays.filter(play => play.volume !== .25)).toEqual([]);
  expect(audit.overlaps).toEqual([]);
}
