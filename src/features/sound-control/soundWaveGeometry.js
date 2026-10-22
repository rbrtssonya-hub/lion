import { soundControlDefaults } from '../../config/soundControlSettings.js';

export function getSoundControlLayout(settings = {}) {
  const values = { ...soundControlDefaults, ...settings };
  const height = values.soundWavePeakHeight + values.soundWaveTroughDepth + values.soundWaveStrokeWidth + 4;
  // Reserve enough space for both rows when a large wave wraps below the label.
  const buttonHeight = Math.max(values.soundControlFontSize * 3.5, height + values.soundControlFontSize * 1.4 + 8);
  return { height, buttonHeight, controlHeight: buttonHeight + values.soundControlFontSize * 2 };
}

export function createSoundWave(settings = {}) {
  const { soundWaveWidth: width, soundWavePeakHeight: peak, soundWaveTroughDepth: trough,
    soundWaveStrokeWidth: stroke, soundWavePeriod: period } = { ...soundControlDefaults, ...settings };
  const { height } = getSoundControlLayout(settings);
  const baseline = peak + stroke / 2 + 2;
  const totalWidth = width + period * 2;
  const junction = Math.min(peak, trough) * Math.PI / 6;
  const number = value => Number(value.toFixed(5));
  const point = (x, y) => `${number(x)} ${number(y)}`;
  const segments = [`M${point(-period, baseline)}`];
  for (let x = -period; x < totalWidth; x += period) {
    // Four monotonic cubic segments share endpoints and tangents, including
    // the period boundary. Independent peak/trough heights retain a smooth join.
    segments.push(`C${point(x + period / 12, baseline - junction)} ${point(x + period / 6, baseline - peak)} ${point(x + period / 4, baseline - peak)}`);
    segments.push(`C${point(x + period / 3, baseline - peak)} ${point(x + period * 5 / 12, baseline - junction)} ${point(x + period / 2, baseline)}`);
    segments.push(`C${point(x + period * 7 / 12, baseline + junction)} ${point(x + period * 2 / 3, baseline + trough)} ${point(x + period * 3 / 4, baseline + trough)}`);
    segments.push(`C${point(x + period * 5 / 6, baseline + trough)} ${point(x + period * 11 / 12, baseline + junction)} ${point(x + period, baseline)}`);
  }
  return { d: segments.join(' '), baseline, height, width: totalWidth, period, stroke };
}
