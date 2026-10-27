export const lionHeadCraftStages = [
  {
    id: 'zha',
    step: '扎',
    title: '竹篾立骨',
    subtitle: '先有骨架，才有狮的轮廓',
    text: '将竹篾扎成狮头骨架，让眉眼、额头与狮嘴的轮廓逐渐立起。',
    materials: '竹篾 · 扎结材料',
    observation: '看竹篾的弧线怎样撑起狮头的体积。',
    photo: {
      mediaKey: 'craftFrame', width: 1536, height: 1024,
      alt: '扎工序示意：双手在工作台上绑扎竹篾狮头骨架，竹篾交织形成眉眼与狮嘴轮廓',
      caption: '扎 · 从交织的竹篾，立起狮头的骨架。',
    },
  },
  {
    id: 'pu',
    step: '扑',
    title: '覆纸成胚',
    subtitle: '一层层覆裱，骨架有了表面',
    text: '在骨架上覆纱、纸或布，逐步形成狮胚，让起伏的轮廓连成完整表面。',
    materials: '纱 · 纸或布 · 浆糊',
    observation: '看覆盖材料如何贴合骨架的曲面。',
    photo: {
      mediaKey: 'craftPaper', width: 1536, height: 1024,
      alt: '扑工序示意：双手在竹篾狮头骨架上覆裱浅色纱纸，狮头逐渐形成未上色的纸胚',
      caption: '扑 · 纱纸覆上骨架，轮廓连成狮胚。',
    },
  },
  {
    id: 'hua',
    step: '画',
    title: '落笔生彩',
    subtitle: '色彩与纹样，把神采留在眉眼',
    text: '待狮胚干燥后描绘色彩与纹样，眉眼、额头和面颊的神采随笔触显现。',
    materials: '颜料 · 画笔 · 干燥狮胚',
    observation: '看线条和色块如何强调眉眼表情。',
    photo: {
      mediaKey: 'craftPaint', width: 1536, height: 1024,
      alt: '画工序示意：手持画笔在干燥的狮头纸胚上描绘红金色彩与眉眼纹样，尚未安装绒毛',
      caption: '画 · 色彩与纹样，描出一头狮的神采。',
    },
  },
  {
    id: 'zhuang',
    step: '装',
    title: '添饰成狮',
    subtitle: '毛绒与镜饰，收住最后的神气',
    text: '为彩绘狮头装上绒毛、绒球、镜饰等配件，丰富质感，完成外观装饰。',
    materials: '绒毛 · 绒球 · 镜饰',
    observation: '看毛绒与饰件怎样衬托彩绘轮廓。',
    photo: {
      mediaKey: 'craftFinish', width: 1536, height: 1024,
      alt: '装工序示意：双手给已彩绘的红金狮头安装白色绒毛与装饰，额头可见镜饰和绒球',
      caption: '装 · 毛绒与饰件相合，完成狮头外观。',
    },
  },
];

export const lionHeadCraftSources = [
  { label: '南海博物馆 · 佛鹤狮头制作', url: 'https://www.nhmuseum.org/fei-yi/1575.html' },
];

export const lionHeadCraftNote = '四工序概念示意，具体做法随师傅与工坊而异；非实拍，非技术操作标准。';
