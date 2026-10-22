// Keep entry, home loop and the active action screen at the same modest level.
export const DEFAULT_VIDEO_VOLUME = .25;

export function normalizeMediaVolume(value) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number)
    ? Math.round(Math.min(1, Math.max(0, number)) * 100) / 100 : DEFAULT_VIDEO_VOLUME;
}
