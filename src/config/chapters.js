export const chapters = [
  { route: 'intro', index: '01', label: '入场' },
  { route: 'model', index: '02', label: '整体', description: '认识广府醒狮', icon: 'M3 17c7-8 13-8 20-1 7-7 13-7 22 1M10 8c5-5 10-5 15 0 5-5 10-5 16 0', viewBox: '0 0 48 24' },
  { route: 'structure', index: '03', label: '结构', description: '解析醒狮构造', icon: 'm24 4 16 9v18l-16 9-16-9V13zM8 13l16 9 16-9M24 22v18', viewBox: '0 0 48 48' },
  { route: 'action', index: '04', label: '动作', description: '探秘经典招式', icon: 'M9 36c10-2 14-10 15-24M22 12l3-5 4 5M25 25c7 1 10 5 14 12M11 16c6 1 9 4 12 9', viewBox: '0 0 48 48' },
  { route: 'state', index: '05', label: '神态', description: '解读狮之神韵', icon: 'M3 16S11 5 24 5s21 11 21 11-8 11-21 11S3 16 3 16ZM29 16a5 5 0 1 1-10 0a5 5 0 1 1 10 0', viewBox: '0 0 48 32' },
  { route: 'score', index: '06', label: '评分', description: '欣赏与评价', icon: 'm24 4 6 12 14 2-10 10 3 14-13-7-13 7 3-14L4 18l14-2z', viewBox: '0 0 48 48' },
];

// These are the existing chapter outlines. Editorial content is still pending.
export const chapterContent = {
  action: {
    index: '04 / 06', kicker: '动作章节 / MOTION', title: '动作',
    lead: '从入场、摆头到收势，动作模块将在时间轴中记录醒狮的节奏变化。',
    module: 'MODULE 04', panelTitle: '动作时间轴',
    panelText: '这里将接入动作视频、关键帧和动作说明，形成可浏览的动作信息层。',
    nodes: ['入场', '展开', '收势'],
  },
  state: {
    index: '05 / 06', kicker: '神态章节 / EXPRESSION', title: '神态',
    lead: '通过眼神、摆头和嘴部变化，记录醒狮由静到动的神态线索。',
    module: 'MODULE 05', panelTitle: '神态观察',
    panelText: '这里将接入神态视频与定格分析，建立动作和神态之间的对应关系。',
    nodes: ['注视', '警觉', '唤醒'],
  },
  score: {
    index: '06 / 06', kicker: '评分章节 / CRITERIA', title: '评分',
    lead: '将醒狮的造型、动作和神态整理为可阅读的观察维度。',
    module: 'MODULE 06', panelTitle: '评价维度',
    panelText: '这里将接入资料来源和评价指标，形成透明、可追溯的展示模块。',
    nodes: ['造型', '动作', '神态'],
  },
};
