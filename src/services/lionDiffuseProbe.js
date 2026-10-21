import { DataUtils, ShaderChunk, Vector3 } from 'three';

// EEVEE 5.1 evaluates diffuse environment light from L1 spherical harmonics:
// https://github.com/blender/blender/blob/blender-v5.1-release/source/blender/draw/engines/eevee/shaders/eevee_lightprobe_eval_lib.glsl
// Use Three r160's real-SH basis/normalization. Its existing irradiance helper
// accepts nine slots; the five L2 slots deliberately remain zero.
const basisL0 = .282095;
const basisL1 = .488603;
const maximumFloat = 3.4028234663852886e38;
const newCoefficients = () => Array.from({ length: 9 }, () => new Vector3());

function validateCoefficients(coefficients, label = 'SH系数') {
  if (!Array.isArray(coefficients) || coefficients.length !== 9
      || coefficients.some(vector => !vector?.isVector3 || ![vector.x, vector.y, vector.z].every(value => Number.isFinite(value) && Math.abs(value) <= maximumFloat))) {
    throw new TypeError(`${label}必须是9个有限的Vector3`);
  }
}

function validateDegrees(degrees) {
  if (!Number.isFinite(degrees)) throw new TypeError('HDRI旋转角必须是有限数值');
}

/**
 * Limit directional energy without changing the environment's mean radiance.
 * For L1, each channel's directional maximum is its coefficient-vector norm.
 * Bound that maximum against L0, then use one shared RGB factor to retain the
 * directional color ratios. The .05 contrast margin matches EEVEE 5.1.
 * This is an independent mathematical expression of the source energy bound:
 * https://github.com/blender/blender/blob/blender-v5.1-release/source/blender/draw/engines/eevee/shaders/eevee_spherical_harmonics_lib.glsl
 * The source shader is GPL-2.0-or-later; its function body is not copied here.
 */
export function deringLionIrradiance(base, target = newCoefficients()) {
  validateCoefficients(base);
  validateCoefficients(target, '目标SH系数');
  if (new Set(target).size !== 9) throw new TypeError('目标SH系数的9个Vector3必须独立');
  const directionalWeight = .488602512 * (2 / 3) + .05;
  let scale = 1;
  for (const channel of ['x', 'y', 'z']) {
    const average = Math.max(Math.abs(base[0][channel]) * .282094792, 1e-8);
    const directional = Math.max(Math.hypot(base[1][channel], base[2][channel], base[3][channel]) * directionalWeight, 1e-8);
    scale = Math.min(scale, average / directional);
  }
  target[0].copy(base[0]);
  for (let index = 1; index < 4; index += 1) target[index].copy(base[index]).multiplyScalar(scale);
  for (let index = 4; index < 9; index += 1) target[index].set(0, 0, 0);
  return { coefficients: target, scale };
}

/** Rotate a projected L1 panorama around +Y, matching the environment yaw.
 * The optional target retains its vector identities; target === base is safe.
 * Without target, neither the source array nor any source vector is mutated.
 */
export function rotateLionIrradiance(base, degrees = 0, target = newCoefficients()) {
  validateCoefficients(base);
  validateCoefficients(target, '目标SH系数');
  if (new Set(target).size !== 9) throw new TypeError('目标SH系数的9个Vector3必须独立');
  validateDegrees(degrees);
  const radians = (degrees % 360) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  // Read both directional coefficients before writing, for in-place rotation.
  const zx = base[2].x, zy = base[2].y, zz = base[2].z;
  const xx = base[3].x, xy = base[3].y, xz = base[3].z;
  target[0].copy(base[0]);
  target[1].copy(base[1]);
  target[2].set(zx * cosine - xx * sine, zy * cosine - xy * sine, zz * cosine - xz * sine);
  target[3].set(xx * cosine + zx * sine, xy * cosine + zy * sine, xz * cosine + zz * sine);
  for (let index = 4; index < 9; index += 1) target[index].set(0, 0, 0);
  return target;
}

/** Integrate linear RGB(A) Float32 or half-float pixels with exact texel solid
 * angles. Image orientation follows Three's EXR/RGBE flipY convention.
 * Glossy/specular light still uses the untouched PMREM environment.
 */
export function projectLionIrradiance({ data, width, height, flipY = false } = {}, degrees = 0) {
  if ((!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 2 || height < 1 || width !== 2 * height)
      || !Number.isSafeInteger(width * height * 4)) {
    throw new TypeError('HDRI必须有正整数尺寸与2:1经纬度比例');
  }
  if (!(data instanceof Uint16Array) && !(data instanceof Float32Array)) {
    throw new TypeError('HDRI像素必须是Uint16半浮点或Float32线性数据');
  }
  if (typeof flipY !== 'boolean') throw new TypeError('HDRI flipY必须是布尔值');
  const channels = data.length / (width * height);
  if (channels !== 3 && channels !== 4) throw new TypeError('HDRI像素必须是完整的RGB或RGBA');
  validateDegrees(degrees);
  const half = data instanceof Uint16Array;
  const longitudeCosines = new Float64Array(width);
  const longitudeSines = new Float64Array(width);
  const longitudeStep = 2 * Math.PI / width;
  for (let x = 0; x < width; x += 1) {
    const longitude = ((x + .5) / width - .5) * 2 * Math.PI;
    longitudeCosines[x] = Math.cos(longitude);
    longitudeSines[x] = Math.sin(longitude);
  }
  const coefficients = newCoefficients();
  const [constant, vertical, zDirection, xDirection] = coefficients;
  let lowerSine = -1;
  for (let y = 0; y < height; y += 1) {
    const latitude = ((y + .5) / height - .5) * Math.PI;
    const upperSine = Math.sin((y + 1) / height * Math.PI - Math.PI / 2);
    const solidAngle = longitudeStep * (upperSine - lowerSine);
    lowerSine = upperSine;
    const constantFactor = basisL0 * solidAngle;
    const verticalFactor = basisL1 * Math.sin(latitude) * solidAngle;
    const radialFactor = basisL1 * Math.cos(latitude) * solidAngle;
    const rowOffset = (flipY ? height - 1 - y : y) * width * channels;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + x * channels;
      let red = half ? DataUtils.fromHalfFloat(data[offset]) : data[offset];
      let green = half ? DataUtils.fromHalfFloat(data[offset + 1]) : data[offset + 1];
      let blue = half ? DataUtils.fromHalfFloat(data[offset + 2]) : data[offset + 2];
      if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) {
        throw new TypeError('HDRI线性RGB像素必须有限');
      }
      // The bundled DWAB-compressed forest contains small negative ringing.
      // Physical irradiance cannot be negative; clamp only this integration's
      // decoded samples and never alter the source pixels or specular PMREM.
      red = Math.max(0, red);
      green = Math.max(0, green);
      blue = Math.max(0, blue);
      if (channels === 4) {
        const alpha = half ? DataUtils.fromHalfFloat(data[offset + 3]) : data[offset + 3];
        if (!Number.isFinite(alpha) || alpha < 0) throw new TypeError('HDRI Alpha像素必须有限且非负');
      }
      const zFactor = radialFactor * longitudeSines[x];
      const xFactor = radialFactor * longitudeCosines[x];
      constant.x += red * constantFactor;
      constant.y += green * constantFactor;
      constant.z += blue * constantFactor;
      vertical.x += red * verticalFactor;
      vertical.y += green * verticalFactor;
      vertical.z += blue * verticalFactor;
      zDirection.x += red * zFactor;
      zDirection.y += green * zFactor;
      zDirection.z += blue * zFactor;
      xDirection.x += red * xFactor;
      xDirection.y += green * xFactor;
      xDirection.z += blue * xFactor;
    }
  }
  validateCoefficients(coefficients);
  deringLionIrradiance(coefficients, coefficients);
  return degrees % 360 === 0 ? coefficients : rotateLionIrradiance(coefficients, degrees, coefficients);
}

const installations = new WeakMap();
const installationVersions = new WeakMap();
const coefficientIds = new WeakMap();
const originalCallbacks = Symbol('lion-diffuse-original-callbacks');
let nextCoefficientId = 0;
const commonAnchor = '#include <common>';
const mapsAnchor = '#include <lights_fragment_maps>';
const irradianceAnchor = 'getIBLIrradiance( geometryNormal )';
const exactlyOnce = (source, anchor) => source.split(anchor).length === 2;

/** Replace only the diffuse IBL lookup; preserve the material and strand shader. */
export function installLionDiffuseProbe(material, coefficients) {
  validateCoefficients(coefficients);
  const existing = installations.get(material);
  if (existing?.coefficients === coefficients) return existing.remove;
  existing?.remove();
  if (!material?.isMeshStandardMaterial) return () => {};
  const forwarded = material.onBeforeCompile[originalCallbacks];
  const previousCompile = forwarded?.onBeforeCompile ?? material.onBeforeCompile;
  const previousCacheKey = forwarded?.customProgramCacheKey ?? material.customProgramCacheKey;
  const baseKey = previousCacheKey.call(material);
  if (!coefficientIds.has(coefficients)) coefficientIds.set(coefficients, ++nextCoefficientId);
  const version = (installationVersions.get(material) ?? 0) + 1;
  installationVersions.set(material, version);
  // A scene keeps this array and copies values into its vectors. Only an actual
  // replacement binding gets a fresh key, so r160 cannot retain its old pointer.
  const programKey = `${baseKey}|lion-diffuse-l1-v2-${coefficientIds.get(coefficients)}-${version}`;
  const diagnostic = { order: 'L1', applied: false, status: 'pending-compile' };
  material.userData.lionDiffuseProbe = diagnostic;
  const compile = function onBeforeCompile(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    const fragment = shader.fragmentShader;
    const maps = ShaderChunk.lights_fragment_maps;
    const currentDiagnostic = this.userData.lionDiffuseProbe ?? diagnostic;
    if (!exactlyOnce(fragment, commonAnchor) || !exactlyOnce(fragment, mapsAnchor)
        || !fragment.includes('#include <lights_pars_begin>') || !exactlyOnce(maps, irradianceAnchor)) {
      currentDiagnostic.applied = false;
      currentDiagnostic.status = 'unsupported-shader';
      return;
    }
    shader.uniforms.lionDiffuseSH = { value: coefficients };
    shader.fragmentShader = fragment
      .replace(commonAnchor, `${commonAnchor}\nuniform vec3 lionDiffuseSH[9];`)
      .replace(mapsAnchor, maps.replace(irradianceAnchor, 'max(shGetIrradianceAt(inverseTransformDirection(geometryNormal, viewMatrix), lionDiffuseSH), vec3(0.0)) * envMapIntensity'));
    currentDiagnostic.applied = true;
    currentDiagnostic.status = 'compiled';
  };
  compile[originalCallbacks] = { onBeforeCompile: previousCompile, customProgramCacheKey: previousCacheKey };
  const cache = () => programKey;
  material.onBeforeCompile = compile;
  material.customProgramCacheKey = cache;
  material.needsUpdate = true;
  const remove = () => {
    if (material.onBeforeCompile === compile) {
      material.onBeforeCompile = previousCompile;
      if (material.customProgramCacheKey === cache) material.customProgramCacheKey = previousCacheKey;
      if (material.userData.lionDiffuseProbe === diagnostic) delete material.userData.lionDiffuseProbe;
      material.needsUpdate = true;
    }
    if (installations.get(material)?.remove === remove) installations.delete(material);
  };
  installations.set(material, { coefficients, remove });
  return remove;
}
