// Editorial introductions accompany the existing, unchanged craft records.
// Calligraphy is generated artwork, never a replacement for model evidence.
export const structureAtlasEntries = [
  {
    id: 'outer_shell', character: '神', calligraphyKey: 'calligraphyShen',
    subtitle: '一笔绘神采，百色塑狮魂。',
    introduction: ['狮首昂然，眉眼生威。', '浓墨重彩之间，绘出醒狮的精气神。', '一头醒狮的神采，便从这里开始。'],
  },
  {
    id: 'eyes', character: '威', calligraphyKey: 'calligraphyWei',
    subtitle: '双目藏神气，扬眉见雄风。',
    introduction: ['一望有神，一扬生威。', '眉眼之间，藏着醒狮的警觉与回应。', '随一回转首，读一瞬神情。'],
  },
  {
    id: 'mirror', character: '冠', calligraphyKey: 'calligraphyGuan',
    subtitle: '额间凝瑞彩，角上见精神。',
    introduction: ['额饰凝光，狮角昂然。', '由额间望向头顶，一线中轴贯起形貌。', '小小一处，点出整头醒狮的精神。'],
  },
  {
    id: 'mouth', character: '启', calligraphyKey: 'calligraphyQi',
    subtitle: '一张一合间，百态皆生动。',
    introduction: ['启口见意，俯仰成情。', '口沿与牙饰相映，接住眉眼未尽的神态。', '沿着静态轮廓，想见舞动的节奏。'],
  },
  {
    id: 'fur_and_bells', character: '灵', calligraphyKey: 'calligraphyLing',
    subtitle: '须随风而动，饰随势而生。',
    introduction: ['红白相间，柔须垂落。', '一缕一束，给硬朗的轮廓添上余韵。', '轻与重、刚与柔，在边饰间相遇。'],
  },
  {
    id: 'lion_cloth', character: '势', calligraphyKey: 'calligraphyShi',
    subtitle: '彩被翻如浪，狮尾动生风。',
    introduction: ['从狮首到狮尾，一气相连。', '彩被承接前后的轮廓，也铺展舞步的起伏。', '看见完整形体，方知一狮之势。'],
  },
];

export const getStructureAtlasEntry = id => structureAtlasEntries.find(entry => entry.id === id) ?? structureAtlasEntries[0];
