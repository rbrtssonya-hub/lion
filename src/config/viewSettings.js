// Structure distances follow its fitted overview, so zoom limits remain useful
// at different desktop window sizes. Action distances use scene metres.
export const viewDefaults = Object.freeze({
  structureMinDistanceRatio: 0.55,
  structureMaxDistanceRatio: 2.5,
  structureFov: 34,
  actionMinDistance: 3,
  actionMaxDistance: 14,
  actionMinPolarAngle: 1,
  actionMaxPolarAngle: 179,
  actionFov: 56,
});

export const viewRanges = Object.freeze({
  structureMinDistanceRatio: [0.25, 0.9, 0.05],
  structureMaxDistanceRatio: [1.5, 5, 0.1],
  structureFov: [25, 70, 1],
  actionMinDistance: [1, 8, 0.1],
  actionMaxDistance: [9, 30, 0.5],
  actionMinPolarAngle: [0, 89, 1],
  actionMaxPolarAngle: [91, 180, 1],
  actionFov: [30, 90, 1],
});

export function resolveViewSettings(settings = {}) {
  const resolved = { ...viewDefaults };
  for (const [name, [min, max, step]] of Object.entries(viewRanges)) {
    const value = settings[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    resolved[name] = Number((min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step).toFixed(2));
  }
  return resolved;
}
