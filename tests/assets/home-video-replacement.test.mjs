import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { assetPaths } from '../../src/config/assetPaths.js';

const root = resolve(import.meta.dirname, '../..');
const hash = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');

test('the new entry and loop media are the two user-provided originals in the correct order', () => {
  assert.equal(hash(`source/public/${assetPaths.intro}`), 'e6f0ec2828ccc9f8d637d15ab3f648c0d6161a9c6a228bce206761cfd2a4eb4e', 'First video must be the new entry clip');
  assert.equal(hash(`source/public/${assetPaths.home}`), '93353de8e2da20d96e54654dea3735f6cc60c5cbe092cc3fb3dd658cbc0944f9', 'Second video must be the new loop clip');
});

test('the previous runtime videos remain recoverable byte-for-byte outside deployment assets', () => {
  assert.equal(hash('source/video/intro/entry-intro-before-2026-10-19.mp4'), 'ccce0a6ac43996d2521ceb795494351903e758a283b004bd490c0c593fb468cb');
  assert.equal(hash('source/video/entry/home-lion-loop-before-2026-10-19.mp4'), 'b525b4f755fd464997f3792a5b06630c6b7fc09c9f77a5c68e4a0fa86d33ba1c');
});
