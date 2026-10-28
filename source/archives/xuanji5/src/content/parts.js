const sources = {
  heritage: { title: '中国非物质文化遗产网 · 狮舞（广东醒狮）', url: 'https://www.ihchina.cn/project_details/12869' },
  making: { title: '澳门政府新闻局 · 扎作狮头 澳门传艺', url: 'https://www.gcs.gov.mo/news/detail/zh-hans/M24AXfoWOo' },
  performance: { title: '深圳大学体育非遗 · 广东醒狮（南海醒狮）', url: 'https://fy.szu.edu.cn/fyxm/xmdq/gds/gdxs_nhxs_.htm' },
  ca青: { title: '南海博物馆 · 南海醒狮（采青技艺）', url: 'https://www.nhmuseum.org/fei-yi/1580.html' },
};

const isPart = (id, fallback) => mesh => mesh.userData.atlasPart === id || (!mesh.userData.atlasPart && fallback.test(mesh.userData.sourceName || mesh.name));

export const PARTS = [
  {
    id: 'brows', number: '01', name: '眉目', theme: '形与神', english: 'GAZE & EXPRESSION', short: '在眉弧之间，读出神态。',
    matches: isPart('brows', /Lion_Brow/), pickAliases: ['head'], plane: 'xy', axis: 'x', visualization: 'radial', cameraDirection: [0.12, 0.18, 1],
    introduction: '弧线的起伏、左右的呼应，让静止的形体也有了神态。沿着眉饰的真实轮廓，观察它如何围合视线。',
    observation: '左右眉饰是独立构件；眼部与头部主体融合。本页测量眉饰的组合包围盒与投影，不将眼球标作可分离部件。',
    culture: '睁眼、洗须、舔身、抖毛，是醒狮表演中的典型动作。形体的神态，也由舞者的身体与节奏共同唤起。',
    source: sources.heritage, capabilities: ['正交投影', '径向采样', '左右比例'],
  },
  {
    id: 'crown', number: '02', name: '额冠', theme: '纹与构', english: 'ORNAMENT & ORDER', short: '由点及面，层层成形。',
    matches: isPart('crown', /Lion_Crown|Lion_Forehead/), plane: 'xy', axis: 'y', visualization: 'structure', cameraDirection: [0.25, 0.5, 1],
    introduction: '额珠与冠饰聚拢在头部的中轴。把华丽的表面转译成中心、尺度与层级，看见装饰背后的空间秩序。',
    observation: '额冠与额珠保留独立对象。关系图取自这些真实构件的中心点及包围盒；连线表达空间关系。',
    culture: '传统狮头制作包含扎架、裱糊、彩绘与装饰等环节。形体的建立与表面的装饰，共同塑造狮头的面貌。',
    source: sources.making, capabilities: ['构件中心', '尺度对照', '空间关系'],
  },
  {
    id: 'beard', number: '03', name: '鬃须', theme: '势与流', english: 'STRANDS & FLOW', short: '一缕成线，万缕成势。',
    matches: isPart('beard', /Lion_Beard|Ivory|Beard_Hair/), plane: 'xy', axis: 'y', visualization: 'flow', cameraDirection: [0.35, 0.03, 1],
    introduction: '柔软的须饰沿脸颊垂落。把体积化作连续的宽度与重心，观察成束的线条如何形成流动的方向。',
    observation: '这里的宽度曲线来自鬃须网格的分轴采样。参数图是根据测量轮廓生成的线性推演，不是原始毛发的生长模拟。',
    culture: '醒狮将武术、舞蹈与音乐融为一体。表演中的洗须、抖毛等动作，让静态的装饰参与动态表达。',
    source: sources.heritage, capabilities: ['分轴包络', '采样质心', '流线推演'],
  },
  {
    id: 'body', number: '04', name: '织锦', theme: '纹与序', english: 'PATTERN & REPETITION', short: '一方纹样，铺展万象。',
    matches: isPart('body', /^Lion_Body(?:[._]\d+)?$/), plane: 'yz', axis: 'z', visualization: 'uv', cameraDirection: [1, 0.48, -0.15],
    introduction: '珊瑚色纹样随身体曲面铺展。将三维表面展开为二维坐标，比较图案在平面与体积之间的重复和变化。',
    observation: 'UV 散点来自当前身体网格，色板从实际贴图像素采样并按三角面积估计。平铺图用于当代图案推演。',
    culture: '彩绘与装饰是传统狮头制作的重要环节。本模型的织锦纹样属于当前数字作品，不能据此推断特定历史寓意。',
    source: sources.making, capabilities: ['UV 分布', '贴图采色', '重复推演'],
  },
  {
    id: 'trim', number: '05', name: '云边', theme: '律与形', english: 'CONTOUR & RHYTHM', short: '起伏之间，自有节律。',
    matches: isPart('trim', /Lion_Body_Red_Trim/), plane: 'yz', axis: 'z', visualization: 'wave', cameraDirection: [1, 0.36, -0.2],
    introduction: '身体边饰以连续的起伏组织轮廓。从纵向采样中读取宽度变化，再把这些变化转译成可调整的曲线语言。',
    observation: '曲线来自红色边饰网格沿身体方向的分箱外包络，不是精确截面。“云边”为本研究的造型描述，不指认传统纹样谱系。',
    culture: '狮舞的视觉形象在舞动中展开。本页讨论当前模型的轮廓节奏；曲线的振幅变化属于设计推演。',
    source: sources.heritage, capabilities: ['宽度曲线', '轴向采样', '节律重构'],
  },
  {
    id: 'mouth', number: '06', name: '口齿', theme: '开与合', english: 'FORM & ARTICULATION', short: '开合有度，形神相生。',
    matches: isPart('mouth', /上牙|牙下|立方体|Tongue|Teeth/), plane: 'xy', axis: 'y', visualization: 'articulation', cameraDirection: [0.12, -0.04, 1],
    introduction: '上牙、下牙与舌面构成口部的层次。用构件中心和相对尺度描述它们，让被表面遮挡的关系变得清晰。',
    observation: '上下牙与舌面对应原模型中的独立网格。图中的开合是几何示意，不代表模型带有绑定或表演动画。',
    culture: '传统南海醒狮的眼、耳、口可以活动，形成丰富神态。这里以数字形体研究回应这一表情特征。',
    source: sources.performance, capabilities: ['构件投影', '中心间距', '开合推演'],
  },
];

export const CULTURAL_SOURCES = Object.values(sources);
export const PALETTE_NAMES = ['绛朱', '珊瑚', '象牙', '赭金', '青碧', '墨色'];
