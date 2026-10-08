import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(root, 'site/src/react/main.jsx'), 'utf8');

assert.match(source, /\['structure', '03', '结构'\]/);
assert.match(source, /data-model-source=\{media\.model\}/);
assert.match(source, /lion-overall\.glb/);
assert.match(source, /legacy\.html\?chapter=\$\{route\}/);
assert.match(source, /function HandoffPage/);

console.log('structure mode: React keeps the structure route and GLB handoff for the next phase');
