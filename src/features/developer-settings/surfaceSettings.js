// Surface dimensions describe the paper, while opacity never affects its text.
export const surfaceDefinitions = Object.freeze([
  { prefix: 'bookTitle', label: '书册标题底板', color: '#f7f5f0', transparency: 35, blur: 0, radius: 0, width: 69 },
  { prefix: 'bookDetails', label: '书册详情底板', color: '#f7f5f0', transparency: 10, blur: 0, radius: 10 },
  { prefix: 'cultureTitle', label: '文化标题底板', color: '#f7f5f0', transparency: 35, blur: 0, radius: 0 },
  { prefix: 'cultureBody', label: '文化正文底板', color: '#f7f5f0', transparency: 10, blur: 0, radius: 10 },
  { prefix: 'cultureSources', label: '参考资料区域', color: '#f7f5f0', transparency: 5, blur: 0, radius: 10 },
  { prefix: 'cultureSourceCard', label: '参考资料卡片', color: '#f7f5f0', transparency: 5, blur: 0, radius: 10, height: 186, heightStep: 1 },
  { prefix: 'modelOverlay', label: '结构资料底板', color: '#f7f4ed', transparency: 5, blur: 0, radius: 10, height: 0 },
  { prefix: 'expressionOverlay', label: '神态文字底板', color: '#f7f5f0', transparency: 10, blur: 0, radius: 10 },
  { prefix: 'actionOverlay', label: '动作目录底板', color: '#faf7f1', transparency: 9, blur: 10, radius: 0 },
  { prefix: 'videoOverlay', label: '视频提示底板', color: '#080b0a', transparency: 12, blur: 0, radius: 8, width: 80 },
]);

// The same scope registry drives the UI and the atomic application action.
export const surfaceScopes = Object.freeze({
  home: { label: '首页阅读 · 4处', prefixes: ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody'] },
  chapters: { label: '章节与视频 · 4处', prefixes: ['modelOverlay', 'actionOverlay', 'expressionOverlay', 'videoOverlay'] },
  sources: { label: '参考资料 · 2处', prefixes: ['cultureSources', 'cultureSourceCard'] },
  all: { label: '全部内容底板 · 10处', prefixes: surfaceDefinitions.map(surface => surface.prefix) },
});

export const surfaceDefaults = Object.freeze(Object.fromEntries(surfaceDefinitions.flatMap(surface => [
  [`${surface.prefix}Width`, surface.width ?? 100],
  [`${surface.prefix}Height`, surface.height ?? 0],
  [`${surface.prefix}Transparency`, surface.transparency],
  [`${surface.prefix}Blur`, surface.blur],
  [`${surface.prefix}Radius`, surface.radius],
  [`${surface.prefix}Color`, surface.color],
])));

export const surfaceRanges = Object.freeze(Object.fromEntries(surfaceDefinitions.flatMap(({ prefix, heightStep = 10 }) => [
  [`${prefix}Width`, [40, 100, 1]],
  [`${prefix}Height`, [0, 900, heightStep]],
  [`${prefix}Transparency`, [0, 100, 1]],
  [`${prefix}Blur`, [0, 40, 1]],
  [`${prefix}Radius`, [0, 100, 1]],
])));

export const readingPaperVersion = 1;
// Fixed historical values: only untouched material fields migrate, never dimensions.
const previousPaper = {
  bookTitle: ['#fff9ee', 40, 5, 14], bookDetails: ['#fff9ee', 40, 5, 14],
  cultureTitle: ['#fff9ee', 40, 5, 14], cultureBody: ['#fff9ee', 40, 5, 14],
  cultureSources: ['#f8edda', 0, 0, 18], cultureSourceCard: ['#fff8eb', 0, 0, 9],
  expressionOverlay: ['#fff8ea', 22, 6, 24],
};
export function migrateReadingPaper(saved) {
  if (saved.readingPaperVersion >= readingPaperVersion) return saved;
  const next = { ...saved, readingPaperVersion };
  for (const [prefix, values] of Object.entries(previousPaper)) {
    ['Color', 'Transparency', 'Blur', 'Radius'].forEach((suffix, index) => {
      const name = `${prefix}${suffix}`;
      if (saved[name] === values[index]) next[name] = surfaceDefaults[name];
    });
  }
  if (saved.archivePanelTransparency === 40) next.archivePanelTransparency = surfaceDefaults.bookTitleTransparency;
  return next;
}

// Keep this upgrade independent from readingPaperVersion: the earlier paper
// migration deliberately leaves the model surface alone. A persisted marker
// also lets a user choose the historical material again after this one upgrade.
export const structureAtlasVersion = 1;
const previousStructureSurface = Object.freeze({
  modelOverlayColor: '#68170f',
  modelOverlayTransparency: 20,
  modelOverlayBlur: 12,
  modelOverlayRadius: 24,
  modelOverlayWidth: 100,
  modelOverlayHeight: 620,
});
export function migrateStructureAtlas(saved) {
  if (saved.structureAtlasVersion >= structureAtlasVersion) return saved;
  const next = { ...saved, structureAtlasVersion };
  for (const [name, previousValue] of Object.entries(previousStructureSurface)) {
    if (saved[name] === previousValue) next[name] = surfaceDefaults[name];
  }
  return next;
}

export function colorChannels(color) {
  return [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)).join(' ');
}

export function navigationColorStops(color) {
  const channels = colorChannels(color).split(' ').map(Number);
  const base = [128, 29, 23];
  const stops = { start: [104, 23, 15], middle: [139, 32, 20], end: [115, 24, 15] };
  return Object.fromEntries(Object.entries(stops).map(([name, values]) => [
    `--header-${name}-rgb`,
    values.map((value, index) => Math.min(255, Math.max(0, Math.round(channels[index] * value / base[index])))).join(' '),
  ]));
}

export function getSurfaceStyle(settings, prefix) {
  const opacity = 1 - settings[`${prefix}Transparency`] / 100;
  const blur = opacity === 0 ? 0 : settings[`${prefix}Blur`];
  return {
    '--surface-width': `${settings[`${prefix}Width`]}%`,
    '--surface-width-ratio': settings[`${prefix}Width`] / 100,
    '--surface-height': `${settings[`${prefix}Height`]}px`,
    '--surface-opacity': opacity,
    '--surface-blur': blur > 0 ? `blur(${blur}px)` : 'none',
    '--surface-radius': `${settings[`${prefix}Radius`]}px`,
    '--surface-rgb': colorChannels(settings[`${prefix}Color`]),
  };
}

export function getGlobalSurfaceStyles(settings) {
  const surfaces = Object.fromEntries(surfaceDefinitions.flatMap(({ prefix }) =>
    Object.entries(getSurfaceStyle(settings, prefix)).map(([key, value]) => [`--${prefix}${key.slice(1)}`, value])));
  return {
    ...surfaces,
    ...navigationColorStops(settings.headerColor),
    '--book-title-spacing': settings.bookTitleSpacing / 100,
    '--header-width': `${settings.headerWidth}%`,
    '--header-radius': `${settings.headerRadius}px`,
    '--header-rgb': colorChannels(settings.headerColor),
    '--expression-overview-font-size': `${settings.expressionOverviewFontSize}px`,
    '--expression-detail-font-size': `${settings.expressionDetailFontSize}px`,
    '--sidebar-height': `${settings.sidebarHeight}dvh`,
    '--sidebar-radius': `${settings.sidebarRadius}px`,
    '--sidebar-rgb': colorChannels(settings.sidebarColor),
  };
}
