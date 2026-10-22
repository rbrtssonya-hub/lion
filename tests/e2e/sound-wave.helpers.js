// Check the browser's painted stroke, not just the mathematical path. The old
// hover dash animation had complete path geometry while visibly dropping parts
// of every wave, which a getPointAtLength-only assertion could not detect.
export const sampleWave = (window, duration = 260) => window.evaluate((element, duration) => new Promise(resolve => {
  const frames = [];
  let started;
  function sample(time) {
    started ??= time;
    const box = element.getBoundingClientRect();
    const paths = [...element.querySelectorAll('path')];
    const path = paths[0], flow = element.querySelector('.sound-wave-flow');
    const amplitude = element.querySelector('.sound-wave-amplitude');
    const length = path.getTotalLength(), matrix = path.getScreenCTM();
    const at = distance => {
      const local = path.getPointAtLength(distance);
      return { local, screen: local.matrixTransform(matrix) };
    };
    const ys = [], painted = [];
    for (let column = 0; column <= 24; column++) {
      const x = box.left + 1 + (box.width - 2) * column / 24;
      if (x < at(0).screen.x || x > at(length).screen.x) { painted.push(false); continue; }
      let low = 0, high = length;
      for (let index = 0; index < 20; index++) {
        const middle = (low + high) / 2;
        if (at(middle).screen.x < x) low = middle; else high = middle;
      }
      const point = at((low + high) / 2);
      ys.push(point.screen.y);
      painted.push(path.isPointInStroke(point.local) && point.screen.y >= box.top - .1 && point.screen.y <= box.bottom + .1);
    }
    const css = getComputedStyle(path);
    frames.push({ elapsed: time - started, x: new DOMMatrixReadOnly(getComputedStyle(flow).transform).m41,
      amplitude: new DOMMatrixReadOnly(getComputedStyle(amplitude).transform).m22,
      box: { x: box.x, y: box.y, width: box.width, height: box.height }, paths: paths.length,
      subpaths: (path.getAttribute('d').match(/m/gi) || []).length,
      stroke: css.strokeWidth, dash: css.strokeDasharray, covered: painted.every(Boolean),
      spread: Math.max(...ys) - Math.min(...ys) });
    if (time - started >= duration) resolve(frames);
    else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}), duration);

export const waveMetrics = window => window.evaluate(element => {
  const path = element.querySelector('path'), box = path.getBBox(), matrix = path.getScreenCTM();
  const baseline = path.getPointAtLength(0).y;
  return { paths: element.querySelectorAll('path').length,
    peak: (baseline - box.y) * matrix.d, trough: (box.y + box.height - baseline) * matrix.d,
    stroke: Number.parseFloat(getComputedStyle(path).strokeWidth),
    dash: getComputedStyle(path).strokeDasharray };
});

export function expectContinuousWave(expect, samples) {
  expect(samples.length).toBeGreaterThan(1);
  expect(samples.every(frame => frame.paths === 1 && frame.subpaths === 1 && frame.dash === 'none')).toBe(true);
  expect(samples.every(frame => frame.covered)).toBe(true);
  expect(new Set(samples.map(frame => JSON.stringify(frame.box))).size).toBe(1);
}
