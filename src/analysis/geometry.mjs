/**
 * Pure geometry statistics. Coordinates have the same units as the source model.
 * Only finite points are used. No values here imply a physical unit such as mm.
 * Hulls and profiles are projections / vertex-sampling estimates, not mesh cuts.
 */
const PLANES = { xy: [0, 1], xz: [0, 2], yz: [1, 2] };
const AXES = { x: 0, y: 1, z: 2 };
const TAU = Math.PI * 2;

function finitePoints(points, dimensions = 3) {
  return Array.from(points ?? []).filter(p => p && p.length >= dimensions
    && Array.from(p).slice(0, dimensions).every(Number.isFinite));
}

function planeAxes(plane) {
  if (!PLANES[plane]) throw new RangeError(`Unknown projection plane: ${plane}`);
  return PLANES[plane];
}

function binCount(bins) {
  if (!Number.isInteger(bins) || bins < 1 || bins > 4096) {
    throw new RangeError('bins must be an integer from 1 to 4096');
  }
  return bins;
}

/** Return { min:[x,y,z], max, size, center, count, diagonal }. Empty input => zeros. */
export function measureBounds(points) {
  const valid = finitePoints(points);
  const min = valid.length ? [Infinity, Infinity, Infinity] : [0, 0, 0];
  const max = valid.length ? [-Infinity, -Infinity, -Infinity] : [0, 0, 0];
  for (const point of valid) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  const size = max.map((value, axis) => value - min[axis]);
  return {
    min, max, size,
    center: max.map((value, axis) => (value + min[axis]) / 2),
    count: valid.length,
    diagonal: Math.hypot(...size),
  };
}

/** Monotone-chain 2D convex hull. CCW points, no duplicated closing vertex.
 * Duplicate and interior collinear points are removed. A line returns its ends.
 */
export function convexHull(points) {
  const sorted = finitePoints(points, 2).map(p => [p[0], p[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((p, i) => !i || p[0] !== sorted[i - 1][0]
    || p[1] !== sorted[i - 1][1]);
  if (unique.length < 3) return unique;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1])
    - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [];
  for (const point of unique) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = unique.length - 1; index >= 0; index--) {
    const point = unique[index];
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Orthographic convex envelope on xy / xz / yz. It is NOT a surface silhouette
 * with holes or concavities, and is NOT an intersection with a plane.
 */
export function projectedHull(points, plane = 'xy') {
  const [u, v] = planeAxes(plane);
  return convexHull(finitePoints(points).map(p => [p[u], p[v]]));
}

/** Radial bins about the projected bounds center.
 * samples:[{angle (bin center, radians), radius (max), meanRadius, count,
 * point:[u,v] (maximum-radius measured point or null)}].
 * Empty bins have radius/meanRadius=0 and point=null; do not silently interpolate.
 */
export function radialProfile(points, bins = 48, plane = 'xy') {
  binCount(bins);
  const [u, v] = planeAxes(plane);
  const valid = finitePoints(points);
  const bounds = measureBounds(valid);
  const center = [bounds.center[u], bounds.center[v]];
  const samples = Array.from({ length: bins }, (_, index) => ({
    angle: ((index + .5) / bins) * TAU,
    radius: 0, meanRadius: 0, count: 0, point: null,
  }));
  let maxRadius = 0;
  for (const point of valid) {
    const du = point[u] - center[0], dv = point[v] - center[1];
    const radius = Math.hypot(du, dv);
    const angle = (Math.atan2(dv, du) + TAU) % TAU;
    const sample = samples[Math.min(bins - 1, Math.floor(angle / TAU * bins))];
    sample.count++;
    sample.meanRadius += radius;
    if (sample.point === null || radius > sample.radius) {
      sample.radius = radius;
      sample.point = [point[u], point[v]];
    }
    maxRadius = Math.max(maxRadius, radius);
  }
  samples.forEach(sample => { if (sample.count) sample.meanRadius /= sample.count; });
  return { plane, center, maxRadius, samples };
}

/** Bin sampled vertices along one axis; report cross-axis bounding extents.
 * crossAxes names the axes measured by width/depth. center is the arithmetic
 * centroid of sampled vertices, NOT a volume centroid. Empty bins use null
 * width/depth/center. This is a slab/vertex profile, not an exact mesh section.
 */
export function sliceProfile(points, axis = 'y', bins = 24) {
  binCount(bins);
  if (!(axis in AXES)) throw new RangeError(`Unknown profile axis: ${axis}`);
  const along = AXES[axis];
  const across = [0, 1, 2].filter(index => index !== along);
  const valid = finitePoints(points);
  const bounds = measureBounds(valid);
  const min = bounds.min[along], max = bounds.max[along], span = max - min;
  const samples = Array.from({ length: bins }, (_, index) => ({
    position: min + span * ((index + .5) / bins),
    width: null, depth: null, center: null, count: 0,
  }));
  const accumulators = samples.map(() => ({
    min: [Infinity, Infinity], max: [-Infinity, -Infinity], sum: [0, 0, 0],
  }));
  for (const point of valid) {
    const index = span ? Math.min(bins - 1, Math.floor((point[along] - min) / span * bins)) : 0;
    const sample = samples[index], accumulator = accumulators[index];
    sample.count++;
    across.forEach((component, i) => {
      accumulator.min[i] = Math.min(accumulator.min[i], point[component]);
      accumulator.max[i] = Math.max(accumulator.max[i], point[component]);
    });
    point.slice(0, 3).forEach((value, i) => { accumulator.sum[i] += value; });
  }
  samples.forEach((sample, index) => {
    if (!sample.count) return;
    const accumulator = accumulators[index];
    sample.width = accumulator.max[0] - accumulator.min[0];
    sample.depth = accumulator.max[1] - accumulator.min[1];
    sample.center = accumulator.sum.map(value => value / sample.count);
  });
  return {
    axis, crossAxes: across.map(index => ['x', 'y', 'z'][index]), min, max, samples,
  };
}

function normalizeColor(color) {
  if (typeof color === 'number' && Number.isFinite(color)) {
    return `#${Math.min(0xffffff, Math.max(0, Math.round(color))).toString(16).padStart(6, '0')}`;
  }
  if (Array.isArray(color) && color.length >= 3 && color.slice(0, 3).every(Number.isFinite)) {
    return `#${color.slice(0, 3).map(channel => Math.round(Math.max(0, Math.min(1, channel)) * 255)
      .toString(16).padStart(2, '0')).join('')}`;
  }
  if (typeof color === 'string') {
    const match = color.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
    if (match) return `#${match[1].length === 3
      ? Array.from(match[1], digit => digit + digit).join('') : match[1]}`.toLowerCase();
  }
  return null;
}

/** Group exact material base colors by surface area.
 * Input:[{color:'#rrggbb' | '#rgb' | integerRGB | [r,g,b] (0..1),area:number}].
 * Output:{totalArea,colors:[{color,area,share,count}]}, descending area.
 * This is material coverage, NOT a histogram of texture pixels / final lighting.
 */
export function areaWeightedPalette(entries) {
  const groups = new Map();
  let totalArea = 0;
  for (const entry of entries ?? []) {
    const color = normalizeColor(entry?.color), area = entry?.area;
    if (!color || !Number.isFinite(area) || area <= 0) continue;
    const group = groups.get(color) ?? { color, area: 0, share: 0, count: 0 };
    group.area += area;
    group.count++;
    totalArea += area;
    groups.set(color, group);
  }
  const colors = [...groups.values()].map(group => ({ ...group, share: group.area / totalArea }))
    .sort((a, b) => b.area - a.area || a.color.localeCompare(b.color));
  return { totalArea, colors };
}
