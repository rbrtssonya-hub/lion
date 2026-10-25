import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { assetPaths } from '../../src/config/assetPaths.js';

const root = resolve(import.meta.dirname, '../..');
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('interactive lion comes from the supplied source and every real mesh has one semantic owner', () => {
  const report = json('source/references/lion-kobi-source-2026-10-26.json');
  const catalog = json('src/data/lion-interactive-parts.json');
  const bytes = readFileSync(resolve(root, 'source/public', assetPaths.model));
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  assert.equal(report.source_sha256, 'cc5f72c3e1a5c330dd64daf6842720a91a8e21b6909a01b6f6200a8834545f53');
  assert.equal(report.source_unchanged, true);
  assert.equal(hash(bytes), report.export.sha256);
  assert.equal(model.meshes.length, 53);
  assert.equal((model.animations ?? []).length, 0, 'Do not invent authored skeletal animation');
  const meshNames = model.nodes.filter(node => Number.isInteger(node.mesh)).map(node => node.name);
  const owners = new Map();
  const ids = new Set();
  for (const part of catalog.parts) {
    assert.ok(part.id && part.name && part.category);
    assert.equal(ids.has(part.id), false, `Duplicate part: ${part.id}`);
    ids.add(part.id);
    assert.ok(part.meshNames.length > 0, `${part.id} must correspond to source meshes`);
    assert.ok(Number.isInteger(part.explodeLevel) && part.explodeLevel >= 0 && part.explodeLevel <= 3);
    assert.equal(part.direction.length, 3);
    assert.ok(part.direction.every(Number.isFinite));
    for (const name of part.meshNames) {
      assert.ok(meshNames.includes(name), `Invented source mesh: ${name}`);
      assert.equal(owners.has(name), false, `${name} cannot move in two parts`);
      owners.set(name, part.id);
    }
  }
  assert.deepEqual([...owners.keys()].sort(), meshNames.sort());
  assert.ok(catalog.sources.some(source => source.url?.startsWith('https://www.ihchina.cn/')));
});

test('new hair preserves every source strand and its hash with an explicit semantic attachment', () => {
  const manifest = json('source/public/' + assetPaths.modelHairKobi);
  const parts = json('src/data/lion-interactive-parts.json').parts;
  const ids = new Set(parts.map(part => part.id));
  assert.equal(manifest.sourceSha256, 'cc5f72c3e1a5c330dd64daf6842720a91a8e21b6909a01b6f6200a8834545f53');
  assert.equal(manifest.groups.length, 33);
  assert.equal(manifest.totalStrands, 2_289_801);
  assert.equal(manifest.totalPoints, 19_929_005);
  for (const group of manifest.groups) {
    assert.ok(ids.has(group.partId), `${group.name}: no real part attachment`);
    const compressed = readFileSync(resolve(root, 'source/public', assetPaths[group.assetKey]));
    assert.equal(hash(compressed), group.sha256);
    const raw = gunzipSync(compressed);
    assert.equal(hash(raw), group.rawSha256);
    assert.equal(raw.byteLength, group.strands * (group.pointsPerStrand * 4 + (group.hasRootUV ? 2 : 0)) * 4);
  }
});
