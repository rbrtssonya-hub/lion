import { readFile, writeFile } from 'node:fs/promises';

// Rebuild from the unmodified DataV downloads; no runtime network or dependency.
const moduleUrl = new URL('../../../src/data/spread-map-geography.js', import.meta.url);
const mercatorLatitude = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;
const round = Math.round;

function squaredSegmentDistance(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const fraction = dx || dy ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return (point[0] - start[0] - fraction * dx) ** 2 + (point[1] - start[1] - fraction * dy) ** 2;
}

function simplifyLine(points, tolerance) {
  let split = 0, distance = tolerance * tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const candidate = squaredSegmentDistance(points[i], points[0], points.at(-1));
    if (candidate > distance) { split = i; distance = candidate; }
  }
  return split ? [...simplifyLine(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(split), tolerance)] : [points[0], points.at(-1)];
}

function simplifyRing(points) {
  const ring = points.slice(0, -1);
  let split = 1;
  for (let i = 2; i < ring.length; i++) {
    if (squaredSegmentDistance(ring[i], ring[0], ring[0]) > squaredSegmentDistance(ring[split], ring[0], ring[0])) split = i;
  }
  const simplified = [...simplifyLine(ring.slice(0, split + 1), 1.2).slice(0, -1), ...simplifyLine([...ring.slice(split), ring[0]], 1.2).slice(0, -1)];
  // Subpixel islands still retain their source triangle rather than disappearing.
  if (simplified.length >= 3) return simplified;
  let third = split === 1 ? 2 : 1;
  for (let i = 1; i < ring.length; i++) {
    if (squaredSegmentDistance(ring[i], ring[0], ring[split]) > squaredSegmentDistance(ring[third], ring[0], ring[split])) third = i;
  }
  return [0, split, third].sort((a, b) => a - b).map(index => ring[index]);
}

const maps = {}, transforms = {};
const geometries = {};
for (const [level, code] of [['guangdong', '440000'], ['china', '100000']]) {
  const document = JSON.parse(await readFile(new URL(`${code}.datav-areas-v3.json`, import.meta.url), 'utf8'));
  const polygons = document.features[0].geometry.coordinates;
  geometries[level] = polygons;
  const points = polygons.flat(2);
  const bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  const latitudeBounds = [mercatorLatitude(bounds[1]), mercatorLatitude(bounds[3])];
  const scale = Math.min(856 / (bounds[2] - bounds[0]), 456 / (latitudeBounds[1] - latitudeBounds[0]));
  const offset = [500 - (bounds[0] + bounds[2]) / 2 * scale, 300 + (latitudeBounds[0] + latitudeBounds[1]) / 2 * scale];
  transforms[level] = { scale, offset };
  const project = ([longitude, latitude]) => [longitude * scale + offset[0], -mercatorLatitude(latitude) * scale + offset[1]];
  const paths = polygons.map(polygon => polygon.map(ring => `M${simplifyRing(ring.map(project)).map(point => point.map(round).join(' ')).join('L')}Z`).join(''));
  maps[level] = { paths, bounds, sourceUrl: `https://geo.datav.aliyun.com/areas_v3/bound/${code}.json`, attribution: '轮廓：阿里云 DataV.GeoAtlas / 高德开放平台（2021.5）', usageNote: '仅供学习交流；经简化的案例位置示意，非审定标准地图。' };
}

const chinaTransform = transforms.china;
const guangdongInChinaPaths = geometries.guangdong.map(polygon => polygon.map(ring => `M${simplifyRing(ring.map(([longitude, latitude]) => [longitude * chinaTransform.scale + chinaTransform.offset[0], -mercatorLatitude(latitude) * chinaTransform.scale + chinaTransform.offset[1]])).map(point => point.map(round).join(' ')).join('L')}Z`).join(''));

const lines = [
  '// Generated from the archived DataV areas_v3 GeoJSON; see source/references/spread-map-geography-2026-10-26.md.',
  '// Source permits learning/exchange only; no open-data licence or map approval number was supplied.',
  '// All source polygons, including Taiwan, Hainan and offshore geometry, are retained. ViewBox: 0 0 1000 600.',
  `const regionalTransforms = ${JSON.stringify(transforms)};`,
  'export const regionalMaps = {',
  ...Object.entries(maps).flatMap(([level, map]) => [
    `  ${level}: {`,
    `    bounds: ${JSON.stringify(map.bounds)},`,
    '    paths: [',
    ...map.paths.map(path => `      '${path}',`),
    '    ],',
    `    sourceUrl: '${map.sourceUrl}',`,
    `    attribution: '${map.attribution}',`,
    `    usageNote: '${map.usageNote}',`,
    '  },',
  ]),
  '};',
  '',
  `export const guangdongInChinaPaths = ${JSON.stringify(guangdongInChinaPaths)};`,
  '',
  'export function projectRegionalPoint(level, [longitude, latitude]) {',
  '  const { scale, offset } = regionalTransforms[level];',
  '  const northing = Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;',
  '  return [longitude * scale + offset[0], -northing * scale + offset[1]];',
  '}',
  '',
];
await writeFile(moduleUrl, lines.join('\n'));
console.log(JSON.stringify({ moduleBytes: Buffer.byteLength(lines.join('\n')), polygonCounts: Object.fromEntries(Object.entries(maps).map(([level, map]) => [level, map.paths.length])) }));
