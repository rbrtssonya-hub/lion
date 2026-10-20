// Editorial observation prompts from the user's eight-state reference.
// These describe what to look for, not verified samples or measured findings.
const observations = {
  '喜': { id: 'joy', posture: '先看迎人般的轻抬头与舒展轮廓，再与乐态较大的起伏对照。', intent: '用于观察较含蓄的欢喜与回应，不据一张示意图判断真实表演情绪。' },
  '怒': { id: 'anger', posture: '留意昂首、凝目和身体收紧形成的威势。', intent: '观察力量感与警觉，不把醒狮的威仪等同于人的愤怒。' },
  '哀': { id: 'sorrow', posture: '留意低首、收口和驻足构成的内收轮廓。', intent: '用于理解低回与收势的视觉表达，须结合前后情节。' },
  '乐': { id: 'delight', posture: '与喜态对照仰首、张口及更舒展的整体轮廓。', intent: '观察嬉趣与外放的表达；真实连续嬉戏仍需视频或现场样本。' },
  '动': { id: 'motion', posture: '先看头部朝向与侧转，再追踪前后身段的连接。', intent: '关注动势与转向，不从静态示意推算速度、幅度或难度。' },
  '静': { id: 'stillness', posture: '观察视线落点与收拢轮廓，和动态的展开方向比较。', intent: '理解驻足与蓄势；静态并不等于没有表演意图。' },
  '惊': { id: 'surprise', posture: '比较抬头、目光展开与狮口张幅形成的警觉感。', intent: '观察突发回应的视觉线索，不据单幅图认定真实受惊。' },
  '疑': { id: 'doubt', posture: '与惊态对照偏首、探看和欲进还停的姿态线索。', intent: '关注试探与寻找，完整含义须结合表演的对象和情节。' },
};

export const expressionComparisons = [
  { id: 'joy-delight', label: '喜与乐', ids: ['joy', 'delight'] },
  { id: 'surprise-doubt', label: '惊与疑', ids: ['surprise', 'doubt'] },
  { id: 'motion-stillness', label: '动与静', ids: ['motion', 'stillness'] },
];
export const lionExpressions = [
  { name: '喜', imageKey: 'expressionJoy', summary: '灵动欢喜', verse: '喜气盈门 · 生机盎然', meaning: '欢喜', description: ['醒狮扬眉含笑，向人间送来好意。', '狮口轻启，白须随鼓点轻颤。', '一俯一仰间，是迎客纳福的欢喜。'], emotion: '看狮眼是否明亮舒展，狮口轻开时有无迎人的笑意。', motion: '随锣鼓观察点头与小碎步，留意醒狮向观众靠近的回应。' },
  { name: '怒', imageKey: 'expressionAnger', summary: '威严刚猛', verse: '气势如虹 · 势不可挡', meaning: '威势', description: ['醒狮凝目昂首，威势收在眉间。', '狮口一张一合，劲力随鼓声迸发。', '顿步扬头，见南狮刚健的精神。'], emotion: '看狮眉是否压向目光，狮口有力开合时张力怎样变化。', motion: '对照重鼓中的昂首、顿步与摆头，辨认醒狮的发力停顿。' },
  { name: '哀', imageKey: 'expressionSorrow', summary: '低回沉思', verse: '缓步低首 · 含蓄深沉', meaning: '低回', description: ['醒狮垂首敛目，把情绪藏进停顿。', '长须低拂，狮口缓缓收合。', '轻鼓慢步里，也有细腻的心事。'], emotion: '看狮头低垂时的视线落点，狮口收合是否缓慢而克制。', motion: '留意轻鼓下的低首、缓行与驻足，看醒狮怎样收住劲力。' },
  { name: '乐', imageKey: 'expressionDelight', summary: '欢腾雀跃', verse: '载歌载舞 · 热烈欢腾', meaning: '嬉趣', description: ['醒狮仰头张口，喜乐溢出眉眼。', '摇头摆须，与锣鼓你来我往。', '腾起落下，满场都是嬉戏的趣味。'], emotion: '看仰首时狮口的张幅，狮眼与眉梢是否形成活泼的回应。', motion: '跟随快鼓观察摇头、跃动与回望，读出醒狮连续嬉戏的节奏。' },
  { name: '动', imageKey: 'expressionMotion', summary: '腾挪起势', verse: '灵活敏捷 · 力与美结合', meaning: '动势', description: ['醒狮侧身起势，把目光送向前方。', '狮头领动，披身随步法舒展。', '鼓催身转，腾挪之间蓄足力量。'], emotion: '先看狮头朝向，再追踪目光，观察转身前后是否彼此衔接。', motion: '沿鼓点追踪起伏与重心转移，看狮头怎样带动狮尾配合。' },
  { name: '静', imageKey: 'expressionStillness', summary: '凝神守势', verse: '稳如泰山 · 蓄势待发', meaning: '沉静', description: ['醒狮驻足凝神，静中仍藏着气韵。', '狮目有落点，狮口微合不散神。', '锣鼓暂歇，一息之后再启新势。'], emotion: '看狮眼的落点是否稳定，眉眼与狮口有无细小的收放。', motion: '留意驻足收势后的轻微起伏，寻找醒狮静候下一鼓的蓄势。' },
  { name: '惊', imageKey: 'expressionSurprise', summary: '警觉骤起', verse: '瞬间反应 · 机警敏锐', meaning: '警觉', description: ['醒狮忽然抬头，目光与狮口一同张开。', '白须扬起，像听见了新的动静。', '一记急鼓，惊而不乱地再探前方。'], emotion: '看狮眼、眉梢与狮口是否同时展开，注意抬头一瞬的变化。', motion: '对照急鼓中的抬头、短停与后撤，看醒狮如何转回探索。' },
  { name: '疑', imageKey: 'expressionDoubt', summary: '探索试探', verse: '左右观望 · 小心靠近', meaning: '探寻', description: ['醒狮侧首探望，好奇里带着几分迟疑。', '一眼看去，又轻轻收回狮口。', '碎鼓试步，欲近还停地寻找答案。'], emotion: '看狮头偏转时目光如何转移，狮口微开是否带着试探感。', motion: '留意侧首、试步与停顿，观察醒狮怎样随着碎鼓欲进还停。' },
].map(expression => ({ ...expression, ...observations[expression.name] }));
