import { useCallback, useEffect, useRef, useState } from 'react';
import { surfaceDefaults, surfaceRanges } from './surfaceSettings.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const navigationTypographyVersion = 2;
export const defaultDeveloperSettings = Object.freeze({
  headerTransparency: 20,
  headerBlur: 12,
  headerWidth: 100,
  headerRadius: 0,
  headerColor: '#801d17',
  sidebarTransparency: 14,
  sidebarBlur: 18,
  sidebarHeight: 100,
  sidebarRadius: 0,
  sidebarColor: '#fff6e4',
  archivePanelTransparency: 40,
  bookIntroDuration: 12,
  bookScale: 116,
  bookStageHeight: 680,
  bookInkEnabled: true,
  pageHitEnabled: false,
  headerHeight: 90,
  navFontSize: 26,
  helperFontSize: 18,
  expressionOverviewFontSize: 22,
  expressionDetailFontSize: 18,
  navIconSize: 40,
  helperTransparency: 50,
  brandPadding: 24,
  homeBrandOffset: 24,
  navigationDuration: 720,
  navigationEasing: 'smooth',
  compactNavGap: 14,
  compactNavInset: 48,
  carouselAutoplay: true,
  carouselInterval: 6,
  carouselResumeDelay: 3,
  carouselTransitionDuration: 800,
  carouselFocusScale: 104,
  panelWidth: 340,
  pushPage: true,
  ...surfaceDefaults,
});

const ranges = {
  headerTransparency: [0, 100, 1], headerBlur: [0, 30, 1],
  headerWidth: [60, 100, 1], headerRadius: [0, 100, 1],
  sidebarTransparency: [0, 100, 1], sidebarBlur: [0, 30, 1],
  sidebarHeight: [50, 100, 1], sidebarRadius: [0, 100, 1],
  archivePanelTransparency: [0, 100, 1],
  bookIntroDuration: [3, 30, 1],
  bookScale: [90, 145, 1], bookStageHeight: [480, 960, 10],
  headerHeight: [64, 180, 1], navFontSize: [14, 28, 1],
  helperFontSize: [10, 28, 1],
  expressionOverviewFontSize: [16, 32, 1], expressionDetailFontSize: [16, 32, 1],
  navIconSize: [24, 56, 1], helperTransparency: [0, 100, 1],
  brandPadding: [8, 80, 1], panelWidth: [280, 760, 1],
  homeBrandOffset: [0, 160, 1],
  navigationDuration: [200, 1600, 10],
  compactNavGap: [4, 36, 1], compactNavInset: [16, 160, 1],
  carouselInterval: [2, 30, 1], carouselResumeDelay: [1, 15, 1],
  carouselTransitionDuration: [300, 1600, 50], carouselFocusScale: [101, 110, 1],
  ...surfaceRanges,
};

export function normalizeDeveloperSetting(name, value) {
  if (!Object.hasOwn(defaultDeveloperSettings, name)) return undefined;
  if (typeof defaultDeveloperSettings[name] === 'boolean') {
    return typeof value === 'boolean' ? value : defaultDeveloperSettings[name];
  }
  if (name.endsWith('Color')) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase() : defaultDeveloperSettings[name];
  }
  if (name === 'navigationEasing') {
    return ['smooth', 'swift', 'soft'].includes(value) ? value : defaultDeveloperSettings.navigationEasing;
  }
  const [min, max, step] = ranges[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultDeveloperSettings[name];
  return min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;
}

function resolveSettings(settings) {
  const resolved = { ...defaultDeveloperSettings, ...settings };
  // Upgrade the previous default once, preserving the other saved controls.
  if (resolved.navigationTypographyVersion !== navigationTypographyVersion && resolved.navFontSize === 20) {
    resolved.navFontSize = defaultDeveloperSettings.navFontSize;
  }
  resolved.navigationTypographyVersion = navigationTypographyVersion;
  return resolved;
}

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return resolveSettings();
    const normalized = Object.fromEntries(Object.keys(defaultDeveloperSettings).map(name => [name, normalizeDeveloperSetting(name, saved[name])]));
    // Preserve the previously shared reading-paper preference when splitting it into four surfaces.
    for (const prefix of ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody']) {
      if (!Object.hasOwn(saved, `${prefix}Transparency`) && Object.hasOwn(saved, 'archivePanelTransparency')) {
        normalized[`${prefix}Transparency`] = normalized.archivePanelTransparency;
      }
    }
    return resolveSettings({ ...normalized, navigationTypographyVersion: saved.navigationTypographyVersion });
  } catch {
    return resolveSettings();
  }
}

export function useDeveloperSettings() {
  const [settings, setSettings] = useState(readSettings);
  const shouldPersist = useRef(true);
  const resolvedSettings = resolveSettings(settings);
  useEffect(() => {
    if (!shouldPersist.current) return;
    try { localStorage.setItem(storageKey, JSON.stringify(resolveSettings(settings))); }
    catch { /* Live controls remain usable when browser storage is unavailable. */ }
  }, [settings]);

  const changeSettings = useCallback((name, value) => {
    if (!Object.hasOwn(defaultDeveloperSettings, name)) return;
    shouldPersist.current = true;
    setSettings(current => {
      const normalized = normalizeDeveloperSetting(name, value);
      const next = { ...resolveSettings(current), [name]: normalized };
      if (name === 'archivePanelTransparency') {
        for (const prefix of ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody']) next[`${prefix}Transparency`] = normalized;
      }
      return next;
    });
  }, []);
  const previewSettings = useCallback((name, value) => {
    if (!Object.hasOwn(defaultDeveloperSettings, name)) return;
    shouldPersist.current = false;
    setSettings(current => ({ ...resolveSettings(current), [name]: normalizeDeveloperSetting(name, value) }));
  }, []);
  const commitSettings = useCallback(() => {
    shouldPersist.current = true;
    setSettings(current => resolveSettings(current));
  }, []);
  const resetSettings = useCallback(() => {
    shouldPersist.current = true;
    setSettings(resolveSettings());
  }, []);
  return { settings: resolvedSettings, changeSettings, previewSettings, commitSettings, resetSettings };
}
