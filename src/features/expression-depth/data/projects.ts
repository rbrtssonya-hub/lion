import { media } from '../../../config/media.js'

export interface Project {
  id: string
  number: string
  title: string
  subtitle: string
  description: string
  category: string
  location: string
  coordinates: string
  year: string
  images: string[]
  glyph: string
  narration: string
  accent: string
  emotion: string
  motion: string
  intent: string
  posture: string
}

// AI辅助视觉：以下文字是定性观察提示，等待真实图片/视频样本校核。
export const projects: Project[] = [
  {
    "id": "joy",
    "number": "01",
    "title": "喜",
    "subtitle": "灵动欢喜",
    "description": "醒狮扬眉含笑，向人间送来好意。\n狮口轻启，白须随鼓点轻颤。\n一俯一仰间，是迎客纳福的欢喜。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "欢喜",
    "coordinates": "喜气盈门 · 生机盎然",
    "year": "定性观察",
    "images": [media.expressionJoy],
    "glyph": media.expressionGlyphJoy,
    "narration": media.depthNarrationJoy,
    "accent": "#c5a66a",
    "emotion": "看狮眼是否明亮舒展，狮口轻开时有无迎人的笑意。",
    "motion": "随锣鼓观察点头与小碎步，留意醒狮向观众靠近的回应。",
    "intent": "用于观察较含蓄的欢喜与回应，不据一张示意图判断真实表演情绪。",
    "posture": "先看迎人般的轻抬头与舒展轮廓，再与乐态较大的起伏对照。"
  },
  {
    "id": "anger",
    "number": "02",
    "title": "怒",
    "subtitle": "威严刚猛",
    "description": "醒狮凝目昂首，威势收在眉间。\n狮口一张一合，劲力随鼓声迸发。\n顿步扬头，见南狮刚健的精神。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "威势",
    "coordinates": "气势如虹 · 势不可挡",
    "year": "定性观察",
    "images": [media.expressionAnger],
    "glyph": media.expressionGlyphAnger,
    "narration": media.depthNarrationAnger,
    "accent": "#c5a66a",
    "emotion": "看狮眉是否压向目光，狮口有力开合时张力怎样变化。",
    "motion": "对照重鼓中的昂首、顿步与摆头，辨认醒狮的发力停顿。",
    "intent": "观察力量感与警觉，不把醒狮的威仪等同于人的愤怒。",
    "posture": "留意昂首、凝目和身体收紧形成的威势。"
  },
  {
    "id": "sorrow",
    "number": "03",
    "title": "哀",
    "subtitle": "低回沉思",
    "description": "醒狮垂首敛目，把情绪藏进停顿。\n长须低拂，狮口缓缓收合。\n轻鼓慢步里，也有细腻的心事。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "低回",
    "coordinates": "缓步低首 · 含蓄深沉",
    "year": "定性观察",
    "images": [media.expressionSorrow],
    "glyph": media.expressionGlyphSorrow,
    "narration": media.depthNarrationSorrow,
    "accent": "#c5a66a",
    "emotion": "看狮头低垂时的视线落点，狮口收合是否缓慢而克制。",
    "motion": "留意轻鼓下的低首、缓行与驻足，看醒狮怎样收住劲力。",
    "intent": "用于理解低回与收势的视觉表达，须结合前后情节。",
    "posture": "留意低首、收口和驻足构成的内收轮廓。"
  },
  {
    "id": "delight",
    "number": "04",
    "title": "乐",
    "subtitle": "欢腾雀跃",
    "description": "醒狮仰头张口，喜乐溢出眉眼。\n摇头摆须，与锣鼓你来我往。\n腾起落下，满场都是嬉戏的趣味。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "嬉趣",
    "coordinates": "载歌载舞 · 热烈欢腾",
    "year": "定性观察",
    "images": [media.expressionDelight],
    "glyph": media.expressionGlyphDelight,
    "narration": media.depthNarrationDelight,
    "accent": "#c5a66a",
    "emotion": "看仰首时狮口的张幅，狮眼与眉梢是否形成活泼的回应。",
    "motion": "跟随快鼓观察摇头、跃动与回望，读出醒狮连续嬉戏的节奏。",
    "intent": "观察嬉趣与外放的表达；真实连续嬉戏仍需视频或现场样本。",
    "posture": "与喜态对照仰首、张口及更舒展的整体轮廓。"
  },
  {
    "id": "motion",
    "number": "05",
    "title": "动",
    "subtitle": "腾挪起势",
    "description": "醒狮侧身起势，把目光送向前方。\n狮头领动，披身随步法舒展。\n鼓催身转，腾挪之间蓄足力量。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "动势",
    "coordinates": "灵活敏捷 · 力与美结合",
    "year": "定性观察",
    "images": [media.expressionMotion],
    "glyph": media.expressionGlyphMotion,
    "narration": media.depthNarrationMotion,
    "accent": "#c5a66a",
    "emotion": "先看狮头朝向，再追踪目光，观察转身前后是否彼此衔接。",
    "motion": "沿鼓点追踪起伏与重心转移，看狮头怎样带动狮尾配合。",
    "intent": "关注动势与转向，不从静态示意推算速度、幅度或难度。",
    "posture": "先看头部朝向与侧转，再追踪前后身段的连接。"
  },
  {
    "id": "stillness",
    "number": "06",
    "title": "静",
    "subtitle": "凝神守势",
    "description": "醒狮驻足凝神，静中仍藏着气韵。\n狮目有落点，狮口微合不散神。\n锣鼓暂歇，一息之后再启新势。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "沉静",
    "coordinates": "稳如泰山 · 蓄势待发",
    "year": "定性观察",
    "images": [media.expressionStillness],
    "glyph": media.expressionGlyphStillness,
    "narration": media.depthNarrationStillness,
    "accent": "#c5a66a",
    "emotion": "看狮眼的落点是否稳定，眉眼与狮口有无细小的收放。",
    "motion": "留意驻足收势后的轻微起伏，寻找醒狮静候下一鼓的蓄势。",
    "intent": "理解驻足与蓄势；静态并不等于没有表演意图。",
    "posture": "观察视线落点与收拢轮廓，和动态的展开方向比较。"
  },
  {
    "id": "surprise",
    "number": "07",
    "title": "惊",
    "subtitle": "警觉骤起",
    "description": "醒狮忽然抬头，目光与狮口一同张开。\n白须扬起，像听见了新的动静。\n一记急鼓，惊而不乱地再探前方。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "警觉",
    "coordinates": "瞬间反应 · 机警敏锐",
    "year": "定性观察",
    "images": [media.expressionSurprise],
    "glyph": media.expressionGlyphSurprise,
    "narration": media.depthNarrationSurprise,
    "accent": "#c5a66a",
    "emotion": "看狮眼、眉梢与狮口是否同时展开，注意抬头一瞬的变化。",
    "motion": "对照急鼓中的抬头、短停与后撤，看醒狮如何转回探索。",
    "intent": "观察突发回应的视觉线索，不据单幅图认定真实受惊。",
    "posture": "比较抬头、目光展开与狮口张幅形成的警觉感。"
  },
  {
    "id": "doubt",
    "number": "08",
    "title": "疑",
    "subtitle": "探索试探",
    "description": "醒狮侧首探望，好奇里带着几分迟疑。\n一眼看去，又轻轻收回狮口。\n碎鼓试步，欲近还停地寻找答案。",
    "category": "眉眼 · 狮口 · 身段",
    "location": "探寻",
    "coordinates": "左右观望 · 小心靠近",
    "year": "定性观察",
    "images": [media.expressionDoubt],
    "glyph": media.expressionGlyphDoubt,
    "narration": media.depthNarrationDoubt,
    "accent": "#c5a66a",
    "emotion": "看狮头偏转时目光如何转移，狮口微开是否带着试探感。",
    "motion": "留意侧首、试步与停顿，观察醒狮怎样随着碎鼓欲进还停。",
    "intent": "关注试探与寻找，完整含义须结合表演的对象和情节。",
    "posture": "与惊态对照偏首、探看和欲进还停的姿态线索。"
  }
]

export const chapterIds = ['home', 'about', ...projects.map(project => project.id), 'contact']
