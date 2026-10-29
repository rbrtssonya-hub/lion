import { clamp, smootherstep, smoothstep } from './motion'

// All photographic planes have fixed world dimensions. Only the camera travels.
export const FOCUS_DISTANCE = 13.5
export const CAMERA_STOPS = [
  { x: 0, y: 0, z: 20 },
  { x: -0.16, y: 0.08, z: 48 }, // Opening pull-back to reveal the distant world.
  { x: 0.12, y: 0, z: -28 },
  { x: -0.12, y: 0.04, z: -64 },
  { x: 0.14, y: -0.04, z: -100 },
  { x: -0.10, y: 0, z: -136 },
  { x: 0.12, y: 0, z: -172 },
  { x: -0.12, y: 0.04, z: -208 },
  { x: 0.14, y: -0.04, z: -244 },
  { x: -0.10, y: 0, z: -280 },
  { x: 0, y: 0.04, z: -318 },
] as const

export function cameraPositionAt(chapter: number) {
  const c = clamp(chapter, 0, CAMERA_STOPS.length - 1)
  const from = Math.min(CAMERA_STOPS.length - 2, Math.floor(c))
  // Keep a reading pause, then use a longer C2-continuous travel window.
  const t = smootherstep((c - from - 0.14) / 0.72)
  const a = CAMERA_STOPS[from]
  const b = CAMERA_STOPS[from + 1]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
}

export function panelState(chapter: number, index: number) {
  const local = chapter - index
  const entering = smoothstep((local + 0.48) / 0.35)
  const leaving = 1 - smoothstep((local - 0.20) / 0.28)
  return {
    opacity: entering * leaving,
    scale: local < 0 ? 0.88 + entering * 0.12 : 1 + (1 - leaving) * 0.075,
    y: local < 0 ? (1 - entering) * 24 : (1 - leaving) * -15,
  }
}
