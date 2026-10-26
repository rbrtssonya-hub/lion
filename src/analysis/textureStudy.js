import { Color, Matrix4, SRGBColorSpace, Vector2, Vector3 } from 'three';

// CPU image reads are shared by all meshes/materials that use the same image.
// This is an analysis of base color, without lighting, normal maps or occlusion.
const imageReads = new WeakMap();
const MAX_IMAGE_SIZE = 2048;
const clamp = value => Math.min(1, Math.max(0, value));
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const display = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;

async function readImage(image) {
  if (!image || typeof image !== 'object') throw new Error('texture has no readable image');
  if (!imageReads.has(image)) imageReads.set(image, (async () => {
    if (image.decode && !image.complete) await image.decode();
    const width = image.naturalWidth || image.videoWidth || image.width;
    const height = image.naturalHeight || image.videoHeight || image.height;
    if (!(width > 0 && height > 0)) throw new Error('texture image is empty');
    // DataTexture makes the analysis testable without DOM/canvas, too.
    if (image.data) {
      const channels = image.data.length / (width * height);
      if (![3, 4].includes(channels)) throw new Error('unsupported DataTexture channel format');
      const bytes = image.data instanceof Uint8Array || image.data instanceof Uint8ClampedArray;
      const floats = image.data instanceof Float32Array || image.data instanceof Float64Array;
      if (!bytes && !floats) throw new Error('unsupported DataTexture scalar type');
      return { width, height, data: image.data, channels, scale: bytes ? 255 : 1, reduced: false };
    }
    const ratio = Math.min(1, MAX_IMAGE_SIZE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
      : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) throw new Error('no canvas available to read texture');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
    if (!context) throw new Error('2D canvas is unavailable');
    context.drawImage(image, 0, 0, w, h);
    const pixels = context.getImageData(0, 0, w, h);
    return {
      width: w, height: h, data: pixels.data, channels: 4, scale: 255, reduced: ratio < 1,
      url: image.currentSrc || image.src || undefined,
    };
  })());
  return imageReads.get(image);
}

function pixelAt(pixels, uv) {
  // Texture.transformUv already applies matrix, wrapS/wrapT and flipY.
  const x = Math.min(pixels.width - 1, Math.floor(clamp(uv.x) * pixels.width));
  const y = Math.min(pixels.height - 1, Math.floor(clamp(uv.y) * pixels.height));
  const offset = (y * pixels.width + x) * pixels.channels;
  const rgb = [0, 1, 2].map(channel => clamp(pixels.data[offset + channel] / pixels.scale));
  return [...rgb, pixels.channels === 4 ? clamp(pixels.data[offset + 3] / pixels.scale) : 1];
}

function paletteFromBuckets(buckets, limit = 6) {
  const entries = [...buckets.values()].map(item => ({
    rgb: item.sum.map(value => value / item.weight), weight: item.weight,
  })).sort((a, b) => b.weight - a.weight);
  if (!entries.length) return [];
  const distance = (a, b) => a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
  const centers = [entries[0].rgb.slice()];
  while (centers.length < Math.min(limit, entries.length)) {
    let best = null, bestScore = -1;
    for (const entry of entries) {
      const score = Math.min(...centers.map(center => distance(entry.rgb, center))) * Math.sqrt(entry.weight);
      if (score > bestScore) { best = entry; bestScore = score; }
    }
    if (!(bestScore > 0)) break;
    centers.push(best.rgb.slice());
  }
  let groups;
  for (let iteration = 0; iteration < 7; iteration++) {
    groups = centers.map(() => ({ weight: 0, sum: [0, 0, 0] }));
    for (const entry of entries) {
      let selected = 0, nearest = Infinity;
      centers.forEach((center, index) => {
        const d = distance(entry.rgb, center);
        if (d < nearest) { selected = index; nearest = d; }
      });
      const group = groups[selected];
      group.weight += entry.weight;
      entry.rgb.forEach((value, index) => { group.sum[index] += value * entry.weight; });
    }
    groups.forEach((group, index) => {
      if (group.weight) centers[index] = group.sum.map(value => value / group.weight);
    });
  }
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  return groups.filter(group => group.weight > 0).map(group => ({
    color: `#${group.sum.map(value => Math.round(clamp(value / group.weight) * 255)
      .toString(16).padStart(2, '0')).join('')}`,
    share: group.weight / total, weight: group.weight,
  })).sort((a, b) => b.weight - a.weight);
}

/**
 * Base-color/UV study of real Three.js meshes, cached pixel reads, no GPU readback.
 * Returns {uvPoints:[u,v][], uvCount, uvBounds:{min,max,size}, palette:
 * [{color,share,weight}], sampledTriangles, sampledTextures, method, warnings,
 * textureUrl?, sourceTriangles, estimatedSurfaceArea, coverage, approximate}.
 *
 * A systematic sample over rendered triangles uses a deterministic barycentric
 * point per triangle. Weights are WORLD-SPACE triangle area × sampling stride
 * × opacity/alpha. Thus weights estimate visible base-color surface area; they
 * are not screen-pixel shares. No occlusion or shader lighting is included.
 * Texture RGB is decoded from sRGB when texture.colorSpace says sRGB, multiplied
 * by linear material baseColor (and vertex/instance colors), then encoded sRGB.
 * All-untextured models use explicitly labelled baseColor fallback. A texture
 * that cannot be read is EXCLUDED, never silently replaced with a white color.
 * UV bounds/count cover complete primary UV attributes; points are capped at800.
 */
export async function analyzeTextureStudy(meshes, maxSamples = 2500) {
  if (!Number.isInteger(maxSamples) || maxSamples < 1) throw new RangeError('maxSamples must be a positive integer');
  const roots = Array.isArray(meshes) ? meshes : [meshes];
  if (!roots.every(root => root?.traverse)) throw new TypeError('Expected Object3D or Object3D[]');
  const seen = new Set(), objects = [], ranges = [], warnings = new Set();
  let sourceTriangles = 0, uvCount = 0, hasMaps = false;
  roots.forEach(root => root.updateWorldMatrix(true, true));
  for (const root of roots) root.traverse(mesh => {
    if (seen.has(mesh)) return;
    seen.add(mesh);
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
    const geometry = mesh.geometry, count = geometry.index?.count ?? geometry.attributes.position.count;
    // Display variants (wireframe/hover) must never enter a measured palette.
    // Retain source-material references before the first asynchronous image read.
    const sourceMaterial = mesh.userData.atlasOriginal?.material || mesh.material;
    const materials = Array.isArray(sourceMaterial) ? sourceMaterial.slice() : [sourceMaterial];
    const groups = Array.isArray(sourceMaterial) ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    const instances = mesh.isInstancedMesh ? mesh.count : 1;
    if (!instances) return;
    objects.push(mesh);
    uvCount += geometry.attributes.uv?.count || 0;
    for (const group of groups) {
      const material = materials[group.materialIndex];
      if (!material || material.visible === false) continue;
      const start = Math.max(0, group.start, geometry.drawRange.start);
      const end = Math.min(count, group.start + group.count, geometry.drawRange.start + geometry.drawRange.count);
      const triangles = Math.max(0, Math.floor((end - start) / 3));
      if (!triangles) continue;
      ranges.push({ mesh, material, start, triangles, instances, begin: sourceTriangles });
      sourceTriangles += triangles * instances;
      hasMaps ||= !!material.map;
    }
  });
  const uvPoints = [], uvMin = [Infinity, Infinity], uvMax = [-Infinity, -Infinity];
  const uvStride = Math.max(1, uvCount / 800);
  let uvIndex = 0, nextUv = 0;
  for (const mesh of objects) {
    const uv = mesh.geometry.attributes.uv;
    if (!uv) continue;
    for (let index = 0; index < uv.count; index++, uvIndex++) {
      const pair = [uv.getX(index), uv.getY(index)];
      if (!pair.every(Number.isFinite)) continue;
      pair.forEach((value, axis) => { uvMin[axis] = Math.min(uvMin[axis], value); uvMax[axis] = Math.max(uvMax[axis], value); });
      if (uvPoints.length < 800 && uvIndex >= nextUv) { uvPoints.push(pair); nextUv += uvStride; }
    }
  }
  if (!Number.isFinite(uvMin[0])) { uvMin.fill(0); uvMax.fill(0); }

  const texturePixels = new Map();
  await Promise.all([...new Set(ranges.map(range => range.material.map).filter(Boolean))].map(async texture => {
    try {
      if (texture.matrixAutoUpdate) texture.updateMatrix();
      const pixels = await readImage(texture.image);
      texturePixels.set(texture, pixels);
      if (pixels.reduced) warnings.add(`Texture pixel reads were reduced to a maximum edge of ${MAX_IMAGE_SIZE}px.`);
    } catch (error) {
      warnings.add(`Texture ${texture.name || texture.uuid} excluded: ${error.message}.`);
    }
  }));

  const target = Math.min(maxSamples, sourceTriangles), stride = target ? sourceTriangles / target : 1;
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
  const world = new Matrix4(), instanceMatrix = new Matrix4(), uv = new Vector2(), instanceColor = new Color();
  const buckets = new Map(), usedTextures = new Set();
  let sampledTriangles = 0, estimatedSurfaceArea = 0, analyzedArea = 0, texturedArea = 0, rangeIndex = 0;
  for (let sample = 0; sample < target; sample++) {
    const globalTriangle = Math.min(sourceTriangles - 1, Math.floor((sample + .5) * stride));
    while (rangeIndex + 1 < ranges.length && ranges[rangeIndex + 1].begin <= globalTriangle) rangeIndex++;
    const { mesh, material, start, triangles, begin } = ranges[rangeIndex];
    const local = globalTriangle - begin, instance = Math.floor(local / triangles);
    const element = start + (local % triangles) * 3;
    const geometry = mesh.geometry, indices = [0, 1, 2].map(offset => geometry.index ? geometry.index.getX(element + offset) : element + offset);
    world.copy(mesh.matrixWorld);
    if (mesh.isInstancedMesh) { mesh.getMatrixAt(instance, instanceMatrix); world.multiply(instanceMatrix); }
    [a, b, c].forEach((point, index) => { mesh.getVertexPosition(indices[index], point); point.applyMatrix4(world); });
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * .5 * stride;
    if (!(area > 0 && Number.isFinite(area))) continue;
    sampledTriangles++; estimatedSurfaceArea += area;
    // Low-discrepancy barycentrics avoid always reading triangle centroids.
    const r = Math.sqrt(((sample + .5) * .7548776662466927) % 1);
    const q = ((sample + .5) * .5698402909980532) % 1;
    const bary = [1 - r, r * (1 - q), r * q];
    const map = material.map;
    let rgba = [1, 1, 1, 1];
    if (map) {
      const pixels = texturePixels.get(map), attribute = geometry.getAttribute(map.channel ? `uv${map.channel}` : 'uv');
      if (!pixels || !attribute) {
        if (!attribute) warnings.add('Textured triangles without the texture’s UV channel were excluded.');
        continue;
      }
      uv.set(0, 0);
      bary.forEach((weight, index) => {
        uv.x += attribute.getX(indices[index]) * weight;
        uv.y += attribute.getY(indices[index]) * weight;
      });
      if (!Number.isFinite(uv.x) || !Number.isFinite(uv.y)) continue;
      map.transformUv(uv);
      rgba = pixelAt(pixels, uv);
      if (map.colorSpace === SRGBColorSpace) rgba = [...rgba.slice(0, 3).map(linear), rgba[3]];
      usedTextures.add(map); texturedArea += area;
    }
    const color = material.color || { r: 1, g: 1, b: 1 };
    let rgb = rgba.slice(0, 3).map((value, channel) => value * color[['r', 'g', 'b'][channel]]);
    const vertexColors = material.vertexColors && geometry.attributes.color;
    if (vertexColors) rgb = rgb.map((value, channel) => value * bary.reduce((sum, weight, index) =>
      sum + vertexColors.getComponent(indices[index], channel) * weight, 0));
    if (mesh.isInstancedMesh && mesh.instanceColor) {
      mesh.getColorAt(instance, instanceColor);
      rgb = rgb.map((value, channel) => value * instanceColor[['r', 'g', 'b'][channel]]);
    }
    const alpha = rgba[3] * (material.opacity ?? 1);
    if (alpha < material.alphaTest) continue;
    const weight = area * (material.transparent ? alpha : 1);
    if (!(weight > 0)) continue;
    analyzedArea += weight;
    rgb = rgb.map(value => clamp(display(clamp(value))));
    const key = rgb.map(value => Math.min(31, Math.floor(value * 32))).join(',');
    const bucket = buckets.get(key) || { weight: 0, sum: [0, 0, 0] };
    bucket.weight += weight;
    rgb.forEach((value, channel) => { bucket.sum[channel] += value * weight; });
    buckets.set(key, bucket);
  }
  const method = hasMaps
    ? 'Systematic triangle sampling; texture pixels × linear baseColor; world-surface-area weighting; 5-bit RGB buckets + weighted 6-cluster palette.'
    : 'Untextured fallback: material baseColor (including vertex/instance colors), weighted by sampled world-space triangle area.';
  if (!hasMaps) warnings.add('No color maps exist on these meshes; this palette reports material baseColor only.');
  if (sourceTriangles > target) warnings.add(`Surface colors estimate ${sourceTriangles} triangles using ${sampledTriangles} samples.`);
  warnings.add('Base-color study excludes lighting, occlusion, normal/emissive maps and shader effects; nearest texel sampling is used.');
  const textureUrl = [...usedTextures].map(texture => texturePixels.get(texture)?.url).find(Boolean);
  return {
    uvPoints, uvCount, uvBounds: { min: uvMin, max: uvMax, size: uvMax.map((value, axis) => value - uvMin[axis]) },
    palette: paletteFromBuckets(buckets), sampledTriangles, sampledTextures: usedTextures.size,
    sourceTriangles, estimatedSurfaceArea, approximate: sourceTriangles > target,
    coverage: { analyzedArea, texturedArea, estimatedArea: estimatedSurfaceArea, hasMaps },
    method, warnings: [...warnings], ...(textureUrl ? { textureUrl } : {}),
  };
}
