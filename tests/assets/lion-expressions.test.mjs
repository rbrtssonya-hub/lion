import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { lionExpressions } from '../../src/data/lion-expressions.js';
import { assetPaths } from '../../src/config/assetPaths.js';
import { readLosslessWebp } from './lossless-webp.mjs';

test('each of the eight lion states resolves to distinct transparent artwork', () => {
  assert.deepEqual(lionExpressions.map(state => state.name), ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑']);
  const paths = new Set();
  const hashes = new Set();
  for (const state of lionExpressions) {
    const path = assetPaths[state.imageKey];
    assert.equal(typeof path, 'string', `Missing artwork for ${state.name}`);
    const data = readFileSync(resolve(import.meta.dirname, '../../source/public', path));
    assert.deepEqual(readLosslessWebp(data), { width: 1254, height: 1254, alpha: true }, state.name);
    paths.add(path);
    hashes.add(createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(paths.size, 8, 'State changes must not reuse a single image with CSS poses');
  assert.equal(hashes.size, 8, 'Each state needs its own artwork, not renamed copies');
});

test('eight generated brush glyphs pair archived original PNGs with transparent lossless deployment files', () => {
  const provenance = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../source/design/expression-calligraphy/2026-10-22/prompts.json'), 'utf8'));
  assert.equal(provenance.tool, 'Built-in image_gen.imagegen');
  assert.deepEqual(provenance.assets.map(asset => asset.character), lionExpressions.map(state => state.name));
  const hashes = new Set();
  for (const asset of provenance.assets) {
    const runtimePath = assetPaths[asset.key];
    const runtime = readFileSync(resolve(import.meta.dirname, '../../source/public', runtimePath));
    const original = readFileSync(resolve(import.meta.dirname, '../../', asset.archive));
    assert.equal(runtimePath, asset.runtime.replace('source/public/', '').replace(/\.png$/, '.webp'));
    assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(original[25], 6);
    assert.deepEqual(readLosslessWebp(runtime), { width: original.readUInt32BE(16), height: original.readUInt32BE(20), alpha: true });
    assert.ok(runtime.length < original.length);
    hashes.add(createHash('sha256').update(runtime).digest('hex'));
  }
  assert.equal(hashes.size, 8, 'Each state needs its own generated glyph');
});
