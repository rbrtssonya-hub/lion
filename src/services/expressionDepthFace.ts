import * as THREE from 'three'
import copiedProfiles from '../features/expression-depth/data/face-profiles.json'
import { media } from '../config/media.js'

export interface FacePart { name: string; origin: string; delay: number; path: string; peak: string; relaxed: string }
export interface FaceProfile {
  parts: FacePart[]
  foreground?: { cx: number; cy: number; r: number }[]
  foregroundPaths?: string[]
  timing?: Partial<{ peak: number; hold: number; relax: number; second: number; secondHold: number }>
}
export interface FaceLayer { texture: THREE.CanvasTexture; left: number; top: number; width: number; height: number }
export interface FaceResources { base: FaceLayer; parts: FaceLayer[]; foreground: FaceLayer; dispose: () => void }
export const faceProfiles = copiedProfiles as Record<string, FaceProfile>
export const FACE_SIZE = 1254
export const FACE_DURATION = 3000

function canvas() {
  const result = document.createElement('canvas')
  result.width = result.height = FACE_SIZE
  return result
}

function mask(profile: FaceProfile, variant: 'windows' | 'soft' | 'foreground', part?: FacePart) {
  const result = canvas()
  const context = result.getContext('2d')!
  context.fillStyle = context.strokeStyle = '#fff'
  if (variant === 'soft' && part) context.filter = 'blur(1.3px)'
  if (variant === 'windows') { context.lineWidth = 8; context.lineJoin = 'round' }
  if (variant === 'foreground') {
    for (const circle of profile.foreground ?? []) {
      context.beginPath(); context.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2); context.fill()
    }
    for (const path of profile.foregroundPaths ?? []) context.fill(new Path2D(path))
  } else {
    for (const piece of part ? [part] : profile.parts) {
      const path = new Path2D(piece.path)
      context.fill(path)
      if (variant === 'windows') context.stroke(path)
    }
  }
  if (variant === 'soft' && !part) {
    // Match the source SVG group filter: compose the complete opaque union
    // first, then blur it once, rather than source-over separate soft edges.
    const softened = canvas()
    const softenedContext = softened.getContext('2d')!
    softenedContext.filter = 'blur(1.3px)'
    softenedContext.drawImage(result, 0, 0)
    return softened
  }
  return result
}

function masked(image: HTMLImageElement, alpha: HTMLCanvasElement, subtract = false) {
  const result = canvas()
  const context = result.getContext('2d')!
  context.drawImage(image, 0, 0)
  context.globalCompositeOperation = subtract ? 'destination-out' : 'destination-in'
  context.drawImage(alpha, 0, 0)
  return result
}

function layer(source: HTMLCanvasElement, crop: boolean): FaceLayer {
  let left = 0, top = 0, width = FACE_SIZE, height = FACE_SIZE
  if (crop) {
    const data = source.getContext('2d')!.getImageData(0, 0, FACE_SIZE, FACE_SIZE).data
    let minX = FACE_SIZE, minY = FACE_SIZE, maxX = -1, maxY = -1
    for (let y = 0; y < FACE_SIZE; y++) for (let x = 0; x < FACE_SIZE; x++) {
      if (data[(y * FACE_SIZE + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    left = Math.max(0, minX - 2); top = Math.max(0, minY - 2)
    width = Math.max(1, Math.min(FACE_SIZE, maxX + 3) - left)
    height = Math.max(1, Math.min(FACE_SIZE, maxY + 3) - top)
  }
  const cropped = document.createElement('canvas')
  cropped.width = width; cropped.height = height
  cropped.getContext('2d')!.drawImage(source, left, top, width, height, 0, 0, width, height)
  const texture = new THREE.CanvasTexture(cropped)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, left, top, width, height }
}

async function decode(url: string) {
  const image = new globalThis.Image()
  image.src = url
  await image.decode()
  if (image.naturalWidth !== FACE_SIZE || image.naturalHeight !== FACE_SIZE) throw new Error('Unexpected facial image coordinates')
  return image
}

export async function loadFaceResources(id: string, originalUrl: string): Promise<FaceResources> {
  const profile = faceProfiles[id]
  const underpaintUrl = media[`expression${id[0].toUpperCase()}${id.slice(1)}Underpaint`]
  const [original, underpaint] = await Promise.all([decode(originalUrl), decode(underpaintUrl)])
  const baseCanvas = masked(underpaint, mask(profile, 'windows'))
  // The underpaint and static photo are merged before upload. Moving regions
  // retain the source's soft 1.3px edge and its 4px underpaint overhang.
  const baseContext = baseCanvas.getContext('2d')!
  baseContext.globalCompositeOperation = 'source-over'
  baseContext.drawImage(masked(original, mask(profile, 'soft'), true), 0, 0)
  const base = layer(baseCanvas, false)
  const parts = profile.parts.map(part => layer(masked(original, mask(profile, 'soft', part)), true))
  const foreground = layer(masked(original, mask(profile, 'foreground')), true)
  return { base, parts, foreground, dispose: () => { [base, ...parts, foreground].forEach(item => item.texture.dispose()) } }
}

export function animateFaceParts(id: string) {
  const profile = faceProfiles[id]
  const timing = { peak: .1, hold: .42, relax: .56, second: .7, secondHold: .8, ...profile.timing }
  // Native WAAPI computes exactly the original transform-list interpolation,
  // keyframe easing and delays; Three only maps that result to world space.
  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  container.dataset.faceDrivers = id
  Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '1px', height: '1px', overflow: 'hidden', opacity: '0', pointerEvents: 'none', contain: 'strict' })
  document.body.append(container)
  const drivers = profile.parts.map(part => {
    const element = document.createElement('div')
    element.style.transformOrigin = part.origin
    container.append(element)
    const animation = element.animate([
      { transform: 'none', offset: 0, easing: 'cubic-bezier(.22,.65,.3,1)' },
      { transform: part.peak, offset: timing.peak },
      { transform: part.peak, offset: timing.hold, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: part.relaxed, offset: timing.relax, easing: 'cubic-bezier(.22,.65,.3,1)' },
      { transform: part.peak, offset: timing.second },
      { transform: part.peak, offset: timing.secondHold, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'none', offset: 1 },
    ], { duration: FACE_DURATION - part.delay, delay: part.delay, fill: 'both' })
    return { element, animation }
  })
  return { drivers, dispose: () => { drivers.forEach(driver => driver.animation.cancel()); container.remove() } }
}

export function pixelMatrixToWorld(matrix: DOMMatrixReadOnly, origin: string, scale: number, target: THREE.Matrix4) {
  const [ox, oy] = origin.split(' ').map(parseFloat)
  const x = (ox - FACE_SIZE / 2) * scale
  const y = (FACE_SIZE / 2 - oy) * scale
  // T(origin) × CSS transform × T(-origin), with image Y inverted.
  return target.set(
    matrix.a, -matrix.c, 0, x - matrix.a * x + matrix.c * y + matrix.e * scale,
    -matrix.b, matrix.d, 0, y + matrix.b * x - matrix.d * y - matrix.f * scale,
    0, 0, 1, 0,
    0, 0, 0, 1,
  )
}
