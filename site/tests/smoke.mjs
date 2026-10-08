import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const requiredFiles = [
  'site/index.html',
  'site/src/react/main.jsx',
  'site/src/react/styles.css',
  'site/assets/entry/home-lion-loop.mp4',
  'site/assets/entry/title-nanfeng-youshi.png',
  'site/assets/intro/entry-intro.mp4',
  'site/assets/models/lion-overall.glb',
  'data/lion-structure.json',
];

for (const file of requiredFiles) assert.equal(existsSync(resolve(root, file)), true, `Missing required file: ${file}`);

const source = readFileSync(resolve(root, 'site/src/react/main.jsx'), 'utf8');
const css = readFileSync(resolve(root, 'site/src/react/styles.css'), 'utf8');
const html = readFileSync(resolve(root, 'site/index.html'), 'utf8');

assert.match(source, /home-lion-loop\.mp4/);
assert.match(source, /entry-intro\.mp4/);
assert.match(source, /title-nanfeng-youshi\.png/);
assert.match(source, /id="enterWork"/);
assert.match(source, /id="introVideo"/);
assert.match(source, /onEnded/);
assert.match(source, /lion-overall\.glb/);
assert.match(source, /entry-bottom-nav/);
assert.match(source, /入场/);
assert.match(source, /整体/);
assert.match(source, /结构/);
assert.match(source, /动作/);
assert.match(source, /神态/);
assert.match(source, /评分/);
assert.match(css, /entry-title-live2d/);
assert.match(css, /--title-shift-x/);
assert.match(css, /react-intro-stage/);
assert.match(html, /id="root"/);

const structure = JSON.parse(readFileSync(resolve(root, 'data/lion-structure.json'), 'utf8'));
assert.ok(structure.hotspots.length >= 5);
console.log('smoke: React entry, videos, title motion, model handoff, and data are present');
