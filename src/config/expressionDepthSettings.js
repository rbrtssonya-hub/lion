import { snapSettingsRange } from '../features/developer-settings/rangeSettings.js';

// Durations use seconds; scales and strengths use percentages; marker size uses pixels.
export const expressionDepthDefaults = Object.freeze({
  expressionTourMoveDuration: 6,
  expressionTourReadingDuration: 12,
  expressionDepthImageScale: 100,
  expressionDepthTextScale: 100,
  expressionDepthMarkerSize: 40,
  expressionDepthPointerStrength: 100,
  expressionDepthWheelSpeed: 100,
});

export const expressionDepthRanges = Object.freeze({
  expressionTourMoveDuration: [2, 20, .5],
  expressionTourReadingDuration: [3, 60, 1],
  expressionDepthImageScale: [70, 130, 5],
  expressionDepthTextScale: [80, 140, 5],
  expressionDepthMarkerSize: [24, 72, 2],
  expressionDepthPointerStrength: [0, 150, 10],
  expressionDepthWheelSpeed: [50, 200, 10],
});

export function resolveExpressionDepthSettings(settings) {
  return Object.fromEntries(Object.entries(expressionDepthDefaults).map(([name, fallback]) => {
    const value = settings?.[name];
    return [name, typeof value === 'number' && Number.isFinite(value)
      ? snapSettingsRange(value, ...expressionDepthRanges[name]) : fallback];
  }));
}
