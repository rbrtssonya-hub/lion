import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { media } from '../../../config/media.js'

const FOLLOW_DISTANCE = 20
const HIGHLIGHT_HALF_LENGTH_PX = 24
const HIGHLIGHT_POINTS = 33

// Parameter t is not a linear function of Z for a Catmull–Rom curve. Solve the
// monotonic depth coordinate instead, so reversing scroll retraces the same path.
function pointAtDepth(curve: THREE.CatmullRomCurve3, z: number, output: THREE.Vector3) {
  let low = 0
  let high = 1
  for (let i = 0; i < 22; i++) {
    const t = (low + high) / 2
    curve.getPoint(t, output)
    if (output.z > z) low = t
    else high = t
  }
  const t = (low + high) / 2
  curve.getPoint(t, output)
  return t
}

function parameterAtScreenDistance(curve: THREE.CatmullRomCurve3, camera: THREE.Camera, t: number, direction: number,
  center: THREE.Vector3, output: THREE.Vector3, width: number, height: number) {
  const available = direction < 0 ? t : 1 - t
  let low = 0
  let high = Math.min(0.004, available)
  // Bracket a short segment in screen space; its world length naturally varies
  // with the curve tangent and perspective, while the visible accent stays quiet.
  for (let i = 0; i < 5; i++) {
    curve.getPoint(t + direction * high, output).project(camera)
    const distance = Math.hypot((output.x - center.x) * width / 2, (output.y - center.y) * height / 2)
    if (distance >= HIGHLIGHT_HALF_LENGTH_PX || high >= available) break
    high = Math.min(high * 2, available)
  }
  for (let i = 0; i < 14; i++) {
    const middle = (low + high) / 2
    curve.getPoint(t + direction * middle, output).project(camera)
    const distance = Math.hypot((output.x - center.x) * width / 2, (output.y - center.y) * height / 2)
    if (distance < HIGHLIGHT_HALF_LENGTH_PX) low = middle
    else high = middle
  }
  return t + direction * (low + high) / 2
}

export default function SpatialThread({ markerSize = 40 }: { markerSize?: number }) {
  const orb = useRef<THREE.Sprite>(null)
  const [markerTexture, setMarkerTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let active = true
    const texture = new THREE.TextureLoader().load(media.depthRouteMarker, loaded => {
      if (!active) return
      loaded.colorSpace = THREE.SRGBColorSpace
      setMarkerTexture(loaded)
    }, undefined, () => { /* A missing optional marker must not hide the depth scene. */ })
    return () => { active = false; texture.dispose() }
  }, [])
  const aspect = useThree(state => state.size.width / state.size.height)
  const point = useMemo(() => new THREE.Vector3(), [])
  const cameraSpace = useMemo(() => new THREE.Vector3(), [])
  const screenPoint = useMemo(() => new THREE.Vector3(), [])
  const trailPoint = useMemo(() => new THREE.Vector3(), [])
  const highlight = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HIGHLIGHT_POINTS * 3), 3))
    const material = new THREE.LineBasicMaterial({ color: '#9d8b6b', transparent: true, opacity: 0.42, depthTest: true, depthWrite: false, toneMapped: false })
    const line = new THREE.Line(geometry, material)
    line.name = 'journey-orb-route'
    line.renderOrder = 1
    line.frustumCulled = false
    line.raycast = () => {}
    return line
  }, [])
  useEffect(() => () => { highlight.geometry.dispose(); highlight.material.dispose() }, [highlight])
  const curve = useMemo(() => {
    // Responsive world geometry keeps the route inside the viewing corridor at
    // narrow desktop sizes, rather than letting its turns leave the viewport.
    const horizontalScale = aspect / 1.6
    return new THREE.CatmullRomCurve3([
      [-8, -4, 34], [-2, -2.8, 16], [4.8, -2.6, 1],
      [2.4, -2.9, -16], [-4.5, -2.8, -28], [3.8, -2.6, -43],
      [1, -2.9, -58], [-4, -2.7, -79], [1.2, -2.8, -94],
      [4.4, -2.6, -115], [-1.5, -2.9, -130], [-4.4, -2.7, -151],
      [1, -2.8, -166], [5.6, -2.8, -187], [2, -3.4, -210], [-5, -4, -239],
      // Append a second stretch at the same depth spacing; the reference route
      // and its control neighbours around the first four stations stay intact.
      [4.4, -2.6, -259], [-1.5, -2.9, -274], [-4.4, -2.7, -295],
      [1, -2.8, -310], [5.6, -2.8, -331], [2, -3.4, -354], [-5, -4, -383],
    ].map(([x, y, z]) => new THREE.Vector3(x * horizontalScale, y, z)), false, 'catmullrom', 0.45)
  }, [aspect])
  const points = useMemo(() => curve.getPoints(1375), [curve])
  // Run after CameraRig (-2): both the route marker and perspective use the
  // current frame's camera. No clock motion, delayed follower, or second easing.
  useFrame(({ camera, size }) => {
    const marker = orb.current
    if (!marker) return
    const z = camera.position.z - FOLLOW_DISTANCE
    const t = pointAtDepth(curve, z, point)
    marker.position.copy(point)
    cameraSpace.copy(point).applyMatrix4(camera.matrixWorldInverse)
    const depth = -cameraSpace.z
    const worldUnitsPerPixel = 2 * depth / (camera.projectionMatrix.elements[5] * size.height)
    // Sprites have a unit-square plane and always face the camera. Preserve a
    // readable icon size without changing its world position or the curve.
    marker.scale.setScalar(worldUnitsPerPixel * markerSize)
    marker.userData.curveT = t
    marker.userData.pathZ = z
    marker.userData.pathError = Math.abs(point.z - z)
    marker.userData.diameterPx = markerSize

    // Keep the short accent on the same spatial route as the marker. Both use
    // depth testing and draw before the transparent lion artwork.
    screenPoint.copy(point).project(camera)
    const start = parameterAtScreenDistance(curve, camera, t, -1, screenPoint, trailPoint, size.width, size.height)
    const end = parameterAtScreenDistance(curve, camera, t, 1, screenPoint, trailPoint, size.width, size.height)
    const positions = highlight.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < HIGHLIGHT_POINTS; i++) {
      curve.getPoint(start + (end - start) * i / (HIGHLIGHT_POINTS - 1), trailPoint)
      positions.setXYZ(i, trailPoint.x, trailPoint.y, trailPoint.z)
    }
    positions.needsUpdate = true
  }, -1)

  return <group name="spatial-thread">
    <Line points={points} color="#8d8068" transparent opacity={0.13} lineWidth={0.65} depthTest depthWrite={false} renderOrder={0} />
    <Line points={points} color="#a4967b" transparent opacity={0.38} lineWidth={0.85} dashed dashSize={0.38} gapSize={0.3} depthTest depthWrite={false} renderOrder={0} />
    <primitive object={highlight} />
    <sprite ref={orb} name="journey-orb" renderOrder={3} frustumCulled={false} visible={markerTexture !== null} raycast={() => {}}>
      <spriteMaterial map={markerTexture} transparent depthTest depthWrite={false} toneMapped={false} />
    </sprite>
  </group>
}
