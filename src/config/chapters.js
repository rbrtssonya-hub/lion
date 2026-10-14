import { lionExpressions } from '../data/lion-expressions.js';

export const chapters = [
  { route: 'entry', label: '首页', description: '循狮入境 · 感受岭南' },
  { route: 'model', label: '结构', description: '认识广府醒狮' },
  { route: 'action', label: '动作', description: '探秘经典招式' },
  { route: 'state', label: '神态', description: '解读狮之神韵' },
];

// Insets frame the visible artwork while keeping the supplied PNG bytes intact.
export const navigationIcons = {
  entry: { mediaKey: 'navHomeIcon', viewBox: '193 242 868 773' },
  model: { mediaKey: 'navStructureIcon', viewBox: '156 135 942 987' },
  action: { mediaKey: 'navActionIcon', viewBox: '210 140 888 963' },
  state: { mediaKey: 'navExpressionIcon', viewBox: '109 311 1038 611' },
  settings: { mediaKey: 'navSettingsIcon', viewBox: '270 272 715 715' },
};

// These are the existing chapter outlines. Editorial content is still pending.
export const chapterContent = {
  action: {
    index: '03 / 04', kicker: '动作章节 / MOTION', title: '动作',
    lead: '从入场、摆头到收势，动作模块将在时间轴中记录醒狮的节奏变化。',
    module: 'MODULE 03', panelTitle: '动作时间轴',
    panelText: '专用动作视频待提供，当前不复用入场视频。时间轴先保留入场、展开、收势三个定性节点。',
    nodes: ['入场', '展开', '收势'],
  },
  state: {
    index: '04 / 04', kicker: '神态章节 / EXPRESSION', title: '神态',
    lead: '通过眼神、摆头和嘴部变化，记录醒狮由静到动的神态线索。',
    module: 'MODULE 04', panelTitle: '神态观察',
    panelText: '八态图鉴提供定性观察提示，等待真实图片/视频样本校核。',
    nodes: lionExpressions.map(({ name }) => name),
  },
};
