import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.scripts?.build, 'vite --config vite.config.mjs build', 'React app must expose a Vite build script');
assert.ok(packageJson.dependencies?.react, 'React dependency is required');
assert.ok(packageJson.dependencies?.['react-dom'], 'React DOM dependency is required');
assert.ok(packageJson.devDependencies?.vite, 'Vite dev dependency is required');

const entry = read('site/src/react/main.jsx');
assert.match(entry, /home-lion-loop\.mp4/, 'homepage video must be wired into React');
assert.match(entry, /entry-intro\.mp4/, 'intro video must be wired into React');
assert.match(entry, /title-nanfeng-youshi\.png/, 'title artwork must be wired into React');
assert.match(entry, /onEnded/, 'intro page must expose an ended transition');
assert.match(entry, /lion-overall\.glb/, 'later model route must remain an explicit handoff');

const html = read('site/index.html');
assert.match(html, /(react\/main\.jsx|build-assets\/index-[^"']+\.js)/, 'site index must load the React entry or its Vite build');

console.log('react-entry-framework: 8 assertions passed');
