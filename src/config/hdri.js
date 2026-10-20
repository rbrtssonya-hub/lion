// Shared controls for both complete-lion views; model/material source data stays intact.
export const hdriDefaults = Object.freeze({
  hdriEnabled: true,
  hdriIntensity: 1,
  hdriRotation: 0,
  hdriExposure: 0,
  hdriLightIntensity: 1,
});

export const hdriRanges = Object.freeze({
  hdriIntensity: [0, 3, 0.05],
  hdriRotation: [-180, 180, 1],
  hdriExposure: [-2, 2, 0.1],
  hdriLightIntensity: [0, 2, 0.05],
});

export function resolveHdriSettings(settings = {}) {
  const result = { ...hdriDefaults };
  if (typeof settings.hdriEnabled === 'boolean') result.hdriEnabled = settings.hdriEnabled;
  for (const [name, [min, max, step]] of Object.entries(hdriRanges)) {
    const value = settings[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    result[name] = Number((min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step).toFixed(2));
  }
  return result;
}
