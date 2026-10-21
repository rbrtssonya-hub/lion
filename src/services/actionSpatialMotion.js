const clamp01 = value => Math.max(0, Math.min(1, value));
const smoothstep = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

/** Frame-rate independent time to 95% of a new target, with no animation queue. */
export function advancePanelOpacity(current, target, deltaSeconds, fadeInMs, fadeOutMs) {
  const duration = target > current ? fadeInMs : fadeOutMs;
  const blend = -Math.expm1(-3 * Math.max(0, deltaSeconds) * 1000 / Math.max(1, duration));
  return clamp01(current + (target - current) * blend);
}

/** Actual projected edges start fading inside the viewport and finish before exit. */
export function projectedPanelVisibility({ left, right, top, bottom }, edgeZone, facing = 1) {
  const zone = Math.max(.001, edgeZone);
  const axis = (low, high) => {
    const outside = Math.min(zone, Math.max(.001, high - low) * .8);
    const t = smoothstep((Math.min(low, 1 - high) + outside) / (zone + outside));
    return 1 - (1 - t) * (1 - t);
  };
  return Math.min(axis(left, right), axis(top, bottom)) * smoothstep(facing / .18);
}
