import { expect } from '@playwright/test';

export const settingsPages = ['公共模块', '外观', '导航', '首页', '章节', '视角', 'HDRI', '资料', '动画', '轮播', '布局'];
export const settingsPanel = page => page.getByRole('region', { name: '开发者参数设置', exact: true });

// Route by the unchanged accessible label or storage/surface prefix. Keep main
// and nested tablists scoped so the heritage tabs cannot satisfy these clicks.
const routes = [
  [['soundControl', 'soundWave', '音量文字', '音量控件', '波浪线', '波峰', '波谷', '波长'], ['公共模块']],
  [['archivePanelTransparency', '首页阅读底板', '公共', '应用范围'], ['公共模块']],
  [['header', 'sidebar', '顶栏', '侧栏'], ['外观']],
  [['navFontSize', 'helperFontSize', 'navIconSize', 'helperTransparency', 'brandPadding', 'compactNav', 'homeBrandOffset', '导航标题', '导航辅助', '导航图标', '辅助文字', '品牌左侧', '紧凑导航', '首页品牌'], ['导航']],
  [['bookTitle', 'bookDetails', 'bookScale', 'bookStageHeight', 'bookGuideScale', 'bookGuideVerticalSpacing', 'bookAutoplay', 'bookPageInterval', '书册标题', '书册详情', '标题底板留白', '书册放大', '书册展示', '书册下方人物', '按页码', '每页停留'], ['首页', '书册']],
  [['cultureTitle', 'cultureBody', '文化标题', '文化正文'], ['首页', '图鉴']],
  [['modelOverlay', '结构资料'], ['章节', '结构']],
  [['actionOverlay', 'videoOverlay', '动作目录', '视频提示'], ['章节', '动作']],
  [['expressionOverlay', 'expressionOverviewFontSize', 'expressionDetailFontSize', 'expressionClick', '神态文字', '神态简介', '神态解读', '狮头点击', '点击反馈时长'], ['章节', '神态']],
  [['structureMinDistance', 'structureMaxDistance', 'structureFov', 'actionMinDistance', 'actionMaxDistance', 'actionMinPolarAngle', 'actionMaxPolarAngle', 'actionFov', '结构最近', '结构最远', '结构镜头', '动作最近', '动作最远', '动作俯视', '动作仰视', '动作镜头'], ['视角']],
  [['hdri', 'HDRI', '辅助灯光'], ['HDRI']],
  [['cultureSources', 'cultureSourceCard', 'sourcesTitle', 'sourcesBody', 'sourcesMeta', '资料标题', '资料正文', '资料辅助', '参考资料'], ['资料']],
  [['navigationDuration', 'navigationEasing', 'bookInkEnabled', '导航动画', '动画变速', '书册导航粒子'], ['动画']],
  [['carousel', '照片', '自动播放间隔', '离开后恢复等待'], ['轮播']],
  [['pushPage', 'pageHitEnabled', 'panelWidth', '设置面板', '网页页面'], ['布局']],
];

export async function selectSettingsPage(page, name, subpage) {
  const panel = settingsPanel(page);
  const tab = panel.getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab', { name, exact: true });
  if (await tab.getAttribute('aria-selected') !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  if (subpage) {
    const nested = panel.getByRole('tablist', { name: name === '首页' ? '首页设置分区' : '章节设置分区', exact: true })
      .getByRole('tab', { name: subpage, exact: true });
    if (await nested.getAttribute('aria-selected') !== 'true') await nested.click();
    await expect(nested).toHaveAttribute('aria-selected', 'true');
  }
  await expandSettingsGroups(page);
  return panel;
}

export async function expandSettingsGroups(page) {
  const scroll = settingsPanel(page).locator('.developer-settings-scroll');
  const scrollTop = await scroll.evaluate(element => element.scrollTop);
  const summaries = settingsPanel(page).locator('.developer-settings-page:not([hidden]) .developer-settings-group:visible:not([open]) > summary');
  while (await summaries.count()) await summaries.first().click();
  // Opening the last group can scroll its summary into view. Keep the position
  // established by the actual page/subpage navigation, then let the caller's
  // input interaction scroll naturally to its control.
  await scroll.evaluate((element, top) => { element.scrollTop = top; }, scrollTop);
}

export async function selectSettingsFor(page, labelOrPrefix) {
  const route = routes.find(([prefixes]) => prefixes.some(prefix => labelOrPrefix.startsWith(prefix)));
  if (!route) throw new Error(`No settings path for ${labelOrPrefix}`);
  return selectSettingsPage(page, ...route[1]);
}
