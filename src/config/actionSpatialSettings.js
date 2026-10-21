// Persisted UI values remain in human units; engine values are derived below.
export const actionSpatialDefaults = Object.freeze({
  actionUiFadeInMs: 380,
  actionUiFadeOutMs: 320,
  actionUiEdgeZone: 12,
  actionUiInteractionOpacity: 35,
  actionUiHysteresis: 7,
  actionUiOpacity: 100,
  actionUiScale: 100,
});

export const actionSpatialRanges = Object.freeze({
  actionUiFadeInMs: Object.freeze([150, 800, 10]),
  actionUiFadeOutMs: Object.freeze([150, 800, 10]),
  actionUiEdgeZone: Object.freeze([5, 25, 1]),
  actionUiInteractionOpacity: Object.freeze([10, 80, 5]),
  actionUiHysteresis: Object.freeze([3, 15, 0.5]),
  actionUiOpacity: Object.freeze([40, 100, 5]),
  actionUiScale: Object.freeze([75, 125, 5]),
});

export function resolveActionSpatialSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const result = { ...actionSpatialDefaults };
  for (const [name, [min, max, step]] of Object.entries(actionSpatialRanges)) {
    const value = source[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    result[name] = Number((min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step).toFixed(2));
  }
  return result;
}

export function getActionSpatialConfig(settings = {}) {
  const resolved = resolveActionSpatialSettings(settings);
  return {
    fadeInMs: resolved.actionUiFadeInMs,
    fadeOutMs: resolved.actionUiFadeOutMs,
    edgeZone: resolved.actionUiEdgeZone / 100,
    interactionOpacity: resolved.actionUiInteractionOpacity / 100,
    hysteresisDegrees: resolved.actionUiHysteresis,
    opacity: resolved.actionUiOpacity / 100,
    scale: resolved.actionUiScale / 100,
  };
}
