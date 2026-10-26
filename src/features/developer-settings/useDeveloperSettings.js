import { useCallback, useEffect, useRef, useState } from 'react';
import { surfaceDefaults, surfaceRanges, surfaceScopes, migrateReadingPaper, readingPaperVersion, migrateStructureAtlas, structureAtlasVersion } from './surfaceSettings.js';
import { hdriDefaults, hdriRanges } from '../../config/hdri.js';
import { resolveViewSettings, viewDefaults, viewRanges } from '../../config/viewSettings.js';
import { soundControlDefaults, soundControlRanges } from '../../config/soundControlSettings.js';
import { expressionFeedbackDefaults, expressionFeedbackRanges } from '../../config/expressionFeedbackSettings.js';
import { snapSettingsRange } from './rangeSettings.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const navigationTypographyVersion = 2;
const bookTitleLayoutVersion = 1;
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
  archivePanelTransparency: surfaceDefaults.bookTitleTransparency,
  bookTitleSpacing: 100,
  bookAutoplay: true,
  bookPageInterval: 8,
  bookScale: 116,
  bookStageHeight: 680,
  bookGuideScale: 150,
  bookGuideVerticalSpacing: 32,
  bookInkEnabled: true,
  pageHitEnabled: false,
  headerHeight: 90,
  navFontSize: 26,
  helperFontSize: 18,
  expressionOverviewFontSize: 22,
  expressionDetailFontSize: 18,
  sourcesTitleFontSize: 32,
  sourcesBodyFontSize: 18,
  sourcesMetaFontSize: 16,
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
  ...hdriDefaults,
  ...viewDefaults,
  ...soundControlDefaults,
  ...expressionFeedbackDefaults,
});

const ranges = {
  headerTransparency: [0, 100, 1], headerBlur: [0, 30, 1],
  headerWidth: [60, 100, 1], headerRadius: [0, 100, 1],
  sidebarTransparency: [0, 100, 1], sidebarBlur: [0, 30, 1],
  sidebarHeight: [50, 100, 1], sidebarRadius: [0, 100, 1],
  archivePanelTransparency: [0, 100, 1],
  bookTitleSpacing: [50, 150, 1],
  bookPageInterval: [3, 30, 1],
  bookScale: [90, 145, 1], bookStageHeight: [480, 960, 10],
  bookGuideScale: [100, 250, 1], bookGuideVerticalSpacing: [0, 80, 1],
  headerHeight: [64, 180, 1], navFontSize: [14, 28, 1],
  helperFontSize: [10, 28, 1],
  expressionOverviewFontSize: [16, 32, 1], expressionDetailFontSize: [16, 32, 1],
  sourcesTitleFontSize: [24, 48, 1], sourcesBodyFontSize: [16, 28, 1], sourcesMetaFontSize: [14, 22, 1],
  navIconSize: [24, 56, 1], helperTransparency: [0, 100, 1],
  brandPadding: [8, 80, 1], panelWidth: [280, 760, 1],
  homeBrandOffset: [0, 160, 1],
  navigationDuration: [200, 1600, 10],
  compactNavGap: [4, 36, 1], compactNavInset: [16, 160, 1],
  carouselInterval: [2, 30, 1], carouselResumeDelay: [1, 15, 1],
  carouselTransitionDuration: [300, 1600, 50], carouselFocusScale: [101, 110, 1],
  ...surfaceRanges,
  ...hdriRanges,
  ...viewRanges,
  ...soundControlRanges,
  ...expressionFeedbackRanges,
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
  if (name === 'hdriSource') return ['default', 'forest', 'url', 'local'].includes(value) ? value : hdriDefaults.hdriSource;
  if (name === 'hdriUrl') {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    if (!url || url.length > 2048 || /^(?:javascript|data|file|blob):/i.test(url)) return '';
    try {
      const parsed = new URL(url, 'https://local.invalid/');
      return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
    } catch { return ''; }
  }
  if (name === 'hdriFile') return typeof File !== 'undefined' && value instanceof File ? value : null;
  const [min, max, step] = ranges[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultDeveloperSettings[name];
  return snapSettingsRange(value, min, max, step);
}

function resolveSettings(settings, changedName) {
  const resolved = { ...defaultDeveloperSettings, ...settings };
  Object.assign(resolved, resolveViewSettings(resolved, changedName));
  resolved.readingPaperVersion ??= readingPaperVersion;
  resolved.structureAtlasVersion ??= structureAtlasVersion;
  // Upgrade the previous default once, preserving the other saved controls.
  if (resolved.navigationTypographyVersion !== navigationTypographyVersion && resolved.navFontSize === 20) {
    resolved.navFontSize = defaultDeveloperSettings.navFontSize;
  }
  resolved.navigationTypographyVersion = navigationTypographyVersion;
  if (resolved.bookTitleLayoutVersion !== bookTitleLayoutVersion && resolved.bookTitleWidth === 100) {
    resolved.bookTitleWidth = defaultDeveloperSettings.bookTitleWidth;
  }
  resolved.bookTitleLayoutVersion = bookTitleLayoutVersion;
  return resolved;
}

export function restoreDeveloperSettings(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return resolveSettings();
  const normalized = Object.fromEntries(Object.keys(defaultDeveloperSettings).map(name => [name, normalizeDeveloperSetting(name, saved[name])]));
  // File objects only live in the current page; a reload uses the bundled map.
  normalized.hdriFile = null;
  if (normalized.hdriSource === 'local') normalized.hdriSource = hdriDefaults.hdriSource;
  // Preserve the previously shared reading-paper preference when splitting it into four surfaces.
  for (const prefix of ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody']) {
    if (!Object.hasOwn(saved, `${prefix}Transparency`) && typeof saved.archivePanelTransparency === 'number' && Number.isFinite(saved.archivePanelTransparency)) {
      normalized[`${prefix}Transparency`] = normalized.archivePanelTransparency;
    }
  }
  return resolveSettings(migrateStructureAtlas(migrateReadingPaper({ ...normalized,
    readingPaperVersion: saved.readingPaperVersion, structureAtlasVersion: saved.structureAtlasVersion,
    navigationTypographyVersion: saved.navigationTypographyVersion, bookTitleLayoutVersion: saved.bookTitleLayoutVersion,
  })));
}

function readSettings() {
  try {
    return restoreDeveloperSettings(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    return resolveSettings();
  }
}

function persistedSettings(settings) {
  const { hdriFile, ...persisted } = resolveSettings(settings);
  if (persisted.hdriSource === 'local') persisted.hdriSource = hdriDefaults.hdriSource;
  return persisted;
}

function settingsEqual(first, second) {
  return Object.keys(first).length === Object.keys(second).length &&
    Object.keys(first).every(name => Object.is(first[name], second[name]));
}

export function createSettingsExport(settings, hasUnsavedChanges, now = new Date()) {
  const { hdriFile, ...parameters } = resolveSettings(settings);
  return {
    format: 'nanfeng-lion-settings',
    version: 1,
    exportedAt: now.toISOString(),
    state: hasUnsavedChanges ? 'unsaved-preview' : 'saved',
    settings: parameters,
    sessionAssets: hdriFile ? {
      hdri: { name: hdriFile.name, size: hdriFile.size, type: hdriFile.type, requiresReselection: true },
    } : {},
    note: hasUnsavedChanges
      ? '包含当前未保存的预览参数；导出不会保存设置。本地HDRI仅记录文件信息，使用时需重新选择原文件。'
      : '当前设置参数。本地HDRI仅记录文件信息，使用时需重新选择原文件。',
  };
}

export function useDeveloperSettings() {
  const [settings, setSettings] = useState(readSettings);
  const [settingsFeedback, setSettingsFeedback] = useState('');
  const [editing, setEditing] = useState(false);
  const editSession = useRef(null);
  const currentSettings = useRef(settings);
  currentSettings.current = resolveSettings(settings);
  const shouldPersist = useRef(true);
  const resolvedSettings = resolveSettings(settings);
  const hasUnsavedChanges = editing && !!editSession.current && !settingsEqual(resolvedSettings, editSession.current);
  useEffect(() => {
    if (editSession.current || !shouldPersist.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(persistedSettings(settings)));
    }
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
      return resolveSettings(next, name);
    });
  }, []);
  const previewSettings = useCallback((name, value) => {
    if (!Object.hasOwn(defaultDeveloperSettings, name)) return;
    shouldPersist.current = false;
    setSettings(current => resolveSettings({ ...resolveSettings(current), [name]: normalizeDeveloperSetting(name, value) }, name));
  }, []);
  const applySurfaceSettings = useCallback((scope, material) => {
    const prefixes = surfaceScopes[scope]?.prefixes;
    if (!prefixes || !material || typeof material !== 'object') return;
    const patch = {};
    for (const prefix of prefixes) {
      for (const suffix of ['Transparency', 'Blur', 'Radius', 'Color']) {
        if (!Object.hasOwn(material, suffix)) continue;
        const name = `${prefix}${suffix}`;
        patch[name] = normalizeDeveloperSetting(name, material[suffix]);
      }
    }
    if ((scope === 'home' || scope === 'all') && Object.hasOwn(material, 'Transparency')) {
      patch.archivePanelTransparency = patch.bookTitleTransparency;
    }
    shouldPersist.current = true;
    setSettings(current => ({ ...resolveSettings(current), ...patch }));
  }, []);
  const commitSettings = useCallback(() => {
    shouldPersist.current = true;
    setSettings(current => resolveSettings(current));
  }, []);
  const resetSettings = useCallback(() => {
    shouldPersist.current = true;
    setSettings(resolveSettings());
  }, []);
  const beginSettingsEditing = useCallback(() => {
    if (editSession.current) return;
    editSession.current = { ...currentSettings.current };
    shouldPersist.current = false;
    setEditing(true);
    setSettingsFeedback('');
  }, []);
  const saveSettings = useCallback(({ keepEditing = false } = {}) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(persistedSettings(currentSettings.current)));
    } catch {
      setSettingsFeedback('无法保存到浏览器。当前预览仍保留，可导出参数后重试。');
      return false;
    }
    // Live camera tuning stays open after saving. Subsequent cancellation must
    // restore this newly saved baseline rather than the original opening state.
    editSession.current = keepEditing ? { ...currentSettings.current } : null;
    shouldPersist.current = false;
    setEditing(keepEditing);
    // Recompute dirty state even when repeated saves keep editing and feedback
    // unchanged; updating only the ref would leave the footer stale.
    if (keepEditing) setSettings(current => resolveSettings(current));
    setSettingsFeedback(currentSettings.current.hdriSource === 'local'
      ? '设置已保存。本地HDRI仅当前会话有效，刷新后使用内置环境。' : '设置已保存。');
    return true;
  }, []);
  const discardSettings = useCallback(() => {
    const snapshot = editSession.current;
    editSession.current = null;
    shouldPersist.current = false;
    if (snapshot) setSettings(snapshot);
    setEditing(false);
    setSettingsFeedback('');
  }, []);
  const exportSettings = useCallback(() => {
    const current = currentSettings.current;
    const dirty = !!editSession.current && !settingsEqual(current, editSession.current);
    const payload = createSettingsExport(current, dirty);
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `南风有狮-当前设置-${payload.exportedAt.slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // The download has consumed the URL when the next task runs.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setSettingsFeedback(dirty ? '已导出当前预览参数；更改尚未保存。' : '已导出当前设置参数。');
  }, []);
  return { settings: resolvedSettings, changeSettings, previewSettings, commitSettings, resetSettings, applySurfaceSettings,
    beginSettingsEditing, saveSettings, discardSettings, hasUnsavedChanges, exportSettings, settingsFeedback };
}
