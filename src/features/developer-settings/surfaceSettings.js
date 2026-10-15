// Surface dimensions describe the paper, while opacity never affects its text.
export const surfaceDefinitions = Object.freeze([
  { prefix: 'bookTitle', label: '书册标题底板', color: '#fff9ee', transparency: 40, blur: 5, radius: 14 },
  { prefix: 'bookDetails', label: '书册详情底板', color: '#fff9ee', transparency: 40, blur: 5, radius: 14 },
  { prefix: 'cultureTitle', label: '文化标题底板', color: '#fff9ee', transparency: 40, blur: 5, radius: 14 },
  { prefix: 'cultureBody', label: '文化正文底板', color: '#fff9ee', transparency: 40, blur: 5, radius: 14 },
  { prefix: 'cultureSources', label: '参考资料区域', color: '#f8edda', transparency: 0, blur: 0, radius: 18 },
  { prefix: 'cultureSourceCard', label: '参考资料卡片', color: '#fff8eb', transparency: 0, blur: 0, radius: 9, height: 186, heightStep: 1 },
  { prefix: 'modelOverlay', label: '结构资料底板', color: '#68170f', transparency: 20, blur: 12, radius: 24, height: 620 },
  { prefix: 'actionOverlay', label: '动作目录底板', color: '#faf7f1', transparency: 9, blur: 10, radius: 0 },
  { prefix: 'videoOverlay', label: '视频提示底板', color: '#080b0a', transparency: 12, blur: 0, radius: 8, width: 80 },
]);

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
    '--header-width': `${settings.headerWidth}%`,
    '--header-radius': `${settings.headerRadius}px`,
    '--header-rgb': colorChannels(settings.headerColor),
    '--sidebar-height': `${settings.sidebarHeight}dvh`,
    '--sidebar-radius': `${settings.sidebarRadius}px`,
    '--sidebar-rgb': colorChannels(settings.sidebarColor),
  };
}
