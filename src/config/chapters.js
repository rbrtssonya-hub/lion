export const chapters = [
  { route: 'entry', index: '01', label: '首页', description: '循狮入境 · 感受岭南', icon: 'M7 22 24 8l17 14M11 19v21h26V19M20 40V28h8v12M14 23h3M31 23h3M32 14V8h5v10', viewBox: '0 0 48 48' },
  { route: 'model', index: '02', label: '狮头与结构', description: '认识广府醒狮', icon: 'M12 37a8 8 0 0 1-2-16 9 9 0 0 1 8-10 10 10 0 0 1 18 8 9 9 0 0 1 0 18H12ZM12 28c-6-6 4-11 6-4 0-7 10-7 10 0 6-6 12 2 5 6M19 31c-4 3-1 8 3 5M26 30c4-4 7 2 3 4', viewBox: '0 0 48 48' },
  { route: 'action', index: '03', label: '动作', description: '探秘经典招式', icon: 'M12 15 8 12l2-5 5 1 3-4 5 2 1 6-4 5-7-2ZM14 8h1M10 12h6M20 16l9 8 7 9 4 9-4 2-5-8-7-5-3 4-5-2 4-6-5-5-3 2-7-4 1-4 6 2 1-4M28 24c6 0 8-4 7-8 5 0 5 8 0 12M25 31l-3 9-6 3-2-3 5-3 1-5', viewBox: '0 0 48 48' },
  { route: 'state', index: '04', label: '神态', description: '解读狮之神韵', icon: 'M3 24S11 10 24 10s21 14 21 14-8 14-21 14S3 24 3 24ZM34 24a10 10 0 1 1-20 0 10 10 0 1 1 20 0M29 24a5 5 0 1 1-5-5', viewBox: '0 0 48 48' },
];

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
    panelText: '当前仅展示注视、警觉、唤醒三个定性观察节点，真实样本接入后再补充图片与对照说明。',
    nodes: ['注视', '警觉', '唤醒'],
  },
};
