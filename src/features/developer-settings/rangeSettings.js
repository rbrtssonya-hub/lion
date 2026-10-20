// Keep fractional slider steps stable in both persisted values and number inputs.
export function snapSettingsRange(value, min, max, step) {
  const precision = Math.max(...[min, step].map(number => (String(number).split('.')[1] ?? '').length));
  const snapped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;
  return Number(snapped.toFixed(precision));
}
