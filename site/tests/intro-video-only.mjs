import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(root, 'site/src/react/main.jsx'), 'utf8');
const css = readFileSync(resolve(root, 'site/src/react/styles.css'), 'utf8');

assert.match(source, /id="introStage"/);
assert.match(source, /id="introVideo"/);
assert.match(source, /entry-intro\.mp4/);
assert.doesNotMatch(source, /intro-shade|skipIntro|videoStatus/);
assert.match(css, /\.react-intro-stage \.intro-video/);
assert.doesNotMatch(css, /intro-shade/);
assert.doesNotMatch(css, /\.intro-video\s*\{\s*filter:/);

console.log('intro video only: React page contains only the entrance video layer');
