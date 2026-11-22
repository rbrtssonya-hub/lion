import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

// Run with: node source/design/spread-map-geography/verify.mjs
const moduleUrl = new URL('../../../src/data/spread-map-geography.js', import.meta.url);
assert.equal(await access(moduleUrl).then(() => true, () => false), true, 'regional map module exists');
const { regionalMaps, projectRegionalPoint, guangdongInChinaPaths } = await import(moduleUrl);

function polygonContains(path, [x, y]) {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const points = Array.from({ length: numbers.length / 2 }, (_, i) => numbers.slice(i * 2, i * 2 + 2));
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

for (const [level, code] of [['guangdong', '440000'], ['china', '100000']]) {
  const map = regionalMaps[level];
  const original = JSON.parse(await readFile(new URL(`${code}.datav-areas-v3.json`, import.meta.url), 'utf8'));
  assert.equal(map.paths.length, original.features[0].geometry.coordinates.length, `${level}: retains all source polygons`);
  for (const path of map.paths) {
    assert.match(path, /^M[\d., L-]+Z$/);
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(numbers.every((n, i) => Number.isFinite(n) && n >= 0 && n <= (i % 2 ? 600 : 1000)));
  }
  const projected = [[113.26, 23.13], [113.12, 23.02], [114.17, 22.3]].map(point => projectRegionalPoint(level, point));
  assert.ok(projected.every(point => point.every(Number.isFinite)));
  assert.ok(projected[2][0] > projected[0][0], `${level}: Hong Kong is east of Guangzhou`);
  assert.ok(projected[2][1] > projected[0][1], `${level}: Hong Kong is south of Guangzhou`);
  for (const coordinates of [[113.26, 23.13], [113.12, 23.02]]) {
    assert.ok(map.paths.some(path => polygonContains(path, projectRegionalPoint(level, coordinates))), `${level}: source-backed Lingnan city is on land`);
  }
}

for (const coordinates of [[121, 23.7], [109.7, 19.2]]) {
  const point = projectRegionalPoint('china', coordinates);
  assert.ok(regionalMaps.china.paths.some(path => polygonContains(path, point)), 'Taiwan and Hainan remain visible land polygons');
}
assert.equal(guangdongInChinaPaths.length, regionalMaps.guangdong.paths.length, 'Guangdong highlight retains all source polygons');
assert.ok(guangdongInChinaPaths.some(path => polygonContains(path, projectRegionalPoint('china', [113.26, 23.13]))), 'Guangdong highlight uses the China projection');
const moduleBytes = Buffer.byteLength(await readFile(moduleUrl, 'utf8'));
assert.ok(moduleBytes <= 26000, `regional map module stays compact: ${moduleBytes} bytes`);
console.log(JSON.stringify({ result: 'passed', moduleBytes, polygonCounts: Object.fromEntries(Object.entries(regionalMaps).map(([level, map]) => [level, map.paths.length])), cityPositions: Object.fromEntries(['guangdong', 'china'].map(level => [level, [[113.26, 23.13], [113.12, 23.02], [114.17, 22.3]].map(point => projectRegionalPoint(level, point))])) }, null, 2));
