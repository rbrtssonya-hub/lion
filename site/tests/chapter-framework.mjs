import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(root, 'site/src/react/main.jsx'), 'utf8');
const css = readFileSync(resolve(root, 'site/src/react/styles.css'), 'utf8');

for (const chapter of ['model', 'structure', 'action', 'state', 'score']) {
  assert.match(source, new RegExp(`['"]${chapter}['"]`), `Missing chapter route: ${chapter}`);
}
assert.match(source, /function ChapterNav/);
assert.match(source, /function HandoffPage/);
assert.match(source, /onEnded=\{\(\) => navigate\('model'\)\}/);
assert.match(css, /entry-bottom-nav/);

console.log('chapter framework: React route shells preserve overall, structure, action, state, and score');
