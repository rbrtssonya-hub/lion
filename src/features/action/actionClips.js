// User will supply four independent clips. Reference posters are not video frames.
export const actionClips = [
  { id: 'entry', name: '入场', lines: ['狮头抬起，步伐展开。', '看它如何进入表演。'], posterKey: 'actionEntryPoster', videoKey: null },
  { id: 'probe', name: '探步', lines: ['重心放低，向前试探。', '留意狮头与步伐的配合。'], posterKey: 'actionProbePoster', videoKey: null },
  { id: 'turn', name: '转身', lines: ['狮头引导，身体跟随。', '看头尾如何改变方向。'], posterKey: 'actionTurnPoster', videoKey: null },
  { id: 'settle', name: '收势', lines: ['动作收住，姿态稳定。', '留意节奏怎样结束。'], posterKey: 'actionSettlePoster', videoKey: null },
].map(clip => ({ ...clip, sourceNote: '参考示意 · 视频待接入，观察提示以实际视频为准' }));
