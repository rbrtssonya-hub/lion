import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { lionTypes, inheritors, heritageSources } from '../../src/data/home-heritage.js';
import { assetPaths } from '../../src/config/assetPaths.js';

test('heritage records distinguish merged form, dancing and craft and resolve every cited source', () => {
  assert.deepEqual(lionTypes.map(t=>t.kind), ['传统流派','传统流派','融合形制']);
  assert.equal(inheritors.filter(p=>p.group==='performance').length,4);
  assert.equal(inheritors.filter(p=>p.group==='craft').length,2);
  for(const id of ['zhao-weibin','li-wanzhen']) assert.match(inheritors.find(p=>p.id===id).level,/国家级/);
  for(const p of inheritors.filter(p=>p.group==='craft')) assert.equal(p.project,'彩扎（佛山狮头）');
  assert.equal(new Set([...lionTypes,...inheritors].map(x=>x.id)).size,9);
  assert.equal(new Set(heritageSources.map(x=>x.id)).size,heritageSources.length);
  for(const record of [...lionTypes,...inheritors]) for(const id of record.sourceIds) {
    const source=heritageSources.find(s=>s.id===id); assert.ok(source,`${record.id}:${id}`); assert.match(source.url,/^https:\/\//);
  }
});

test('three independent type illustrations resolve to real landscape assets and archived originals', () => {
  const hashes=[];
  for(const type of lionTypes) {
    const bytes=readFileSync(new URL(`../../source/public/${assetPaths[type.imageKey]}`,import.meta.url));
    assert.equal(bytes.readUInt32BE(16),1536); assert.equal(bytes.readUInt32BE(20),1024);
    assert.deepEqual(bytes,readFileSync(new URL(`../../source/design/home-heritage/2026-10-19/${type.id}.png`,import.meta.url)));
    hashes.push(createHash('sha256').update(bytes).digest('hex'));
    assert.equal(type.points.length,3);
    for(const point of type.points) assert.ok(point.x>0&&point.x<100&&point.y>0&&point.y<100);
  }
  assert.equal(new Set(hashes).size,3);
});
