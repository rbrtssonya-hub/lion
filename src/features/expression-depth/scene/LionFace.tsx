import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { motionState } from '../lib/motion'
import { animateFaceParts, FACE_DURATION, FACE_SIZE, faceProfiles, loadFaceResources, pixelMatrixToWorld, type FaceLayer, type FaceResources } from '../../../services/expressionDepthFace'

const inspect = new URLSearchParams(location.search).has('inspect')

export interface FaceSnapshot {
  stateId: string; ready: boolean; failed: boolean; playing: boolean; elapsed: number; playCount: number
  rigVisible: boolean; photoVisible: boolean
  requestToken: number; consumedToken: number; blocked: boolean
  parts: { name: string; matrix: number[]; localMatrix: number[]; rendered: boolean }[]
}

function Layer({ layer, size, order }: { layer: FaceLayer; size: number; order: number }) {
  const k = size / FACE_SIZE
  return <mesh position={[(layer.left + layer.width / 2 - FACE_SIZE / 2) * k, (FACE_SIZE / 2 - layer.top - layer.height / 2) * k, 0]} scale={[layer.width * k, layer.height * k, 1]} renderOrder={order}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial map={layer.texture} transparent depthWrite={false} depthTest toneMapped={false} side={THREE.DoubleSide} />
  </mesh>
}

export function LionFace({ id, primaryId, image, size, parent, photo, blocked, reduced = false, requestToken, onComplete, onUnavailable }: {
  id: string; primaryId: number; image: string; size: number; parent: RefObject<THREE.Group | null>; photo: RefObject<THREE.Mesh | null>; blocked: boolean
  reduced?: boolean; requestToken: number; onComplete?: (primaryId: number) => void; onUnavailable?: (primaryId: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const partGroups = useRef<(THREE.Group | null)[]>([])
  const [resources, setResources] = useState<FaceResources | null>(null)
  const resourceRef = useRef<FaceResources | null>(null)
  const loaded = useRef(false)
  const mounted = useRef(false)
  const failed = useRef(false)
  const consumedToken = useRef(0)
  const activeToken = useRef(0)
  const run = useRef<ReturnType<typeof animateFaceParts> | null>(null)
  const started = useRef(0)
  const elapsed = useRef(0)
  const playCount = useRef(0)
  const profile = faceProfiles[id]
  const preference = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)'), [])
  const partMatrices = useRef(profile.parts.map(part => ({ name: part.name, matrix: [1, 0, 0, 1, 0, 0] })))

  const stop = () => {
    run.current?.dispose(); run.current = null
    if (group.current) group.current.visible = false
    if (photo.current) photo.current.visible = true
    partGroups.current.forEach(part => { if (part) { part.matrix.identity(); part.matrixWorldNeedsUpdate = true } })
    if (inspect) partMatrices.current.forEach(part => { part.matrix = [1, 0, 0, 1, 0, 0] })
  }
  useEffect(() => {
    mounted.current = true
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', hide)
      stop(); resourceRef.current?.dispose()
    }
  }, [])

  useFrame(() => {
    const object = group.current
    if (!object) return
    const near = Math.abs(motionState.chapter - (primaryId + 2)) <= .12
    const suspended = blocked || reduced || document.hidden || preference.matches
    const now = performance.now()
    if (!loaded.current && !suspended && Math.abs(motionState.chapter - (primaryId + 2)) < 1.25) {
      loaded.current = true
      void loadFaceResources(id, image).then(result => {
        if (!mounted.current) { result.dispose(); return }
        resourceRef.current = result
        setResources(result)
      }).catch(() => { failed.current = true })
    }
    if (!near || suspended || requestToken === 0) {
      stop()
      // A canceled request cannot restart after returning to the station.
      consumedToken.current = requestToken
      if (!near) elapsed.current = 0
    } else if (requestToken !== consumedToken.current) {
      if (failed.current) {
        consumedToken.current = requestToken
        onUnavailable?.(primaryId)
      } else if (resources && photo.current) {
        stop()
        run.current = animateFaceParts(id)
        consumedToken.current = requestToken
        activeToken.current = requestToken
        started.current = now
        elapsed.current = 0
        playCount.current++
        object.visible = true
        photo.current.visible = false
      }
    }
    if (run.current) {
      elapsed.current = Math.min(FACE_DURATION, now - started.current)
      if (elapsed.current >= FACE_DURATION) {
        stop()
        if (activeToken.current === requestToken) onComplete?.(primaryId)
      }
      else {
        run.current.drivers.forEach((driver, index) => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(driver.element).transform)
          const part = partGroups.current[index]
          if (part) {
            pixelMatrixToWorld(matrix, profile.parts[index].origin, size / FACE_SIZE, part.matrix)
            part.matrixWorldNeedsUpdate = true
          }
          if (inspect) partMatrices.current[index].matrix = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
        })
        const opacity = parent.current?.userData.opacity ?? 0
        object.traverse(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) child.material.opacity = opacity
        })
      }
    }
    if (inspect) object.userData.face = {
      stateId: id, ready: resources !== null, failed: failed.current, playing: run.current !== null,
      elapsed: elapsed.current, playCount: playCount.current,
      rigVisible: object.visible, photoVisible: photo.current?.visible ?? false,
      requestToken, consumedToken: consumedToken.current, blocked,
      parts: partMatrices.current.map((part, index) => {
        const partGroup = partGroups.current[index]
        const mesh = partGroup?.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | undefined
        const textureImage = mesh?.material.map?.image as HTMLCanvasElement | undefined
        return {
          ...part,
          localMatrix: partGroup?.matrix.toArray() ?? [],
          rendered: Boolean(object.visible && parent.current?.visible && partGroup?.visible && mesh?.visible && mesh.material.opacity > 0 && textureImage && textureImage.width > 0 && textureImage.height > 0),
        }
      }),
    } satisfies FaceSnapshot
  })

  return <group ref={group} name={`face-rig-${primaryId}`} visible={false}>
    {resources && <>
      <Layer layer={resources.base} size={size} order={10} />
      {resources.parts.map((layer, index) => <group key={profile.parts[index].name} ref={object => { partGroups.current[index] = object }} matrixAutoUpdate={false}>
        <Layer layer={layer} size={size} order={11 + index} />
      </group>)}
      <Layer layer={resources.foreground} size={size} order={16} />
    </>}
  </group>
}
