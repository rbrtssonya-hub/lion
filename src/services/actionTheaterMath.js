const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const THEATER_ORBIT = Object.freeze({
  target: Object.freeze([0, 1.45, 0]),
  radiusMin: 7.2,
  radiusMax: 8.8,
  heightMin: 1.55,
  heightMax: 3.75,
  polarMin: 74 * DEG,
  polarMax: 89.5 * DEG,
});

export function shortestAngle(from, to) {
  return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/** Jointly satisfy the spherical orbit limits and the room's camera height. */
export function constrainOrbit(position, target = THEATER_ORBIT.target) {
  const offset = position.map((value, index) => value - target[index]);
  const radius = Math.max(THEATER_ORBIT.radiusMin, Math.min(THEATER_ORBIT.radiusMax, Math.hypot(...offset)));
  const azimuth = Math.atan2(offset[0], offset[2]);
  const lowY = Math.max(THEATER_ORBIT.heightMin - target[1], radius * Math.cos(THEATER_ORBIT.polarMax));
  const highY = Math.min(THEATER_ORBIT.heightMax - target[1], radius * Math.cos(THEATER_ORBIT.polarMin));
  const y = Math.max(lowY, Math.min(highY, offset[1]));
  const horizontal = Math.sqrt(Math.max(0, radius * radius - y * y));
  return [target[0] + Math.sin(azimuth) * horizontal, target[1] + y, target[2] + Math.cos(azimuth) * horizontal];
}

/** Angular hysteresis only: a better visible screen wins in this render frame. */
export function chooseScreen({ forward, definitions, activeId, scores, hysteresis = 7 * DEG }) {
  const length = Math.hypot(forward[0], forward[2]);
  if (length < 0.00001) return { activeId, pendingId: null, pendingSince: 0 };
  const angles = scores ?? definitions.map(({ id, direction }) => {
    const directionLength = Math.hypot(direction[0], direction[2]);
    const dot = (forward[0] * direction[0] + forward[2] * direction[2]) / (length * directionLength);
    return { id, angle: Math.acos(Math.max(-1, Math.min(1, dot))) };
  });
  const eligible = item => item.visible !== false && item.frontFacing !== false && Number.isFinite(item.angle);
  const current = angles.find(({ id }) => id === activeId);
  let best = null;
  for (const item of angles) if (eligible(item) && (!best || item.angle < best.angle)) best = item;
  if (!best || best.id === activeId || (current && eligible(current) && current.angle - best.angle < hysteresis)) {
    return { activeId, pendingId: null, pendingSince: 0 };
  }
  return { activeId: best.id, pendingId: null, pendingSince: 0 };
}

/** Scale the visible rectangle, preserving the entire source video's aspect. */
export function containedVideoScale(videoWidth, videoHeight, screenAspect = 16 / 9) {
  if (!(videoWidth > 0 && videoHeight > 0)) return [1, 1];
  const videoAspect = videoWidth / videoHeight;
  return videoAspect > screenAspect ? [1, screenAspect / videoAspect] : [videoAspect / screenAspect, 1];
}
