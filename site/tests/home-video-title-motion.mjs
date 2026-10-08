import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(root, 'site/src/react/main.jsx'), 'utf8');
const css = readFileSync(resolve(root, 'site/src/react/styles.css'), 'utf8');

assert.equal(existsSync(resolve(root, 'site/assets/entry/home-lion-loop.mp4')), true);
assert.match(source, /src=\{media\.home\}/);
assert.match(source, /loop/);
assert.match(source, /TitleMotionLayer/);
assert.match(source, /title-nanfeng-youshi\.png/);
assert.match(source, /pointerX \* 10/);
assert.match(source, /pointerY \* 7/);
assert.match(css, /entry-visual-video/);
assert.match(css, /entry-title-live2d/);
assert.match(css, /translate3d\(var\(--title-shift-x\)/);

console.log('home video/title motion contract: React homepage layers are present');
