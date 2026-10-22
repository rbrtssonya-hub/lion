export const soundControlDefaults = Object.freeze({
  soundControlFontSize: 16,
  soundControlWidth: 180,
  soundWaveWidth: 64,
  soundWaveStrokeWidth: 2,
  soundWavePeakHeight: 10,
  soundWaveTroughDepth: 10,
  soundWavePeriod: 32,
});

export const soundControlRanges = Object.freeze({
  soundControlFontSize: [12, 28, 1],
  soundControlWidth: [140, 300, 1],
  soundWaveWidth: [40, 120, 1],
  soundWaveStrokeWidth: [.5, 6, .5],
  soundWavePeakHeight: [0, 24, 1],
  soundWaveTroughDepth: [0, 24, 1],
  soundWavePeriod: [16, 80, 1],
});
