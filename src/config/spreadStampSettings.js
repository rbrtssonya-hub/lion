import { DEFAULT_PARAMETERS, PARAMETER_FIELDS, normalizeParameters } from './spread-stamps/parameters.js';

// The renderer retains its original 52-parameter contract. Persistent site
// settings use a namespace so paper/light values cannot affect other chapters.
export const spreadStampSettingKey = key => `stamp${key[0].toUpperCase()}${key.slice(1)}`;
const fieldsBySetting = new Map(PARAMETER_FIELDS.map(field => [spreadStampSettingKey(field.key), field]));
export const spreadStampDefaults = Object.freeze(Object.fromEntries(PARAMETER_FIELDS.map(field => [spreadStampSettingKey(field.key), field.value])));
export const spreadStampRanges = Object.freeze(Object.fromEntries(PARAMETER_FIELDS.filter(field => field.type === 'number')
  .map(field => [spreadStampSettingKey(field.key), [field.min, field.max, field.step]])));

export function isSpreadStampSetting(name) { return fieldsBySetting.has(name); }

export function normalizeSpreadStampSetting(name, value) {
  const field = fieldsBySetting.get(name);
  if (!field) return undefined;
  return normalizeParameters({ [field.key]: value })[field.key];
}

export function resolveSpreadStampParameters(settings = {}) {
  const safe = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  return normalizeParameters(Object.fromEntries(PARAMETER_FIELDS.map(field => [field.key, safe[spreadStampSettingKey(field.key)] ?? DEFAULT_PARAMETERS[field.key]])));
}

export function spreadStampSettingsForParameters(parameters) {
  return Object.fromEntries(Object.entries(normalizeParameters(parameters)).map(([key, value]) => [spreadStampSettingKey(key), value]));
}

export { DEFAULT_PARAMETERS, PARAMETER_GROUPS, PARAMETER_FIELDS, normalizeParameters, applyLightPreset, isLightPresetModified, parseParameters, serializeParameters } from './spread-stamps/parameters.js';
export { DEFAULT_LIGHT_ALGORITHM, LIGHT_PRESETS, LIGHT_PRESET_KEYS, getLightPreset } from './spread-stamps/lightPresets.js';
