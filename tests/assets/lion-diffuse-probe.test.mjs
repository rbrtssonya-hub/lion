import test from 'node:test';
import assert from 'node:assert/strict';
import { DataUtils, MeshPhysicalMaterial, ShaderChunk, ShaderLib, SphericalHarmonics3, Vector3 } from 'three';
import { deringLionIrradiance, installLionDiffuseProbe, projectLionIrradiance, rotateLionIrradiance } from '../../src/services/lionDiffuseProbe.js';

const vectors = () => Array.from({ length: 9 }, () => new Vector3());
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const closeCoefficients = (actual, expected) => actual.forEach((vector, index) => ['x', 'y', 'z'].forEach(channel => close(vector[channel], expected[index][channel])));

function panorama(pixel, { width = 64, height = 32, channels = 3, half = false } = {}) {
  const data = half ? new Uint16Array(width * height * channels) : new Float32Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = pixel(x, y);
      for (let channel = 0; channel < channels; channel += 1) {
        const value = channel === 3 ? 1 : color[channel];
        data[(y * width + x) * channels + channel] = half ? DataUtils.toHalfFloat(value) : value;
      }
    }
  }
  return { data, width, height, flipY: false };
}

test('uniform RGB and RGBA, Float32 and half-float environments give pi irradiance in every direction', () => {
  const color = [1, .5, .25];
  for (const channels of [3, 4]) {
    for (const half of [false, true]) {
      const coefficients = projectLionIrradiance(panorama(() => color, { channels, half }));
      assert.equal(coefficients.length, 9);
      assert.ok(coefficients.slice(4).every(vector => vector.lengthSq() === 0));
      const harmonics = new SphericalHarmonics3().set(coefficients);
      for (const direction of [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(1, 2, 3).normalize()]) {
        const irradiance = harmonics.getIrradianceAt(direction, new Vector3());
        color.forEach((value, channel) => close(irradiance.getComponent(channel), value * Math.PI, 6e-6));
      }
    }
  }
});

test('vertical illumination and flipY reverse the expected hemisphere without changing total energy', () => {
  const source = panorama((_x, y) => y >= 16 ? [2, 1, .5] : [.1, .2, .3]);
  const before = source.data.slice();
  const normal = projectLionIrradiance(source);
  const flipped = projectLionIrradiance({ ...source, flipY: true });
  const irradiance = new SphericalHarmonics3().set(normal);
  assert.ok(irradiance.getIrradianceAt(new Vector3(0, 1, 0), new Vector3()).x > irradiance.getIrradianceAt(new Vector3(0, -1, 0), new Vector3()).x);
  ['x', 'y', 'z'].forEach(channel => {
    close(normal[0][channel], flipped[0][channel]);
    close(normal[1][channel], -flipped[1][channel]);
  });
  const reversed = source.data.slice();
  for (let y = 0; y < source.height; y += 1) {
    reversed.set(source.data.subarray((source.height - 1 - y) * source.width * 3, (source.height - y) * source.width * 3), y * source.width * 3);
  }
  closeCoefficients(flipped, projectLionIrradiance({ ...source, data: reversed }));
  assert.deepEqual(source.data, before);
});

test('Y rotation matches independent per-pixel projection and retains target vector identities', () => {
  const source = panorama((x, y) => [x >= 40 && y >= 18 ? 3 : .1, x / 64, y / 32]);
  const base = projectLionIrradiance(source);
  const original = base.map(vector => vector.clone());
  const direct = degrees => {
    const coefficients = vectors();
    const basis = new Array(9);
    for (let y = 0; y < source.height; y += 1) {
      const latitude = ((y + .5) / source.height - .5) * Math.PI;
      const weight = 2 * Math.PI / source.width * (Math.sin((y + 1) / source.height * Math.PI - Math.PI / 2) - Math.sin(y / source.height * Math.PI - Math.PI / 2));
      for (let x = 0; x < source.width; x += 1) {
        const longitude = ((x + .5) / source.width - .5) * 2 * Math.PI - degrees * Math.PI / 180;
        const direction = new Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
        SphericalHarmonics3.getBasisAt(direction, basis);
        const offset = (y * source.width + x) * 3;
        const color = new Vector3(source.data[offset], source.data[offset + 1], source.data[offset + 2]);
        for (let index = 0; index < 4; index += 1) coefficients[index].addScaledVector(color, basis[index] * weight);
      }
    }
    return deringLionIrradiance(coefficients).coefficients;
  };
  for (const degrees of [90, -90, 180, 33]) {
    const target = vectors();
    const identities = [...target];
    assert.equal(rotateLionIrradiance(base, degrees, target), target);
    assert.ok(target.every((vector, index) => vector === identities[index]));
    closeCoefficients(target, direct(degrees));
    closeCoefficients(projectLionIrradiance(source, degrees), target);
    const inPlace = base.map(vector => vector.clone());
    rotateLionIrradiance(inPlace, degrees, inPlace);
    closeCoefficients(inPlace, target);
  }
  closeCoefficients(base, original);
});

test('a concentrated environment has nonnegative irradiance across the sphere after the EEVEE energy limit', () => {
  const source = panorama((x, y) => x >= 28 && x <= 32 && y >= 20 && y <= 23 ? [10, 4, 1] : [0, 0, 0]);
  const coefficients = projectLionIrradiance(source);
  const harmonics = new SphericalHarmonics3().set(coefficients);
  // This analytic bound proves all directions, including between sampled ones.
  for (const channel of ['x', 'y', 'z']) {
    const mean = .886227 * coefficients[0][channel];
    const amplitude = 2 * .511664 * Math.hypot(coefficients[1][channel], coefficients[2][channel], coefficients[3][channel]);
    assert.ok(mean - amplitude >= 0, `${channel} has a negative irradiance lobe`);
  }
  for (let index = 0; index < 1024; index += 1) {
    const y = 1 - 2 * (index + .5) / 1024;
    const radius = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const irradiance = harmonics.getIrradianceAt(new Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)), new Vector3());
    assert.ok(irradiance.x >= 0 && irradiance.y >= 0 && irradiance.z >= 0);
  }
});

test('deringing uses a common RGB scale, keeps mean energy, and supports in-place vector reuse', () => {
  const base = vectors();
  base[0].set(1, 1, 1);
  base[1].set(2, 4, 1);
  base[2].set(0, 0, 2);
  base[3].set(0, 0, 3);
  const original = base.map(vector => vector.clone());
  const target = vectors();
  const identities = [...target];
  const result = deringLionIrradiance(base, target);
  assert.equal(result.coefficients, target);
  close(result.scale, .282094792 / (4 * (.488602512 * 2 / 3 + .05)));
  assert.ok(result.scale > 0 && result.scale < 1);
  assert.ok(target.every((vector, index) => vector === identities[index]));
  assert.deepEqual(target[0], base[0]);
  for (let index = 1; index < 4; index += 1) {
    for (const channel of ['x', 'y', 'z']) close(target[index][channel], base[index][channel] * result.scale);
  }
  closeCoefficients(base, original);
  const inPlace = base.map(vector => vector.clone());
  deringLionIrradiance(inPlace, inPlace);
  closeCoefficients(inPlace, target);
  closeCoefficients(rotateLionIrradiance(target, 90), deringLionIrradiance(rotateLionIrradiance(base, 90)).coefficients);
});

test('invalid data fail, while finite compression ringing is integrated as nonnegative radiance', () => {
  const source = panorama(() => [1, .5, .25]);
  for (const bad of [
    { ...source, width: 63 }, { ...source, height: 0 }, { ...source, width: 64.5 },
    { ...source, data: new Uint8Array(source.data.length) },
    { ...source, data: new Float32Array(source.width * source.height * 2) },
    { ...source, flipY: 1 },
  ]) assert.throws(() => projectLionIrradiance(bad), TypeError);
  for (const value of [NaN, Infinity, -Infinity]) {
    const invalid = source.data.slice();
    invalid[123] = value;
    assert.throws(() => projectLionIrradiance({ ...source, data: invalid }), /必须有限/);
  }
  const negative = source.data.slice();
  const zero = source.data.slice();
  negative[123] = -.0022;
  zero[123] = 0;
  closeCoefficients(projectLionIrradiance({ ...source, data: negative }), projectLionIrradiance({ ...source, data: zero }));
  assert.ok(negative[123] < 0);
  const invalidHalf = panorama(() => [1, 1, 1], { half: true });
  invalidHalf.data[0] = 0x7e00;
  assert.throws(() => projectLionIrradiance(invalidHalf), /必须有限/);
  assert.throws(() => projectLionIrradiance(source, NaN), /旋转角/);
  assert.throws(() => rotateLionIrradiance(vectors(), Infinity), /旋转角/);
});

test('local diffuse replacement retains strand callbacks, source material, specular IBL, EV and one output conversion', () => {
  const material = new MeshPhysicalMaterial({ color: 0xbb1122, roughness: .88, metalness: 0 });
  const color = material.color.clone();
  const previous = shader => { shader.vertexShader += '\n// authored strand'; };
  const previousKey = () => 'authored-strand';
  material.onBeforeCompile = previous;
  material.customProgramCacheKey = previousKey;
  const coefficients = projectLionIrradiance(panorama(() => [1, .5, .25]));
  const chunkBefore = ShaderChunk.lights_fragment_maps;
  const remove = installLionDiffuseProbe(material, coefficients);
  const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.vertexShader.endsWith('// authored strand'));
  assert.equal(shader.uniforms.lionDiffuseSH.value, coefficients);
  assert.equal(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)?.length, 1);
  assert.equal(shader.fragmentShader.match(/#include <colorspace_fragment>/g)?.length, 1);
  assert.ok(shader.fragmentShader.includes('getIBLRadiance( geometryViewDir, geometryNormal, material.roughness )'));
  assert.ok(shader.fragmentShader.includes('envMapIntensity'));
  assert.equal(ShaderChunk.lights_fragment_maps, chunkBefore);
  assert.ok(material.color.equals(color));
  assert.equal(material.roughness, .88);
  assert.equal(material.metalness, 0);
  coefficients[0].x = 7;
  assert.equal(shader.uniforms.lionDiffuseSH.value[0].x, 7);
  remove();
  assert.equal(material.onBeforeCompile, previous);
  assert.equal(material.customProgramCacheKey, previousKey);
});

test('install is idempotent, replacement pointers cannot reuse stale programs, and unknown shaders remain intact', () => {
  const material = new MeshPhysicalMaterial();
  const first = vectors(), second = vectors();
  const removeFirst = installLionDiffuseProbe(material, first);
  const firstKey = material.customProgramCacheKey();
  assert.equal(installLionDiffuseProbe(material, first), removeFirst);
  assert.equal(material.customProgramCacheKey(), firstKey);
  installLionDiffuseProbe(material, second);
  const secondKey = material.customProgramCacheKey();
  assert.notEqual(secondKey, firstKey);
  removeFirst();
  assert.equal(material.customProgramCacheKey(), secondKey);
  const removeThird = installLionDiffuseProbe(material, first);
  assert.notEqual(material.customProgramCacheKey(), firstKey);
  const unknown = { vertexShader: 'custom vertex', fragmentShader: 'future shader with no known includes', uniforms: {} };
  material.onBeforeCompile(unknown, {});
  assert.equal(unknown.fragmentShader, 'future shader with no known includes');
  assert.deepEqual(unknown.uniforms, {});
  assert.equal(material.userData.lionDiffuseProbe.status, 'unsupported-shader');
  removeThird();
});
