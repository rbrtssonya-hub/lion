import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assetPaths } from '../../src/config/assetPaths.js';

const publicRoot = new URL('../../source/public/', import.meta.url);
const parts = ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'];
const variants = [['16x10', 1.6], ['16x9', 16 / 9], ['reference', 1720 / 914], ['ultrawide', 2560 / 1080]];

function png(path) {
  const bytes = readFileSync(new URL(path, publicRoot));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', path);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.ok(width > 0 && height > 0, `${path}: valid dimensions`);
  return { width, height, hash: createHash('sha256').update(bytes).digest('hex') };
}

test('观形的六套清晰图幅、入口图和文化信息图均独立登记为运行资产', () => {
  const configured = new Set(Object.values(assetPaths));
  const fullHashes = new Set();
  for (const part of parts) {
    for (const [variant, aspect] of variants) {
      const path = `assets/structure-atlas/images/fullscreen/${variant === 'reference' ? '' : `${variant}/`}${part}.png`;
      assert.ok(configured.has(path), `Missing centrally configured artwork: ${path}`);
      const image = png(path);
      assert.ok(image.width >= 1500, `${path}: retain clear authored artwork`);
      assert.ok(Math.abs(image.width / image.height - aspect) <= .04, `${path}: registered image aspect`);
      fullHashes.add(image.hash);
    }
    const navigation = `assets/structure-atlas/images/navigation/${part}.png`;
    assert.ok(configured.has(navigation), `Missing centrally configured entry: ${part}`);
    png(navigation);
  }
  assert.equal(fullHashes.size, 24, 'Each part and screen ratio retains its own authored image');
  const breakdowns = [...configured].filter(path => /^assets\/structure-atlas\/images\/lion-info\/.*\.png$/.test(path));
  assert.equal(breakdowns.length, 6);
  const hashes = new Set(breakdowns.map(path => png(path).hash));
  assert.equal(hashes.size, 6, 'Every cultural plate uses its own artwork');
});
