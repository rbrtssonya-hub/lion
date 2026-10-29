import { lionExpressions } from '../data/lion-expressions.js';
import { actionClips } from '../features/action/actionClips.js';

export const chapters = [
  { route: 'entry', label: '序', description: '循狮入境', number: '01', phase: '溯源' },
  { route: 'model', label: '造', description: '扎作观形', number: '02', phase: '观形' },
  { route: 'action', label: '舞', description: '观舞传神', number: '03', phase: '传神' },
  { route: 'spread', label: '传', description: '狮行远方', number: '04', phase: '远播' },
];

export const navigationLabelMediaKeys = {
  entry: 'navLabelXu',
  model: 'navLabelZao',
  action: 'navLabelWu',
  spread: 'navLabelChuan',
  settings: 'navLabelSettings',
};

// The expression collection remains addressable within the stage chapter.
export const pageRoutes = [...chapters.map(chapter => chapter.route), 'state', 'theater'];
export const chapterForRoute = route => route === 'state' || route === 'theater' ? 'action' : route;
export const getChapter = route => chapters.find(chapter => chapter.route === chapterForRoute(route));

// Insets frame the visible artwork while keeping the supplied PNG bytes intact.
export const navigationIcons = {
  entry: { mediaKey: 'navHomeIcon', viewBox: '193 242 868 773' },
  model: { mediaKey: 'navStructureIcon', viewBox: '156 135 942 987' },
  action: { mediaKey: 'navActionIcon', viewBox: '210 140 888 963' },
  state: { mediaKey: 'navExpressionIcon', viewBox: '109 311 1038 611' },
  spread: { mediaKey: 'navExpressionIcon', viewBox: '109 311 1038 611' },
  settings: { mediaKey: 'navSettingsIcon', viewBox: '270 272 715 715' },
};

// These are the existing chapter outlines. Editorial content is still pending.
export const chapterContent = {
  action: {
    index: '03 / 04', kicker: '动作章节 / MOTION', title: '动作',
    lead: '从入场、摆头到收势，动作模块将在时间轴中记录醒狮的节奏变化。',
    module: 'MODULE 03', panelTitle: '动作时间轴',
    panelText: '四段动作视频待提供，当前不复用首页或入场视频。配图与文字仅为参考示意。',
    nodes: actionClips.map(({ name }) => name),
  },
  state: {
    index: '04 / 04', kicker: '神态章节 / EXPRESSION', title: '神态',
    lead: '通过眼神、摆头和嘴部变化，记录醒狮由静到动的神态线索。',
    module: 'MODULE 04', panelTitle: '神态观察',
    panelText: '八态图鉴提供定性观察提示，等待真实图片/视频样本校核。',
    nodes: lionExpressions.map(({ name }) => name),
  },
};
