// One ScrollTrigger samples the document. R3F alone owns camera/mesh transforms.
export const motionState = { chapter: 0, pointerX: 0, pointerY: 0, hovered: false }

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
export const smoothstep = (value: number) => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

// Zero velocity AND acceleration at both ends, including when reversing.
export const smootherstep = (value: number) => {
  const t = clamp(value)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
