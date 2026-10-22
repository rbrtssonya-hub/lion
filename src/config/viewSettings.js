// Structure distances follow its fitted overview, so zoom limits remain useful
// at different desktop window sizes. Action distances use scene metres.
export const viewDefaults = Object.freeze({
  structureMinDistanceRatio: 0.55,
  structureMaxDistanceRatio: 2.5,
  structureFov: 34,
  actionMinDistance: 3,
  actionMaxDistance: 9,
  actionMinPolarAngle: 1,
  actionMaxPolarAngle: 90,
  actionFov: 56,
});

export const viewRanges = Object.freeze({
  structureMinDistanceRatio: [0.25, 0.9, 0.05],
  structureMaxDistanceRatio: [1.5, 5, 0.1],
  structureFov: [25, 70, 1],
  actionMinDistance: [3, 6, 0.1],
  actionMaxDistance: [3, 9, 0.5],
  actionMinPolarAngle: [0, 20, 1],
  actionMaxPolarAngle: [60, 90, 1],
  actionFov: [30, 90, 1],
});

export function resolveViewSettings(settings = {}, changedName) {
  const resolved = { ...viewDefaults };
  for (const [name, [min, max, step]] of Object.entries(viewRanges)) {
    const value = settings[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    resolved[name] = Number((min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step).toFixed(2));
  }
  // Keep the last edited distance usable. When increasing the near boundary,
  // move the far boundary to its next valid half-metre step. Restored settings
  // use this same near-first rule, so controls, storage and OrbitControls agree.
  if (resolved.actionMinDistance > resolved.actionMaxDistance) {
    if (changedName === 'actionMaxDistance') resolved.actionMinDistance = resolved.actionMaxDistance;
    else {
      const [min, , step] = viewRanges.actionMaxDistance;
      const steps = Math.ceil((resolved.actionMinDistance - min) / step - 1e-9);
      resolved.actionMaxDistance = Number((min + steps * step).toFixed(2));
    }
  }
  return resolved;
}
