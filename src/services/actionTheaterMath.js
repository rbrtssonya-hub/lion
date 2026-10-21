import { resolveViewSettings, viewDefaults } from '../config/viewSettings.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const THEATER_ORBIT = Object.freeze({
  target: Object.freeze([0, 1.45, 0]),
  radiusMin: viewDefaults.actionMinDistance,
  radiusMax: viewDefaults.actionMaxDistance,
  polarMin: viewDefaults.actionMinPolarAngle * DEG,
  polarMax: viewDefaults.actionMaxPolarAngle * DEG,
});

export function shortestAngle(from, to) {
  return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/** Configurable spherical limits. No separate room-height restriction. */
export function constrainOrbit(position, target = THEATER_ORBIT.target, settings = {}) {
  const view = resolveViewSettings(settings);
  const offset = position.map((value, index) => value - target[index]);
  const length = Math.hypot(...offset);
  const radius = Math.max(view.actionMinDistance, Math.min(view.actionMaxDistance, length));
  const azimuth = Math.atan2(offset[0], offset[2]);
  const polar = Math.max(view.actionMinPolarAngle * DEG, Math.min(view.actionMaxPolarAngle * DEG, length ? Math.acos(Math.max(-1, Math.min(1, offset[1] / length))) : Math.PI / 2));
  const y = radius * Math.cos(polar);
  const horizontal = Math.sqrt(Math.max(0, radius * radius - y * y));
  return [target[0] + Math.sin(azimuth) * horizontal, target[1] + y, target[2] + Math.cos(azimuth) * horizontal];
}

/** Keep the current direction across a 12° angular advantage and 180 ms dwell. */
export function chooseScreen({ forward, definitions, activeId, pendingId, pendingSince, now, hysteresis = 12 * DEG, dwell = 180 }) {
  const length = Math.hypot(forward[0], forward[2]);
  if (length < 0.00001) return { activeId, pendingId: null, pendingSince: 0 };
  const angles = definitions.map(({ id, direction }) => {
    const directionLength = Math.hypot(direction[0], direction[2]);
    const dot = (forward[0] * direction[0] + forward[2] * direction[2]) / (length * directionLength);
    return { id, angle: Math.acos(Math.max(-1, Math.min(1, dot))) };
  });
  const current = angles.find(({ id }) => id === activeId);
  const best = angles.reduce((candidate, item) => item.angle < candidate.angle ? item : candidate);
  if (best.id === activeId || (current && current.angle - best.angle < hysteresis)) {
    return { activeId, pendingId: null, pendingSince: 0 };
  }
  if (pendingId !== best.id) return { activeId, pendingId: best.id, pendingSince: now };
  if (now - pendingSince >= dwell) return { activeId: best.id, pendingId: null, pendingSince: 0 };
  return { activeId, pendingId, pendingSince };
}

/** Scale the visible rectangle, preserving the entire source video's aspect. */
export function containedVideoScale(videoWidth, videoHeight, screenAspect = 16 / 9) {
  if (!(videoWidth > 0 && videoHeight > 0)) return [1, 1];
  const videoAspect = videoWidth / videoHeight;
  return videoAspect > screenAspect ? [1, screenAspect / videoAspect] : [videoAspect / screenAspect, 1];
}
