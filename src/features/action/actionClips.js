// Observations refer to the four supplied and decoded demonstration clips.
export const theaterActions = [
  {
    id: 'tanqing', name: '探青采青', objectName: 'Screen_Tanqing', anchorName: 'UI_Anchor_Tanqing', direction: [0, 0, -1],
    description: '先察青、探青，再靠近低头，最后将青采起。留意狮头与步法的配合。',
    keywords: ['察青', '试探', '采青'], videoKey: 'actionTanqingVideo', posterKey: 'actionTanqingPoster',
  },
  {
    id: 'doumao', name: '抖毛', objectName: 'Screen_Doumao', anchorName: 'UI_Anchor_Doumao', direction: [1, 0, 0],
    description: '狮头随节奏左右摆转，狮身毛饰一同抖动。观察蓄势、发力与定势的变化。',
    keywords: ['蓄势', '抖动', '定势'], videoKey: 'actionDoumaoVideo', posterKey: 'actionDoumaoPoster',
  },
  {
    id: 'tuqiu', name: '狮子吐球', objectName: 'Screen_Tuqiu', anchorName: 'UI_Anchor_Tuqiu', direction: [0, 0, 1],
    description: '红金绣球从狮口落下，醒狮随即低头与球互动。留意狮头、道具与视线的配合。',
    keywords: ['吐球', '落球', '互动'], videoKey: 'actionTuqiuVideo', posterKey: 'actionTuqiuPoster',
  },
  {
    id: 'meihuazhuang', name: '踩梅花桩', objectName: 'Screen_Meihuazhuang', anchorName: 'UI_Anchor_Meihuazhuang', direction: [-1, 0, 0],
    description: '醒狮在红金高桩间跨步、落步，调整身体保持平衡。观察落点与重心的衔接。',
    keywords: ['跨步', '落桩', '平衡'], videoKey: 'actionMeihuazhuangVideo', posterKey: 'actionMeihuazhuangPoster',
  },
].map(clip => ({ ...clip, title: clip.name, lines: [clip.description], sourceNote: '用户提供 · 动作演示素材' }));

export const actionClips = theaterActions;
