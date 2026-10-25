import {
  Box3,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LineSegments,
  MeshStandardMaterial,
  Sphere,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneHierarchy } from 'three/addons/utils/SkeletonUtils.js';

const modelAssets = new Map();
const hairAssets = new Map();
const abortError = () => new DOMException('醒狮模型载入已取消', 'AbortError');
const sourceWeaveBumpMaterials = new Set(['Lion_Atlas_PBR_Refined', 'Lion_Atlas_PBR_Refined.001']);

function adaptExportedWeaveBump(material) {
  if (!sourceWeaveBumpMaterials.has(material.name) || !material.normalMap) return;
  // Blender's exporter follows this Bump network to its grayscale height mask
  // and incorrectly labels that image as a tangent-space RGB normal map. These
  // two source nodes have Strength=.07 and Distance=.00065 (inspection JSON).
  // Change only the instance's texture interpretation, retaining its image/UVs.
  material.bumpMap = material.normalMap;
  material.normalMap = null;
  material.bumpScale = 0.07000000029802322 * 0.0006500000017695129;
  material.userData.sourceBumpAdapter = {
    strength: 0.07000000029802322,
    distance: 0.0006500000017695129,
    mapping: 'Exported grayscale weave mask interpreted as height, not RGB normal',
  };
  material.needsUpdate = true;
}

async function verifyHash(bytes, expected, name) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '') || !crypto.subtle) throw new Error(`毛发文件缺少可用的完整性校验：${name}`);
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) throw new Error(`毛发文件校验失败：${name}`);
}

function disposeAsset(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach(material => materials.add(material));
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
    material.dispose();
  });
  geometries.forEach(geometry => { geometry.boundsTree = null; geometry.dispose(); });
  textures.forEach(texture => {
    const images = Array.isArray(texture.image) ? texture.image : [texture.image];
    images.forEach(image => image?.close?.());
    texture.dispose();
  });
}

// Geometry, decoded attributes and textures are shared across the two chapter
// instances. Each renderer still owns its WebGL buffers; each instance owns its
// material settings, transforms and scene hierarchy.
async function acquireAsset(cache, key, create, signal, { disposeTextures = true } = {}) {
  if (signal?.aborted) throw abortError();
  let entry = cache.get(key);
  if (!entry) {
    entry = { controller: new AbortController(), users: 0, asset: null };
    cache.set(key, entry);
    entry.promise = Promise.resolve().then(() => create(entry.controller.signal)).then(asset => {
      entry.asset = asset;
      if (!entry.users) dispose(asset);
      return asset;
    }).catch(error => { if (cache.get(key) === entry) cache.delete(key); throw error; });
  }
  entry.users += 1;
  let released = false;
  function dispose(asset) {
    if (disposeTextures) disposeAsset(asset);
    else {
      const geometries = new Set();
      const materials = new Set();
      asset.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    }
  }
  const release = () => {
    if (released) return;
    released = true;
    entry.users -= 1;
    if (!entry.users) {
      if (cache.get(key) === entry) cache.delete(key);
      entry.controller.abort();
      if (entry.asset) dispose(entry.asset);
    }
  };
  let onAbort;
  try {
    const asset = await Promise.race([
      entry.promise,
      new Promise((_, reject) => {
        onAbort = () => reject(abortError());
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      }),
    ]);
    if (signal?.aborted) throw abortError();
    return { asset, release };
  } catch (error) { release(); throw error; }
  finally { signal?.removeEventListener('abort', onAbort); }
}

function cloneInstance(source) {
  const root = cloneHierarchy(source);
  const materials = new Map();
  root.traverse(object => {
    object.userData.sharedLionResources = true;
    if (!object.material) return;
    const copy = original => {
      if (!materials.has(original)) {
        const material = original.clone();
        adaptExportedWeaveBump(material);
        material.onBeforeCompile = original.onBeforeCompile;
        material.customProgramCacheKey = original.customProgramCacheKey;
        materials.set(original, material);
      }
      return materials.get(original);
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  return { root, disposeMaterials: () => materials.forEach(material => material.dispose()) };
}

function installStrandShader(material, pointCount, hasRootUV, interpolation) {
  const pointAttributes = Array.from({ length: pointCount }, (_, index) => `attribute vec4 lionPoint${index};`).join('\n');
  const pointSelection = Array.from({ length: pointCount - 1 }, (_, index) => `if (index < ${index + .5}) return lionPoint${index};`).join('\n');
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
${pointAttributes}
${hasRootUV ? 'attribute vec2 lionRootUV;' : ''}
vec4 lionStrandPoint(float index) {
${pointSelection}
return lionPoint${pointCount - 1};
}
vec4 lionSample(float index) {
${interpolation === 'CATMULL_ROM' ? `
float segment = floor(index);
float t = fract(index);
vec4 p0 = lionStrandPoint(max(0.0, segment - 1.0));
vec4 p1 = lionStrandPoint(segment);
vec4 p2 = lionStrandPoint(min(${(pointCount - 1).toFixed(1)}, segment + 1.0));
vec4 p3 = lionStrandPoint(min(${(pointCount - 1).toFixed(1)}, segment + 2.0));
return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t * t * t);
` : `return mix(lionStrandPoint(floor(index)), lionStrandPoint(ceil(index)), fract(index));`}
}`);
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
vec4 lionCurrent = lionSample(position.x);
vec3 lionPrevious = lionSample(max(0.0, position.x - 0.001)).xyz;
vec3 lionNext = lionSample(min(${(pointCount - 1).toFixed(1)}, position.x + 0.001)).xyz;
vec3 lionCenterView = (modelViewMatrix * vec4(lionCurrent.xyz, 1.0)).xyz;
vec3 lionTangentView = mat3(modelViewMatrix) * (lionNext - lionPrevious);
if (dot(lionTangentView, lionTangentView) < 1e-20) lionTangentView = vec3(0.0, 1.0, 0.0);
lionTangentView = normalize(lionTangentView);
vec3 lionSideView = cross(lionTangentView, normalize(-lionCenterView));
if (dot(lionSideView, lionSideView) < 1e-12) lionSideView = cross(lionTangentView, vec3(1.0, 0.0, 0.0));
if (dot(lionSideView, lionSideView) < 1e-12) lionSideView = vec3(0.0, 0.0, 1.0);
lionSideView = normalize(lionSideView);
vec3 lionNormalView = normalize(cross(lionSideView, lionTangentView));
vec3 objectNormal = vec3(0.0, 0.0, 1.0);
`);
    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = lionNormalView;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
vec3 transformed = lionCurrent.xyz;
`);
    if (hasRootUV) {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#define uv lionRootUV\n#include <uv_vertex>\n#undef uv');
    }
  };
  material.customProgramCacheKey = () => `lion-full-hair-strand-v1-${pointCount}-${hasRootUV ? 'uv' : 'solid'}-${interpolation}`;
}

async function createHairGroup(definition, url, signal, sourceMaterials) {
  const { strands, pointsPerStrand: pointCount, hasRootUV = false } = definition;
  if (!Number.isSafeInteger(strands) || strands < 1 || ![5, 9].includes(pointCount)) throw new Error(`毛发组参数无效：${definition.name}`);
  if (definition.displayMode !== 'STRAND') throw new Error(`毛发源显示模式不支持：${definition.displayMode}`);
  const interpolation = definition.interpolation ?? 'LINEAR';
  if (!['LINEAR', 'CATMULL_ROM'].includes(interpolation)) throw new Error(`毛发插值不支持：${definition.name}`);
  const segmentsPerSourceSegment = definition.segmentsPerSourceSegment ?? 2 ** (definition.subdivisions ?? 0);
  if (!Number.isSafeInteger(segmentsPerSourceSegment) || segmentsPerSourceSegment < 1 || segmentsPerSourceSegment > 64) throw new Error(`毛发细分参数无效：${definition.name}`);
  const authored = definition.material?.useSourceMaterial ? sourceMaterials.get(definition.material.name) : null;
  if (definition.material?.useSourceMaterial && !authored) throw new Error(`毛发源材质不存在：${definition.material.name}`);
  if (!['min', 'max'].every(key => Array.isArray(definition.bounds?.[key]) && definition.bounds[key].length === 3 && definition.bounds[key].every(Number.isFinite))) throw new Error(`毛发包围范围无效：${definition.name}`);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`毛发请求失败：HTTP ${response.status}`);
  const payload = await response.arrayBuffer();
  const expectedBytes = strands * pointCount * 16 + (hasRootUV ? strands * 8 : 0);
  const httpDecoded = (response.headers.get('content-encoding') ?? '').split(',').some(value => ['gzip', 'x-gzip'].includes(value.trim().toLowerCase()));
  if (payload.byteLength !== (httpDecoded ? expectedBytes : definition.bytes)) throw new Error(`毛发文件长度不符：${definition.name}`);
  if (signal.aborted) throw abortError();
  let raw;
  if (httpDecoded) {
    // Fetch has already removed HTTP Content-Encoding. Vite and other servers
    // may serve .gz this way; authenticate the exact restored Float32 bytes.
    await verifyHash(payload, definition.rawSha256, definition.name);
    raw = payload;
  } else {
    await verifyHash(payload, definition.sha256, definition.name);
    raw = await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  if (signal.aborted) throw abortError();
  if (raw.byteLength !== expectedBytes || (definition.rawBytes !== undefined && raw.byteLength !== definition.rawBytes)) throw new Error(`毛发点数据长度不符：${definition.name}`);
  if (!httpDecoded && definition.rawSha256) await verifyHash(raw, definition.rawSha256, definition.name);
  const geometry = new InstancedBufferGeometry();
  const template = [];
  const indices = [];
  const renderedPointCount = (pointCount - 1) * segmentsPerSourceSegment + 1;
  for (let index = 0; index < renderedPointCount; index += 1) {
    const sourceIndex = index / segmentsPerSourceSegment;
    template.push(sourceIndex, 0, 0);
    if (index < renderedPointCount - 1) {
      indices.push(index, index + 1);
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(template, 3));
  geometry.setIndex(indices);
  geometry.instanceCount = strands;
  const points = new InstancedInterleavedBuffer(new Float32Array(raw, 0, strands * pointCount * 4), pointCount * 4, 1);
  for (let index = 0; index < pointCount; index += 1) geometry.setAttribute(`lionPoint${index}`, new InterleavedBufferAttribute(points, 4, index * 4));
  if (hasRootUV) geometry.setAttribute('lionRootUV', new InterleavedBufferAttribute(new InstancedInterleavedBuffer(new Float32Array(raw, strands * pointCount * 16, strands * 2), 2, 1), 2, 0));
  geometry.boundingBox = new Box3(new Vector3(...definition.bounds.min), new Vector3(...definition.bounds.max));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
  const material = authored?.clone() ?? new MeshStandardMaterial({
    color: new Color().setRGB(...(definition.material?.color ?? [.8, .8, .8])),
    roughness: definition.material?.roughness ?? .5,
    metalness: definition.material?.metalness ?? 0,
  });
  adaptExportedWeaveBump(material);
  // The source EEVEE STRAND mode draws one-pixel centerlines. Radius remains in
  // the unmodified Float32 point data; it is intentionally not turned into an
  // enlarged ribbon or tube by this display adapter.
  material.linewidth = 1;
  material.name = `${definition.material?.name || 'Blender_Default'}_FullHair`;
  installStrandShader(material, pointCount, hasRootUV, interpolation);
  const mesh = new LineSegments(geometry, material);
  mesh.name = definition.name;
  mesh.userData.fullHair = true;
  mesh.userData.displayMode = 'STRAND';
  mesh.userData.strands = strands;
  mesh.userData.pointsPerStrand = pointCount;
  mesh.userData.interpolation = interpolation;
  mesh.userData.segmentsPerSourceSegment = segmentsPerSourceSegment;
  mesh.userData.sourceParent = definition.parentName;
  // Interactive exports provide the semantic owner for curves whose Blender
  // parent is an emitter or an empty. Keep each authored strand with its part.
  mesh.userData.sourcePart = definition.partId;
  // The manifest supplies complete evaluated strand bounds. No distance LOD,
  // strand sample, opacity fade, or centerline reduction is applied here.
  mesh.raycast = () => {};
  return mesh;
}

/** Acquire the same complete source mesh and every authored strand in both chapters. */
export async function acquireFullLion({ modelUrl, manifestUrl, resolveAsset, signal, onStatus = () => {}, readModel }) {
  let modelLease;
  let hairLease;
  let modelInstance;
  let hairInstance;
  try {
    modelLease = await acquireAsset(modelAssets, modelUrl, async sharedSignal => {
      const bytes = readModel ? await readModel(sharedSignal) : await fetch(modelUrl, { signal: sharedSignal }).then(response => {
        if (!response.ok) throw new Error(`醒狮请求失败：HTTP ${response.status}`);
        return response.arrayBuffer();
      });
      const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', new URL(modelUrl, window.location.href)).href);
      return gltf.scene;
    }, signal);
    if (signal?.aborted) throw abortError();
    const sourceMaterials = new Map();
    modelLease.asset.traverse(object => (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach(material => sourceMaterials.set(material.name, material)));
    hairLease = await acquireAsset(hairAssets, `${modelUrl}|${manifestUrl}`, async sharedSignal => {
      const response = await fetch(manifestUrl, { signal: sharedSignal });
      if (!response.ok) throw new Error(`完整毛发清单请求失败：HTTP ${response.status}`);
      const manifest = await response.json();
      if (manifest.version !== 1 || manifest.coordinateSystem !== 'GLTF_Y_UP' || !Array.isArray(manifest.groups)) throw new Error('完整毛发清单格式不支持');
      const group = new Group();
      group.name = 'Lion_Authored_FullHair';
      let count = 0;
      try {
        // A bounded queue avoids simultaneous compressed and decompressed copies
        // of all groups, while retaining every group and every strand.
        for (const definition of manifest.groups) {
          onStatus({ phase: 'loading', message: `正在准备完整毛发 ${++count}/${manifest.groups.length}` });
          const url = resolveAsset(definition.assetKey);
          if (!url) throw new Error(`毛发资产未配置：${definition.assetKey}`);
          group.add(await createHairGroup(definition, url, sharedSignal, sourceMaterials));
        }
        group.userData.strands = manifest.groups.reduce((sum, item) => sum + item.strands, 0);
        group.userData.groups = manifest.groups.length;
        group.userData.points = manifest.groups.reduce((sum, item) => sum + item.strands * item.pointsPerStrand, 0);
        return group;
      } catch (error) {
        // Hair materials only borrow the source GLB textures.
        group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
        throw error;
      }
    }, signal, { disposeTextures: false });
    if (signal?.aborted) throw abortError();
    modelInstance = cloneInstance(modelLease.asset);
    hairInstance = cloneInstance(hairLease.asset);
    modelInstance.root.add(hairInstance.root);
    const statistics = {
      strands: hairLease.asset.userData.strands,
      groups: hairLease.asset.userData.groups,
      points: hairLease.asset.userData.points,
      sourceModel: modelUrl,
    };
    const rendered = new WeakMap();
    hairInstance.root.traverse(object => {
      if (!object.userData.fullHair) return;
      object.onBeforeRender = renderer => {
        let observation = rendered.get(renderer);
        if (!observation || observation.frame !== renderer.info.render.frame) {
          observation = { frame: renderer.info.render.frame, ids: new Set(), groups: 0, strands: 0, points: 0 };
          rendered.set(renderer, observation);
        }
        // A reflection pass may draw a group again. Count each submitted group
        // once, using the draw callback instead of walking the scene each frame.
        if (observation.ids.has(object.id)) return;
        observation.ids.add(object.id);
        observation.groups += 1;
        observation.strands += object.userData.strands;
        observation.points += object.userData.strands * object.userData.pointsPerStrand;
      };
    });
    let released = false;
    return {
      root: modelInstance.root,
      statistics,
      getDrawStatistics(renderer) {
        const observation = rendered.get(renderer);
        if (observation?.frame !== renderer.info.render.frame) return { groups: 0, strands: 0, points: 0 };
        return { groups: observation.groups, strands: observation.strands, points: observation.points };
      },
      release() {
        if (released) return;
        released = true;
        modelInstance.root.removeFromParent();
        modelInstance.disposeMaterials();
        hairInstance.disposeMaterials();
        hairLease.release();
        modelLease.release();
      },
    };
  } catch (error) {
    modelInstance?.disposeMaterials();
    hairInstance?.disposeMaterials();
    hairLease?.release();
    modelLease?.release();
    throw error;
  }
}
