export const chapters = [
  { route: 'intro', index: '01', label: '入场' },
  { route: 'model', index: '02', label: '整体', description: '认识广府醒狮', icon: 'M12 37a8 8 0 0 1-2-16 9 9 0 0 1 8-10 10 10 0 0 1 18 8 9 9 0 0 1 0 18H12ZM12 28c-6-6 4-11 6-4 0-7 10-7 10 0 6-6 12 2 5 6M19 31c-4 3-1 8 3 5M26 30c4-4 7 2 3 4', viewBox: '0 0 48 48' },
  { route: 'structure', index: '03', label: '结构', description: '解析醒狮构造', icon: 'm24 3 10 6v12l-10 6-10-6V9Zm-10 6 10 6 10-6M24 15v12M14 21 4 27v12l10 6 10-6V27Zm-10 6 10 6 10-6M14 33v12m20-24-10 6v12l10 6 10-6V27Zm-10 6 10 6 10-6M34 33v12', viewBox: '0 0 48 48' },
  { route: 'action', index: '04', label: '动作', description: '探秘经典招式', icon: 'M12 15 8 12l2-5 5 1 3-4 5 2 1 6-4 5-7-2ZM14 8h1M10 12h6M20 16l9 8 7 9 4 9-4 2-5-8-7-5-3 4-5-2 4-6-5-5-3 2-7-4 1-4 6 2 1-4M28 24c6 0 8-4 7-8 5 0 5 8 0 12M25 31l-3 9-6 3-2-3 5-3 1-5', viewBox: '0 0 48 48' },
  { route: 'state', index: '05', label: '神态', description: '解读狮之神韵', icon: 'M3 24S11 10 24 10s21 14 21 14-8 14-21 14S3 24 3 24ZM34 24a10 10 0 1 1-20 0 10 10 0 1 1 20 0M29 24a5 5 0 1 1-5-5', viewBox: '0 0 48 48' },
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
