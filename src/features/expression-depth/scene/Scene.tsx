import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Image } from '@react-three/drei'
import * as THREE from 'three'
import { projects } from '../data/projects'
import { motionState, smoothstep } from '../lib/motion'
import { CAMERA_STOPS, FOCUS_DISTANCE, cameraPositionAt } from '../lib/journey'
import SpatialThread from './SpatialThread'
import { LionFace, type FaceSnapshot } from './LionFace'
import { resolveExpressionDepthSettings } from '../../../config/expressionDepthSettings.js'
import { expressionFeedbackDefaults, expressionFeedbackRanges } from '../../../config/expressionFeedbackSettings.js'
import { snapSettingsRange } from '../../developer-settings/rangeSettings.js'

const look = new THREE.Vector3()
const inspect = new URLSearchParams(location.search).has('inspect')

interface SceneSnapshot {
  chapter: number
  scrollY: number
  targetCameraZ: number
  camera: { x: number; y: number; z: number }
  orb: { x: number; y: number; radiusPx: number; curveError: number; worldZ: number; distance: number; visible: boolean; type: string; texture: string | null } | null
  primaryCount: number
  visiblePrimaryCount: number
  artworkCount: number
  backplateCount: number
  labelFontsReady: boolean
  faces: FaceSnapshot[]
  markers: { id: number; visible: boolean; opacity: number; worldZ: number }[]
  cards: { id: number; stateId: string; worldX: number; worldY: number; worldZ: number; worldWidth: number; worldHeight: number; artworkWidth: number; artworkHeight: number; distance: number; projectedWidth: number; projectedHeight: number; artworkPlaneBounds: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number }; visible: boolean; opacity: number; imageFailed: boolean }[]
}
declare global { interface Window { __LION_DEPTH_SCENE__?: SceneSnapshot } }

type DepthSettings = Partial<Record<string, number>>

interface ArtworkSettings {
  imageScale: number
  clickScale: number
  clickDuration: number
  reduced: boolean
}

class CardBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  useEffect(() => { onReady?.() }, [onReady])
  return null
}

function RendererLifecycle({ onFailure }: { onFailure: () => void }) {
  const gl = useThree(state => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => { canvas.removeEventListener('webglcontextlost', lost) }
  }, [gl, onFailure])
  return null
}

function useLabelFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let mounted = true
    // One shared load for the world's eight labels and any image fallbacks.
    Promise.all([
      document.fonts.load('400 194px "Nanfeng Depth Brush"', '喜怒哀乐动静惊疑'),
      document.fonts.load('400 40px "Nanfeng Depth Sans"', '0123456789图像暂不可用'),
    ]).then(faces => {
      if (mounted && faces.every(face => face.length > 0)) setReady(true)
    }).catch(() => { /* Keep readable system fallback text if local fonts fail. */ })
    return () => { mounted = false }
  }, [])
  return ready
}

function useStateLabel(title: string, number: string, fontsReady: boolean, failed = false) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')!
    // The canvas stays clear: even the failure state has no rectangular plate.
    context.fillStyle = '#827762'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '400 194px "Nanfeng Depth Brush", "Nanfeng Depth Sans", serif'
    context.fillText(title, 256, 218)
    context.font = '400 40px "Nanfeng Depth Sans", sans-serif'
    context.fillText(number, 256, 370)
    if (failed) {
      context.font = '400 22px "Nanfeng Depth Sans", sans-serif'
      context.fillText('图像暂不可用', 256, 440)
    }
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  // Repaint once the local fonts finish loading, then dispose the old texture.
  }, [title, number, fontsReady, failed])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function ArtworkFallback({ size, primaryId, fontsReady, meshRef, onReady }: { size: number; primaryId: number; fontsReady: boolean; meshRef: RefObject<THREE.Mesh | null>; onReady?: () => void }) {
  const project = projects[primaryId]
  const texture = useStateLabel(project.title, project.number, fontsReady, true)
  return <>
    <mesh ref={meshRef} name={`primary-artwork-${primaryId}`} renderOrder={10} userData={{ imageFailed: true, primaryArtwork: true }}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} depthTest toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
    <ReadySignal onReady={onReady} />
  </>
}

interface CardProps extends ArtworkSettings {
  image: string
  position: [number, number, number]
  size: [number, number]
  rotation?: [number, number, number]
  primaryId: number
  fontsReady: boolean
  blocked: boolean
  requestToken: number
  onFaceComplete?: (primaryId: number) => void
  onFaceUnavailable?: (primaryId: number) => void
  onOpen?: () => void
  onReady?: () => void
}

function Card({ image, position, size, rotation = [0, 0, 0], primaryId, fontsReady, blocked, reduced, imageScale, clickScale, clickDuration, requestToken, onFaceComplete, onFaceUnavailable, onOpen, onReady }: CardProps) {
  const group = useRef<THREE.Group>(null)
  const photo = useRef<THREE.Mesh>(null)
  const hovering = useRef(false)
  const hoverScale = useRef(1)
  const feedbackToken = useRef(0)
  const feedbackStarted = useRef(-Infinity)
  const previousCursor = useRef('')
  const { size: viewportSize, gl } = useThree()
  // This viewing window is measured once at the fixed focus distance, never at
  // the live camera distance. Changing it with Z would cancel real perspective.
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(40) / 2) * FOCUS_DISTANCE
  const viewWidth = viewHeight * viewportSize.width / viewportSize.height
  const x = position[0] * viewWidth
  const y = position[1] * viewHeight
  const width = size[0] * viewWidth
  const height = size[1] * viewHeight
  // Keep the original frame's world dimensions and real perspective, with the
  // square transparent artwork fully contained in its original aperture.
  const artworkSize = Math.min(width, height) * 0.94 * imageScale
  // R3F replaces a changed userData object on React renders. Keep frame-owned
  // opacity intact when narration/tour controls publish a new snapshot.
  const cardData = useMemo(() => ({ worldWidth: width, worldHeight: height, artworkWidth: artworkSize, artworkHeight: artworkSize, opacity: 0 }), [width, height, artworkSize])

  const clearHover = () => {
    if (hovering.current) gl.domElement.style.cursor = previousCursor.current
    hovering.current = false
  }
  useEffect(() => () => {
    if (hovering.current) gl.domElement.style.cursor = previousCursor.current
  }, [gl])

  useFrame(({ camera, clock }, delta) => {
    const object = group.current
    if (!object) return
    const distance = camera.position.z - position[2]
    const near = Math.abs(motionState.chapter - (primaryId + 2)) <= .12
    if (requestToken !== feedbackToken.current) {
      feedbackToken.current = requestToken
      if (requestToken > 0 && near && !blocked && !reduced) feedbackStarted.current = performance.now()
    }
    if (blocked || reduced || !near) feedbackStarted.current = -Infinity
    const nearFade = smoothstep((distance - 0.55) / 2.8)
    const farFade = 1 - smoothstep((distance - 28) / 18)
    // Stations stay 36 units apart. A 46-unit viewing corridor therefore shows
    // one lion at rest, and at most the adjacent pair during a real Z pass.
    const opacity = nearFade * farFade
    object.visible = distance > 0.55 && distance < 46 && opacity > 0.001
    object.userData.opacity = object.visible ? opacity : 0
    const photoMaterial = photo.current?.material
    if (photoMaterial && !Array.isArray(photoMaterial)) {
      photoMaterial.opacity = opacity
      photoMaterial.depthTest = true
      photoMaterial.depthWrite = false
    }
    if (!object.visible) {
      clearHover()
      return
    }
    const damping = 1 - Math.exp(-delta * 8)
    hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, hovering.current && distance < 28 && !reduced ? 1.035 : 1, damping)
    const feedbackProgress = (performance.now() - feedbackStarted.current) / clickDuration
    const feedback = feedbackProgress >= 0 && feedbackProgress < 1 ? Math.sin(feedbackProgress * Math.PI) : 0
    object.scale.setScalar(hoverScale.current * (1 + (clickScale - 1) * feedback))
    object.position.set(x, y + Math.sin(clock.elapsedTime * 0.4 + x) * 0.018, position[2])
    const passing = 1 - smoothstep((distance - 2) / 12)
    object.rotation.x = rotation[0] + passing * 0.035
    object.rotation.y = THREE.MathUtils.lerp(object.rotation.y, rotation[1] + Math.sign(x) * passing * 0.13 + (hovering.current ? motionState.pointerX * 0.035 : 0), damping)
    object.rotation.z = rotation[2] + Math.sin(clock.elapsedTime * 0.2 + x) * 0.003
  }, -0.5)

  return <group ref={group} name={`project-${primaryId}`} userData={cardData} position={[x, y, position[2]]} rotation={rotation}
    onPointerOver={event => {
      if (!onOpen || event.camera.position.z - position[2] > 28) return
      event.stopPropagation()
      if (!hovering.current) previousCursor.current = gl.domElement.style.cursor
      hovering.current = true
      gl.domElement.style.cursor = 'pointer'
    }}
    onPointerOut={clearHover}
    onClick={event => { if (event.camera.position.z - position[2] > 28) return; event.stopPropagation(); onOpen?.() }}>
    <CardBoundary fallback={<ArtworkFallback size={artworkSize} primaryId={primaryId} fontsReady={fontsReady} meshRef={photo} onReady={onReady} />}><Suspense fallback={null}>
      <Image ref={photo} name={`primary-artwork-${primaryId}`} userData={{ primaryArtwork: true }} renderOrder={10} url={image} scale={[artworkSize, artworkSize]} transparent opacity={1} toneMapped={false} side={THREE.DoubleSide} />
      <ReadySignal onReady={onReady} />
    </Suspense></CardBoundary>
    <LionFace id={projects[primaryId].id} primaryId={primaryId} image={image} size={artworkSize} parent={group} photo={photo} blocked={blocked} reduced={reduced} requestToken={requestToken} onComplete={onFaceComplete} onUnavailable={onFaceUnavailable} />
  </group>
}

function StateMarker({ primaryId, position, fontsReady }: { primaryId: number; position: [number, number, number]; fontsReady: boolean }) {
  const marker = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null)
  const project = projects[primaryId]
  const texture = useStateLabel(project.title, project.number, fontsReady)
  const { size } = useThree()
  const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(40) / 2) * FOCUS_DISTANCE
  const viewWidth = viewHeight * size.width / size.height
  useFrame(({ camera }) => {
    if (!marker.current) return
    const distance = camera.position.z - position[2]
    const opacity = smoothstep((distance - 38) / 16) * (1 - smoothstep((distance - 145) / 80)) * 0.52
    marker.current.visible = distance > 38 && distance < 225 && opacity > 0.001
    marker.current.material.opacity = opacity
  })
  return <mesh ref={marker} name={`state-marker-${primaryId}`} position={[position[0] * viewWidth, position[1] * viewHeight, position[2]]} renderOrder={2} raycast={() => {}}>
    <planeGeometry args={[3.1, 3.1]} />
    <meshBasicMaterial map={texture} transparent opacity={0} depthTest depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
  </mesh>
}

function CameraRig({ pointerStrength }: { pointerStrength: number }) {
  const pointer = useRef(new THREE.Vector2())
  useFrame(({ camera }, delta) => {
    const position = cameraPositionAt(motionState.chapter)
    const damping = 1 - Math.exp(-Math.min(delta, 0.05) * 9)
    pointer.current.x = THREE.MathUtils.lerp(pointer.current.x, motionState.pointerX, damping)
    pointer.current.y = THREE.MathUtils.lerp(pointer.current.y, motionState.pointerY, damping)
    // Lenis already smooths the playhead. A second Z chase made the camera
    // lag behind the text and continue forward after a reverse gesture.
    camera.position.set(position.x + pointer.current.x * 0.12 * pointerStrength, position.y + pointer.current.y * 0.075 * pointerStrength, position.z)
    look.set(position.x * 0.2, position.y * 0.2, position.z - 24)
    camera.lookAt(look)
    camera.updateMatrixWorld()
  }, -2)
  return null
}

function DebugProbe({ labelFontsReady }: { labelFontsReady: boolean }) {
  const pointLeft = useMemo(() => new THREE.Vector3(), [])
  const pointRight = useMemo(() => new THREE.Vector3(), [])
  const pointTop = useMemo(() => new THREE.Vector3(), [])
  const pointBottom = useMemo(() => new THREE.Vector3(), [])
  const orbPoint = useMemo(() => new THREE.Vector3(), [])
  const orbCameraSpace = useMemo(() => new THREE.Vector3(), [])
  const artworkCenter = useMemo(() => new THREE.Vector3(), [])
  const artworkCorners = useMemo(() => Array.from({ length: 4 }, () => new THREE.Vector3()), [])
  const last = useRef(-1)
  useFrame(({ camera, scene, size, clock, gl }) => {
    if (!inspect || clock.elapsedTime - last.current < 0.12) return
    last.current = clock.elapsedTime
    const canvasRect = gl.domElement.getBoundingClientRect()
    scene.updateMatrixWorld(true)
    const cards: SceneSnapshot['cards'] = []
    for (let i = 0; i < projects.length; i++) {
      const card = scene.getObjectByName(`project-${i}`)
      if (!card) continue
      const width = card.userData.worldWidth as number
      const height = card.userData.worldHeight as number
      pointLeft.set(-width / 2, 0, 0).applyMatrix4(card.matrixWorld).project(camera)
      pointRight.set(width / 2, 0, 0).applyMatrix4(card.matrixWorld).project(camera)
      pointTop.set(0, height / 2, 0).applyMatrix4(card.matrixWorld).project(camera)
      pointBottom.set(0, -height / 2, 0).applyMatrix4(card.matrixWorld).project(camera)
      const artworkWidth = card.userData.artworkWidth as number
      const artworkHeight = card.userData.artworkHeight as number
      artworkCorners.forEach((point, corner) => {
        point.set((corner & 1 ? 1 : -1) * artworkWidth / 2, (corner & 2 ? 1 : -1) * artworkHeight / 2, 0).applyMatrix4(card.matrixWorld).project(camera)
      })
      artworkCenter.set(0, 0, 0).applyMatrix4(card.matrixWorld).project(camera)
      cards.push({ id: i, stateId: projects[i].id, worldX: card.position.x, worldY: card.position.y, worldZ: card.position.z, worldWidth: width, worldHeight: height,
        artworkWidth, artworkHeight,
        distance: camera.position.z - card.position.z,
        projectedWidth: Math.abs(pointRight.x - pointLeft.x) * size.width / 2,
        projectedHeight: Math.abs(pointTop.y - pointBottom.y) * size.height / 2,
        // Actual square artwork plane, separate from the wider reference frame;
        // these pixel coordinates are useful for clicking its central subject.
        artworkPlaneBounds: {
          left: canvasRect.left + (Math.min(...artworkCorners.map(point => point.x)) + 1) * size.width / 2,
          right: canvasRect.left + (Math.max(...artworkCorners.map(point => point.x)) + 1) * size.width / 2,
          top: canvasRect.top + (1 - Math.max(...artworkCorners.map(point => point.y))) * size.height / 2,
          bottom: canvasRect.top + (1 - Math.min(...artworkCorners.map(point => point.y))) * size.height / 2,
          centerX: canvasRect.left + (artworkCenter.x + 1) * size.width / 2,
          centerY: canvasRect.top + (1 - artworkCenter.y) * size.height / 2,
        },
        visible: card.visible, opacity: card.userData.opacity ?? 0,
        imageFailed: scene.getObjectByName(`primary-artwork-${i}`)?.userData.imageFailed === true,
      })
    }
    const markers: SceneSnapshot['markers'] = projects.flatMap((_, id) => {
      const marker = scene.getObjectByName(`state-marker-${id}`) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | undefined
      return marker ? [{ id, visible: marker.visible, opacity: marker.material.opacity, worldZ: marker.position.z }] : []
    })
    let artworkCount = 0
    let backplateCount = 0
    scene.traverse(object => {
      if (object.userData.primaryArtwork) artworkCount++
      if (object.userData.backplate || /backplate|card-border/.test(object.name)) backplateCount++
    })
    const orb = scene.getObjectByName('journey-orb')
    const projectedOrb = orb ? orb.getWorldPosition(orbPoint).project(camera) : null
    window.__LION_DEPTH_SCENE__ = {
      chapter: motionState.chapter, scrollY: gl.domElement.closest('.expression-depth')?.querySelector('.depth-scroll-viewport')?.scrollTop ?? 0, targetCameraZ: cameraPositionAt(motionState.chapter).z,
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, cards,
      primaryCount: cards.length, visiblePrimaryCount: cards.filter(card => card.visible).length,
      artworkCount, backplateCount, markers, labelFontsReady,
      faces: projects.map((project, id) => scene.getObjectByName(`face-rig-${id}`)?.userData.face ?? { stateId: project.id, ready: false, failed: false, playing: false, elapsed: 0, playCount: 0, parts: [] }),
      orb: orb && projectedOrb ? {
        x: projectedOrb.x, y: projectedOrb.y,
        radiusPx: orb.scale.x * camera.projectionMatrix.elements[5] * size.height / (-orbCameraSpace.copy(orb.position).applyMatrix4(camera.matrixWorldInverse).z * 4),
        type: orb.type, texture: orb instanceof THREE.Sprite ? (orb.material.map?.image as HTMLImageElement | undefined)?.src ?? null : null,
        curveError: orb.userData.pathError, worldZ: orb.position.z,
        distance: camera.position.z - orb.position.z, visible: orb.visible && projectedOrb.z > -1 && projectedOrb.z < 1,
      } : null,
    }
  })
  useEffect(() => () => { delete window.__LION_DEPTH_SCENE__ }, [])
  return null
}

interface FacePlaybackProps {
  playRequest?: { project: number; token: number } | null
  onFaceComplete?: (primaryId: number) => void
  onFaceUnavailable?: (primaryId: number) => void
}

function World({ onOpen, onReady, blocked, playRequest, onFaceComplete, onFaceUnavailable, imageScale, clickScale, clickDuration, reduced, markerSize, pointerStrength }: { onOpen: (index: number, image?: number) => void; onReady: () => void; blocked: boolean; markerSize: number; pointerStrength: number } & FacePlaybackProps & ArtworkSettings) {
  const labelFontsReady = useLabelFontsReady()
  return <>
    <CameraRig pointerStrength={pointerStrength} /><SpatialThread markerSize={markerSize} />
    {projects.map((project, index) => {
      const direction = index % 2 === 0 ? 1 : -1
      const z = CAMERA_STOPS[index + 2].z - FOCUS_DISTANCE
      return <group key={project.id}>
        <Card primaryId={index} fontsReady={labelFontsReady} blocked={blocked} reduced={reduced} imageScale={imageScale} clickScale={clickScale} clickDuration={clickDuration} requestToken={playRequest?.project === index ? playRequest.token : 0} onFaceComplete={onFaceComplete} onFaceUnavailable={onFaceUnavailable} image={project.images[0]} position={[direction * 0.23, 0.02, z]} size={[0.42, 0.47]} rotation={[-0.025, direction * -0.075, direction * 0.007]} onOpen={() => onOpen(index)} onReady={index === 0 ? onReady : undefined} />
        <StateMarker primaryId={index} fontsReady={labelFontsReady} position={[direction * 0.23, 0.02, z]} />
      </group>
    })}
    <DebugProbe labelFontsReady={labelFontsReady} />
  </>
}

export default function Scene({ onOpen, onReady, onFailure, blocked = false, reduced, settings, playRequest, onFaceComplete, onFaceUnavailable }: { chapter: number; onOpen: (index: number, image?: number) => void; reduced: boolean; onReady: () => void; onFailure: () => void; blocked?: boolean; settings?: DepthSettings } & FacePlaybackProps) {
  const depth = resolveExpressionDepthSettings(settings)
  const clickScale = typeof settings?.expressionClickScale === 'number' && Number.isFinite(settings.expressionClickScale)
    ? snapSettingsRange(settings.expressionClickScale, ...expressionFeedbackRanges.expressionClickScale) : expressionFeedbackDefaults.expressionClickScale
  const clickDuration = typeof settings?.expressionClickDuration === 'number' && Number.isFinite(settings.expressionClickDuration)
    ? snapSettingsRange(settings.expressionClickDuration, ...expressionFeedbackRanges.expressionClickDuration) : expressionFeedbackDefaults.expressionClickDuration
  return <div className="scene-canvas" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
    <Canvas camera={{ position: [0, 0, 20], fov: 40, near: 0.12, far: 290 }} dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.setClearColor('#f3eee3', 0) }} fallback={null}>
      <RendererLifecycle onFailure={onFailure} />
      <World onOpen={onOpen} onReady={onReady} blocked={blocked} reduced={reduced} imageScale={depth.expressionDepthImageScale / 100} clickScale={clickScale / 100} clickDuration={clickDuration} markerSize={depth.expressionDepthMarkerSize} pointerStrength={reduced ? 0 : depth.expressionDepthPointerStrength / 100} playRequest={playRequest} onFaceComplete={onFaceComplete} onFaceUnavailable={onFaceUnavailable} />
    </Canvas>
  </div>
}
