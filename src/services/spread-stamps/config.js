import { spreadStamps } from '../../data/spread-stamps.js';

// The source edition's timing/optical constants remain independent of lion's
// model renderer. The React board supplies its local, enlarged collage layout.
export const STAMPS = spreadStamps;
export const EXHIBITION = Object.freeze({
  enterDuration: 0.46, returnDuration: 0.56, reducedDuration: 0.1,
  hoverResponse: 0.085, blur: 11, mobileBlur: 6, maxDpr: 1.75,
  paper: '#fbf7f1', dark: '#22201c',
});
export const SERIES = Object.freeze([
  { id: 'all', label: '全部12张' }, { id: 'guangdong', label: '广东篇' },
  { id: 'china', label: '中国篇' }, { id: 'world', label: '世界篇' },
]);

export function getHome(stamp, width, height, series = 'guangdong') {
  const column = STAMPS.filter(item => item.series === stamp.series).findIndex(item => item.id === stamp.id);
  const row = Math.floor(column / 2), col = column % 2;
  const availableWidth = Math.max(1, width / 2 - 36);
  const availableHeight = Math.max(1, height / 2 - 34);
  const stampWidth = Math.min(availableWidth, availableHeight * stamp.ratio);
  return { x: width * (.27 + col * .46), y: height * (.26 + row * .48), width: stampWidth,
    height: stampWidth / stamp.ratio, angle: [-4.1, 3.2, 2.4, -3.6][column], z: 2 + column };
}

export function getFocus(stamp, width, height, parameters = {}) {
  const focusHeight = parameters.focusHeight ?? .565;
  const maxHeight = height * focusHeight;
  const widthLimit = width * (parameters.focusWidth ?? .295);
  const w = Math.min(widthLimit, maxHeight * stamp.ratio, 650);
  const halfWidth = w / 2 + 18, halfHeight = w / stamp.ratio / 2 + 55;
  const safe = (value, min, max) => Math.min(max, Math.max(min, value));
  return { x: safe(width * (parameters.focusX ?? .479), halfWidth, width - halfWidth),
    y: safe(height * (parameters.focusY ?? .5), halfHeight, height - halfHeight),
    width: w, height: w / stamp.ratio, angle: 0 };
}
