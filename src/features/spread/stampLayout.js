const angles = [-4.1, 3.3, -2.7, 4.5];

function variation(id) {
  let value = 2166136261;
  for (const letter of id) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967295;
}

/** Four complete postal prints, fitted with room for rotation and soft shadows. */
export function getSpreadStampHome(stamp, width, height) {
  const index = (Number(stamp.number) - 1) % 4;
  const column = index % 2, row = Math.floor(index / 2);
  const padding = Math.max(16, Math.min(32, width * .038));
  const footer = Math.min(38, height * .07);
  const usableHeight = Math.max(1, height - padding * 2 - footer);
  const cellWidth = Math.max(1, (width - padding * 2) / 2);
  const cellHeight = usableHeight / 2;
  const angle = angles[index] + (variation(stamp.id) - .5) * 1.4;
  const radians = Math.abs(angle) * Math.PI / 180;
  const ratio = stamp.ratio;
  const scale = Math.min(
    Math.max(1, cellWidth - padding * .7) / (Math.cos(radians) * ratio + Math.sin(radians)),
    Math.max(1, cellHeight - padding * .7) / (Math.cos(radians) + Math.sin(radians) * ratio),
  );
  const offset = (variation(`${stamp.id}:position`) - .5) * padding * .32;
  return {
    x: padding + cellWidth * (column + .5) + offset,
    y: padding + cellHeight * (row + .5) + (column ? padding * .13 : -padding * .13),
    width: scale * ratio, height: scale, angle, z: 2 + index,
  };
}

/** Translate the original full-page focus ratios into the local stamp board. */
export function getSpreadStampFocus(stamp, width, height, parameters = {}) {
  const safeHeight = Math.max(1, height - 100);
  const maxHeight = Math.min(safeHeight, height * .84 * (parameters.focusHeight ?? .565) / .565);
  const maxWidth = Math.min(Math.max(1, width - 48), width * .82 * (parameters.focusWidth ?? .295) / .295);
  const pictureWidth = Math.min(maxWidth, maxHeight * stamp.ratio);
  const pictureHeight = pictureWidth / stamp.ratio;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  return {
    x: clamp(width * (parameters.focusX ?? .479), pictureWidth / 2 + 22, width - pictureWidth / 2 - 22),
    y: clamp(height * (parameters.focusY ?? .5), pictureHeight / 2 + 50, height - pictureHeight / 2 - 22),
    width: pictureWidth, height: pictureHeight, angle: 0,
  };
}
