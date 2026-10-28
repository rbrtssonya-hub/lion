// Shared by the browser fallback and the model gateway. All answers below are
// curated from the current exhibition, not retrieved from user-supplied URLs.
// Source-to-code mapping and editorial limits: source/references/xiaoxing-knowledge.md.
const pageSources = {
  entry: { id: 'page-entry', label: '首页 · 岭南醒狮志', chapter: 'entry', section: 'homeLionBook' },
  culture: { id: 'page-culture', label: '序 · 醒狮文化与资料', chapter: 'entry', section: 'homeCultureSources' },
  types: { id: 'page-lion-types', label: '造 · 醒狮形制', chapter: 'model', section: 'modelStage' },
  sources: { id: 'page-sources', label: '序 · 参考资料与创作说明', chapter: 'entry', section: 'homeCultureSources' },
  model: { id: 'page-model', label: '造 · 醒狮部件图鉴', chapter: 'model', section: 'model-reading-panel-form' },
  modelBoundary: { id: 'page-model-boundary', label: '造 · 模型与资料说明', chapter: 'model', section: 'model-reading-panel-form' },
  action: { id: 'page-action', label: '舞 · 四面巨幕厅', chapter: 'action', section: 'actionTheater' },
  state: { id: 'page-state', label: '舞 · 八态观察', chapter: 'state', section: 'expressionObservation' },
  stateBoundary: { id: 'page-state-boundary', label: '舞 · 样本与视觉说明', chapter: 'state', section: 'chapterEvidence' },
  spread: { id: 'page-spread', label: '传 · 广东、中国与世界案例地图', chapter: 'spread', section: 'spreadStage' },
};

const references = {
  forms: { id: 'source-lion-forms', label: '新加坡武术龙狮总会 · 南狮分类形特征', chapter: 'entry', section: 'homeCultureSources', url: 'https://wuzong.com/zh-hans/lion-dance/southern-lion-classification/' },
  heshan: { id: 'source-heshan', label: '鹤山市人民政府 · 鹤山龙狮文化', chapter: 'entry', section: 'homeCultureSources', url: 'https://www.heshan.gov.cn/zwgk/xxgk/hssfzhggj/gzdt/gzdt/content/post_241842.html' },
  craft: { id: 'source-lion-craft', label: '南海博物馆 · 佛鹤狮头制作', chapter: 'entry', section: 'homeCultureSources', url: 'https://www.nhmuseum.org/fei-yi/1575.html' },
  culture: { id: 'source-lion-culture', label: '中国非物质文化遗产网 · 依武而传：广东醒狮', chapter: 'entry', section: 'homeCultureSources', url: 'https://www.ihchina.cn/Article/Index/detail?id=24139' },
};

export const chapterGuides = {
  entry: {
    title: '序 · 入境', shortTitle: '入境',
    guide: '这里是《南风有狮》的入口。先通过影像感受醒狮，再进入《岭南醒狮志》七页书册。打开“资料与许可”可查阅来源和摄影许可；序、造、舞、传可由顶栏直达。造章聚焦外形、形制与工艺，舞章呈现四段动作和八态观察，传章用广东、中国、世界三级地图查看已收录案例。书册、类型图和部分影像含 AI 辅助内容；照片保留署名与许可。',
    questions: ['这个网站可以看什么？', '在哪里查看参考资料？', '佛山狮和鹤山狮有什么区别？'],
    sources: [pageSources.entry, pageSources.types, pageSources.sources, pageSources.spread],
  },
  model: {
    title: '造 · 观形', shortTitle: '观形',
    guide: '结构页把醒狮的可见外形分成六处：彩绘狮头、鼓眼与狮眉、额饰与狮角、狮嘴、须毛与边饰、狮被与狮尾。可以拖拽旋转、滚轮缩放，点选模型上的部位或图鉴目录，让镜头聚焦并阅读形制、工艺和文化说明。当前模型支持可见结构观察，未展示内部拆装；内部骨架、活动连接和工艺只作资料说明。',
    questions: ['结构页有哪些部件？', '这个模型怎么旋转和缩放？', '这个模型可以拆开内部骨架吗？'],
    sources: [pageSources.model, pageSources.modelBoundary],
  },
  action: {
    title: '舞 · 起舞', shortTitle: '起舞',
    guide: '这里是四面巨幕动作展厅，提供探青采青、抖毛、狮子吐球、踩梅花桩四段用户提供的演示素材。可以拖拽环绕展厅、选择动作并控制当前视频播放，也可切换平面观看。观察时先看狮头朝向，再看步法、道具、落点与前后身段的衔接。这些片段用于观看与讲解，不提供自动动作识别、动作捕捉或评分。',
    questions: ['动作页有哪些视频？', '探青采青应该观察什么？', '动作展厅怎么操作？'],
    sources: [pageSources.action],
  },
  state: {
    title: '舞 · 传神', shortTitle: '传神',
    guide: '神态页提供喜、怒、哀、乐、动、静、惊、疑八种观察提示。点击左侧目录，或在主狮头处使用滚轮、方向键与前后箭头切换；点击狮头能阅读眉眼、狮口、身段、步法和鼓点的观察引导，也可以比较喜与乐、惊与疑、动与静。图像为 AI 辅助视觉，八态属于本项目的定性观察框架，仍等待真实图片或视频样本校核，不构成情绪识别或评分。',
    questions: ['醒狮八态有哪些？', '喜与乐有什么不同？', '这些神态图片是真实表演照片吗？'],
    sources: [pageSources.state, pageSources.stateBoundary],
  },
  spread: {
    title: '传 · 狮行远方', shortTitle: '狮行远方',
    guide: '传章地图分广东、中国、世界三个层级：广东层看广州与佛山，中国层看广东与香港，世界层展开五地八幅已收录实景。点选地点可阅读照片、拍摄年份、摄影者、许可与案例说明。地图只是已收录案例的空间索引；拍摄年份不表示传播先后，也不代表完整传播史或全球覆盖率。',
    questions: ['地图怎么从广东看到中国和世界？', '传章地图有哪些案例？', '地图地点和照片怎么查看？'],
    sources: [pageSources.spread],
  },
};

const fact = (id, chapter, title, questions, keywords, answer, sources) => ({ id, chapter, title, questions, keywords, answer, sources });

export const knowledgeEntries = [
  ...Object.entries(chapterGuides).map(([chapter, guide]) => fact(
    `guide-${chapter}`, chapter, guide.title, [`介绍${chapter === 'entry' ? '首页' : `${guide.title.split(' · ')[0]}页`}`, `讲解${chapter === 'entry' ? '首页' : `${guide.title.split(' · ')[0]}页`}`],
    [`${guide.title.split(' · ')[0]}页讲解`, `${guide.shortTitle}章节`], guide.guide, guide.sources,
  )),
  fact('site-tour', 'entry', '怎样参观《南风有狮》',
    ['这个网站可以看什么？', '这个网页怎么逛？', '怎么参观这个作品？', '醒狮网页有哪些内容？'],
    ['南风有狮', '网站介绍', '网页介绍', '参观路线', '四章', '四个章节', '网页内容', '网站内容'],
    '《南风有狮》按“序 → 造 → 舞 → 传”展开：首页以影像和七页书册入境，来源与照片许可在辅助对话框中查阅；造章呈现可旋转的醒狮模型、形制和工艺线索；舞章安排四段动作与八态观察；传章用广东、中国、世界三级地图索引现有案例。各章可以直接跳转。',
    [pageSources.entry, pageSources.model, pageSources.action, pageSources.state, pageSources.spread]),
  fact('lion-culture', 'entry', '从展览认识广东醒狮',
    ['什么是醒狮？', '醒狮是什么？', '你知道醒狮吗？', '广东醒狮有什么文化特点？'],
    ['什么是醒狮', '醒狮是什么', '醒狮文化', '广东醒狮', '岭南风土'],
    '在这个展览里，广东醒狮通过狮头、狮被、两位舞者和锣鼓的配合呈现。网页从岭南风土、武术功架、狮头制作、采青和技艺传承几个方向介绍它。可以在造章的形制页签比较佛山狮、鹤山狮与佛鹤融合形制，再结合动作视频观察舞者怎样让器物获得神采；本地讲解资料不据传说确定单一创始年份。',
    [pageSources.culture, references.culture]),
  fact('lion-types', 'entry', '佛山狮与鹤山狮怎样比较',
    ['佛山狮和鹤山狮有什么区别？', '醒狮有哪些流派？', '佛山狮与鹤山狮的差别是什么？'],
    ['佛山狮和鹤山狮', '佛山狮与鹤山狮', '流派', '狮种区别', '形制对照'],
    '网页把佛山狮与鹤山狮作为传统流派介绍。佛山狮重视腰马功架、力量、采青与破阵；鹤山狮以狮形猫步见长，注重情节、神态和鼓法的配合。佛鹤狮则作为融合形制单独说明。比较时要结合额形、眉眼、狮口以及完整表演，不凭颜色或一处细节作通用鉴定。',
    [pageSources.types, references.forms, references.heshan]),
  fact('foshan', 'entry', '佛山狮的观察线索',
    ['佛山狮有什么特点？', '介绍一下佛山狮'], ['佛山狮特点', '佛山狮', '腰马', '功架', '破阵'],
    '佛山狮的形貌强调威武神采，表演重视腰马功架、力量、采青与破阵。网页建议从额形、眉眼、狮口的组合和完整表演观察，不凭某种颜色或单一细节判定流派；页面类型图是概括性的 AI 辅助示意。',
    [pageSources.types, references.forms]),
  fact('heshan', 'entry', '鹤山狮的观察线索',
    ['鹤山狮有什么特点？', '什么是狮形猫步？'], ['鹤山狮特点', '鹤山狮', '狮形猫步', '猫步'],
    '鹤山狮以狮形猫步见长，将猫的灵敏融入狮子的神态，狮头造型、舞步和鼓法相互配合。静态类型图只能帮助观察额部、眼形、狮口等外观，真实步法和鼓点配合仍要结合连续表演理解。',
    [pageSources.types, references.heshan, references.forms]),
  fact('fut-hok', 'entry', '佛鹤狮属于融合形制',
    ['佛鹤狮是第三个传统流派吗？', '佛鹤狮是什么？', '什么是佛鹤狮？'], ['佛鹤狮', '第三个传统流派', '融合形制', '佛装鹤装'],
    '佛鹤狮兼取佛装与鹤装特点，在保留鲜明彩绘和夸张神采的同时改进轻便、耐用等制作需求。网页将它称作“融合形制”，不称第三个传统流派。相关制作改进与现代高桩表演需求相联系，也不意味着所有高桩醒狮都使用佛鹤狮头。',
    [pageSources.types, references.craft]),
  fact('lion-craft', 'entry', '狮头制作的工艺线索',
    ['狮头是怎样制作的？', '狮头用什么材料做的？', '什么是扎扑画装？'], ['狮头制作', '狮头材料', '狮头工艺', '扎扑画装', '竹篾', '裱纸'],
    '网页用“扎、扑、画、装”帮助理解狮头工艺：搭出轻量骨架，裱纸修形，彩绘，再装配整理绒毛与饰件。传统材料可涉及竹篾、纸层、颜料和绒毛，具体材料与做法随师傅、工坊和形制变化。狮头照片与外部模型不能证明某件实物的内部工序，结构页的内骨架内容属于资料说明。',
    [pageSources.culture, pageSources.modelBoundary, references.craft]),
  fact('culture-team', 'entry', '两个人与锣鼓的配合',
    ['一头醒狮由几个人表演？', '醒狮为什么需要两个人配合？', '锣鼓在醒狮里有什么作用？'],
    ['两个人', '双人配合', '锣鼓', '鼓点', '头尾配合', '狮队'],
    '网页通过文化照片介绍两位表演者合作完成一头狮子：先辨认狮头与后身，再观察方向、支点、步法和前后身段怎样连成整体。场外锣鼓与狮队也是演出的一部分。鼓点能帮助观众观察停顿、发力和身段节奏；单张照片不能用于判断动作难度或得分。',
    [pageSources.culture, references.culture]),
  fact('content-sources', 'entry', '网页资料与图像来源',
    ['网页资料从哪里来？', '这些图片都是AI生成的吗？', '在哪里查看参考资料？'],
    ['参考资料', '资料来源', '摄影署名', '图片来源', '图像说明', 'ai生成'],
    '首页“资料与许可”对话框列出内容来源、摄影署名与许可。文化照片保留各自的作者和许可；书册水彩、类型图与神态图属于 AI 辅助示意，不能作为历史、实物鉴定或真实神态样本的证据。神态观察说明也保留“等待真实图片/视频样本校核”的状态。',
    [pageSources.sources, pageSources.stateBoundary]),
  fact('structure-parts', 'model', '六处可见部件',
    ['结构页有哪些部件？', '醒狮狮头有哪些结构？', '这个狮子分成哪几部分？'],
    ['六个部件', '六处部件', '狮头结构', '醒狮结构', '结构部件'],
    '观形图鉴有眉目、额冠、鬃须、织锦、云边、口齿六个入口。点选模型可见部位或底部图标，镜头会走近相应位置，再转为艺术图版；点击右侧信息图可打开文化讲解。图版属于AI辅助造型转译，内部骨架和实际活动连接未在模型中展开。',
    [pageSources.model, pageSources.modelBoundary]),
  fact('structure-controls', 'model', '旋转、缩放与点选模型',
    ['这个模型怎么旋转和缩放？', '结构页怎么操作？', '我想转一转这个狮头，怎么操作？'],
    ['旋转', '缩放', '转一转', '滚轮', '点选模型', '聚焦', '复原视角'],
    '在观形整体模型上拖拽可以旋转视角，滚轮可以缩放。点选可见部位或底部六个图标，会运镜并切换为艺术图版；点击右侧信息图可打开文化讲解。左右方向键切换部位，返回整体恢复模型，整体右下角可还原视角。模型或图版载入失败时有明确反馈和重试入口。',
    [pageSources.model]),
  fact('model-reading-tabs', 'model', '造章的三个阅读页签',
    ['造章有哪些页签？', '形制和工艺在哪里查看？', '在哪里看佛山狮和鹤山狮对照？'],
    ['观形', '形制', '工艺', '阅读页签', '三个页签'],
    '造章当前分为“观形、形制、工艺”三个页签：观形显示可交互模型和部件图鉴，形制对照佛山狮、鹤山狮与佛鹤融合形制，工艺呈现有来源的扎、扑、画、装线索和完成品实景。',
    [pageSources.types, pageSources.model]),
  fact('model-boundary', 'model', '模型展示的范围',
    ['这个模型可以拆开内部骨架吗？', '能不能演示内部拆装？', '这是物理仿真或数字孪生吗？'],
    ['内部骨架', '内部拆装', '内部结构', '拆开', '拆解', '爆炸图', '物理仿真', '数字孪生', '实际活动连接'],
    '当前页面来自用户提供的 Blender 醒狮模型，支持点选和聚焦可见结构，未展示内部拆装。纸扎内骨架、活动连接和制作工艺仅作资料说明；可见部件或语义热点不等于真实机构仿真，也不能据此判断实物的装配与运动方式。',
    [pageSources.modelBoundary]),
  fact('eyes-role', 'model', '鼓眼与狮眉',
    ['醒狮的眼睛和眉毛有什么作用？', '狮眼会自己动吗？'],
    ['鼓眼', '狮眉', '眉眼', '眼睛', '眼睑'],
    '放大的鼓眼、狮眉与头部朝向共同建立醒狮的注视方向，帮助观众读出警觉、探看和回应。结构页可以点选观察眉眼，但没有演示实物眼球的独立开合；具体活动连接要以实际狮头为准。想看神态线索，可以继续去“神态”页比较眉眼、狮口与姿态。',
    [pageSources.model, pageSources.state]),
  fact('mouth-role', 'model', '狮嘴与表演神态',
    ['醒狮的嘴巴有什么作用？', '狮口为什么要开合？'], ['狮嘴', '狮口', '嘴巴', '口部开合'],
    '狮嘴的可见轮廓和开合幅度是观众阅读醒狮神态的线索，仍要与头部方向、身段和表演情节一起看。结构页介绍外观与资料整理，实际的活动连接以具体狮头实物为准；“神态”页的嘴部描述则属于定性观察引导。',
    [pageSources.model, pageSources.stateBoundary]),
  fact('ornaments-role', 'model', '额饰、狮角与须毛',
    ['额饰和狮角是做什么的？', '狮子的须毛有什么作用？'],
    ['额饰', '狮角', '须毛', '绒毛', '边饰', '狮被', '狮尾'],
    '额饰与狮角、须毛与边饰、狮被与狮尾都是结构图鉴的可见观察对象。它们通过彩绘、层次和轮廓参与醒狮的视觉识别，舞动时也让方向与整体身段更容易被看见。各部件的材料与工艺须结合图鉴说明及具体狮头，不用一种外观概括所有流派或年代。',
    [pageSources.model]),
  fact('action-overview', 'action', '四段动作演示',
    ['动作页有哪些视频？', '醒狮动作有哪些？', '有哪些动作可以看？'],
    ['四段视频', '动作视频', '醒狮动作', '动作演示', '四个动作'],
    '动作页当前提供四段用户提供的演示素材：探青采青、抖毛、狮子吐球、踩梅花桩。四个巨幕分别对应这些片段，可以切换动作、拖拽环绕观看，也可用平面模式阅读视频。它们用于演示和观察，页面没有量化动作难度或给分。',
    [pageSources.action]),
  fact('action-controls', 'action', '怎样使用动作展厅',
    ['动作展厅怎么操作？', '四面巨幕怎么观看？', '怎么切换动作视频？'],
    ['动作展厅', '四面巨幕', '切换视频', '动作播放', '平面观看', '环绕', '全屏'],
    '在四面巨幕厅中拖拽可环绕观察，点选动作入口可把视角转向相应巨幕并切换当前片段。当前动作有播放、暂停和声音控制，也可以切换平面观看及全屏。这里的环绕指三维展厅视角，不能将四个平面视频称为 360° 全景视频。',
    [pageSources.action]),
  fact('action-tanqing', 'action', '探青采青怎么看',
    ['探青采青应该观察什么？', '采青是什么？', '探青和采青有什么关系？'],
    ['探青采青', '采青', '探青', '察青'],
    '这段演示先察青、探青，再靠近低头，最后将青采起。建议先看狮头怎样朝向目标，再看步法如何配合靠近与低头。完整采青要结合连续表演和叙事情节理解，单个瞬间不能代表整套套路或难度。',
    [pageSources.action, pageSources.culture]),
  fact('action-doumao', 'action', '抖毛怎么看',
    ['抖毛应该观察什么？', '抖毛是什么动作？'], ['抖毛', '抖动', '蓄势发力'],
    '抖毛演示中，狮头随节奏左右摆转，狮身毛饰一同抖动。可以把观察分成蓄势、发力、定势三个时刻，留意狮头方向、毛饰和身段怎样连接；页面讲解不据片段计算发力大小、速度或比赛得分。',
    [pageSources.action]),
  fact('action-tuqiu', 'action', '狮子吐球怎么看',
    ['狮子吐球应该观察什么？', '想看狮子吐球的那一段，应该看什么？'], ['狮子吐球', '吐球', '落球', '绣球'],
    '狮子吐球演示中，红金绣球从狮口落下，醒狮随即低头与球互动。观看时可以追踪“狮口—绣球—落点”，再看狮头、道具与视线如何配合。这是对当前演示画面的观察，不推定所有流派采用相同套路。',
    [pageSources.action]),
  fact('action-meihuazhuang', 'action', '踩梅花桩怎么看',
    ['踩梅花桩应该观察什么？', '高桩醒狮怎么看？'], ['踩梅花桩', '梅花桩', '高桩', '落桩', '重心'],
    '踩梅花桩演示中，醒狮在红金高桩间跨步、落步，并调整身体保持平衡。建议关注落点与重心的衔接、头尾的配合。当前页面不根据画面判定动作难度或比赛得分；高桩是一种表演形式，也不能直接当作狮种流派分类。',
    [pageSources.action, pageSources.types]),
  fact('spread-map-levels', 'spread', '广东、中国与世界三级地图',
    ['地图怎么从广东看到中国和世界？', '传章地图有哪些案例？', '地图地点和照片怎么查看？'],
    ['广东中国世界三级地图', '三级地图', '案例地图', '地图地点', '五地八幅实景', '传播地图'],
    '传章地图分广东、中国、世界三个层级：广东层看广州与佛山，中国层看广东与香港，世界层展开五地八幅已收录实景。点选地点可看照片、拍摄年份、摄影者、许可与案例说明。地图只是案例索引；拍摄年份不表示传播先后，也不代表完整传播史或全球覆盖率。',
    [pageSources.spread]),
  fact('eight-states', 'state', '八态有哪些',
    ['醒狮八态有哪些？', '八种神态分别是什么？', '神态页有哪八态？'], ['醒狮八态', '八态', '八种神态', '喜怒哀乐动静惊疑'],
    '本项目的八态依次是喜、怒、哀、乐、动、静、惊、疑。它们帮助观众从眉眼、狮口、头部朝向、身段和鼓点寻找观察线索。八态是本项目的定性观察框架，不宣称所有流派都采用同一分类；AI 辅助示意图仍等待真实图片或视频样本校核。',
    [pageSources.state, pageSources.stateBoundary]),
  fact('state-ai-boundary', 'state', '神态图像与样本状态',
    ['这些神态图片是真实表演照片吗？', '神态页的图片是AI画的吗？', '八态已经验证了吗？'],
    ['真实表演照片', '真实照片', '真实样本', '样本校核', 'ai画', 'ai辅助视觉', '神态图片', '八态验证'],
    '神态页使用按用户八态参考图进行 AI 辅助提取和补全的示意图，配套文字是定性观察提示。它们仍等待真实图片或视频样本校核，不是经过真实表演验证的八套照片，也不构成情绪识别或评分。理解表演还需要前后情节、锣鼓、身段和连续动作。',
    [pageSources.stateBoundary, pageSources.sources]),
  fact('joy-delight', 'state', '喜与乐怎样对照',
    ['喜与乐有什么不同？', '喜和乐怎么区分？', '喜与乐到底有什么不同呀'],
    ['喜与乐', '喜和乐', '喜态', '乐态'],
    '在本项目的观察框架中，“喜”偏向含蓄的欢喜与迎人回应，可留意轻抬头、舒展轮廓和轻启狮口；“乐”偏向外放的嬉趣，可比较仰首、较大的张口和更舒展的整体起伏。这是对照观看的提示，不能据一张示意图认定真实表演情绪。',
    [pageSources.state, pageSources.stateBoundary]),
  fact('surprise-doubt', 'state', '惊与疑怎样对照',
    ['惊与疑有什么不同？', '惊和疑怎么区分？'], ['惊与疑', '惊和疑', '惊态', '疑态'],
    '“惊”的观察提示是抬头、目光展开和狮口张幅形成的警觉感；“疑”可以留意偏首、探看和欲进还停的试探。两者的完整含义都须结合表演对象、情节、鼓点和前后动作。页面图像是 AI 辅助示意，不据单幅图判断真实受惊或心理状态。',
    [pageSources.state, pageSources.stateBoundary]),
  fact('motion-stillness', 'state', '动与静怎样对照',
    ['动与静有什么不同？', '静态就是没有动作吗？'], ['动与静', '动和静', '动态', '静态', '动势', '驻足'],
    '“动”先看狮头朝向、侧转和前后身段的连接；“静”可看视线落点、收拢轮廓与驻足蓄势。静并不等于没有表演意图。页面只是定性观察提示，不能从静态示意推算速度、幅度或难度。',
    [pageSources.state, pageSources.stateBoundary]),
  fact('recognition-boundary', 'state', '识别与评分的边界',
    ['这个网站能识别情绪或给动作打分吗？', '这个能打分吗？', '能识别情绪吗？', '可以评分吗？'],
    ['情绪识别', '动作识别', '识别情绪', '自动识别', '自动评分', '动作打分', '评分', '打分', '动作捕捉'],
    '本项目提供动作演示与神态的定性观察，不提供自动情绪识别、动作识别、动作捕捉或评分。神态图像属于 AI 辅助视觉，仍等待真实图片或视频样本校核。若要了解具体赛事评分，需要另外确认赛事、年份、项目和正式规则来源，不能用网页示意替代。',
    [pageSources.stateBoundary, pageSources.action]),
  fact('state-controls', 'state', '怎样切换与解读神态',
    ['神态页怎么操作？', '怎么切换八态？', '怎么查看神态解读？'],
    ['切换八态', '切换神态', '神态解读', '神态操作', '点击狮头', '神态对照'],
    '点击左侧神态目录、主狮头上方与下方的箭头，或在主狮头区域使用滚轮，可以切换八态；聚焦后也能用方向键操作。点击完整狮头会展开神态解读，阅读眉眼、狮口以及鼓点、身段和步法提示。对照模式可比较喜与乐、惊与疑、动与静。',
    [pageSources.state]),
];

const normalize = value => typeof value === 'string'
  ? value.slice(0, 1200).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '') : '';
const canonicalChapter = chapter => Object.hasOwn(chapterGuides, chapter) ? chapter : 'entry';
const cloneSources = sources => sources.map(source => ({ ...source }));
const genericKeywords = new Set([
  '四章', '四个章节', '参观路线', '流派', '腰马', '功架', '破阵', '猫步',
  '旋转', '缩放', '滚轮', '聚焦', '眼睛', '嘴巴', '绒毛', '边饰', '额饰',
  '内部骨架', '内部结构', '内部拆装', '拆开', '拆解', '爆炸图', '物理仿真', '数字孪生', '实际活动连接',
  '动态', '静态', '动势', '驻足', '评分', '打分', '自动识别', '自动评分', '情绪识别', '识别情绪', '动作识别', '动作捕捉',
  '参考资料', '资料来源', '图片来源', '图像说明', '真实照片', '真实样本', '样本校核',
  '全屏', '环绕', '切换视频', '抖动', '重心', '绣球', 'ai生成', 'ai画',
]);
const domain = /醒狮|舞狮|狮头|狮口|狮子|佛山狮|鹤山狮|佛鹤狮|采青|抖毛|吐球|梅花桩|八态|广东|中国|世界|地图|案例|网页|网站|本页|这一页|这个作品|这件作品|展厅|巨幕|本项目/;
export function isLionSiteQuestion(question) { return domain.test(normalize(question)); }
// A topic name alone is not evidence for a requested price, exact date, score,
// rule number or medical claim. This small corpus does not contain those facts.
const uncoveredIntent = /多少钱|售价|价格|购买|哪里买|怎么买|哪(?:一)?年|哪个朝代|起源|创始|发明|第[一二三四五六七八九十0-9]+条|评分标准|比赛规则|赛事规则|多少分|得几分|得分是多少|医学|治疗|能治|联系方式|电话号码|统计数据|多少度|角度是多少|关节|膝盖|体重|重量|多重|几公斤|几厘米|多少厘米|一天吃|吃多少|喂养|食谱|眼睛.*(?:蓝色|绿色|紫色)|颜色.*(?:含义|意义|代表|原因)|为什么.*(?:蓝色|黄色|红色)/;
const bigrams = value => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2)));

function guideIntent(question, chapter) {
  const query = normalize(question);
  if (/^(?:请|帮我|给我|小醒)?(?:讲解|介绍|讲讲|导览)(?:一下|下)?(?:本页|当前页|这一页|这个页面)$/.test(query)) return canonicalChapter(chapter);
  if (/(?:讲解|介绍|讲讲|导览)/.test(query)) {
    for (const [route, name] of [['entry', '首页'], ['model', '结构页'], ['action', '动作页'], ['state', '神态页'], ['spread', '地图页'], ['spread', '传章']]) if (query.includes(name)) return route;
  }
  return null;
}

export function getChapterGuide(chapter) {
  const guide = chapterGuides[canonicalChapter(chapter)];
  return { answer: guide.guide, sources: cloneSources(guide.sources), mode: 'local' };
}

export function getSuggestedQuestions(chapter) {
  return [...chapterGuides[canonicalChapter(chapter)].questions];
}

export function retrieveKnowledge(question, chapter, limit = 3) {
  const query = normalize(question);
  const count = Number.isFinite(limit) ? Math.min(8, Math.max(0, Math.floor(limit))) : 3;
  if (!query || !count) return [];
  if (uncoveredIntent.test(query)) return [];
  const guide = guideIntent(question, chapter);
  if (guide) return knowledgeEntries.filter(entry => entry.id === `guide-${guide}`);
  const pairs = bigrams(query);
  const hasDomain = domain.test(query);
  return knowledgeEntries.map(entry => {
    let score = 0;
    let exact = false;
    let bestSimilarity = 0;
    for (const questionVariant of entry.questions) {
      const candidate = normalize(questionVariant);
      if (query === candidate) { score = Math.max(score, 100); exact = true; }
      const matches = [...bigrams(candidate)].filter(pair => pairs.has(pair)).length;
      const similarity = matches / Math.max(pairs.size, bigrams(candidate).size, 1);
      if (matches >= 3 && similarity >= 0.48) bestSimilarity = Math.max(bestSimilarity, similarity);
    }
    let specificKeyword = false;
    for (const keyword of entry.keywords) {
      const token = normalize(keyword);
      if (!query.includes(token)) continue;
      if (!genericKeywords.has(token)) specificKeyword = true;
      score += Math.min(16, token.length * 2);
    }
    if (!exact && !hasDomain && !specificKeyword && bestSimilarity < 0.65) return { entry, score: 0 };
    score += bestSimilarity * 16;
    if (score > 0 && entry.chapter === canonicalChapter(chapter)) score += 0.2;
    return { entry, score };
  }).filter(item => item.score >= 4).sort((a, b) => b.score - a.score).slice(0, count).map(item => item.entry);
}

export function answerLocally(question, chapter) {
  const query = normalize(question);
  const guide = !uncoveredIntent.test(query) && guideIntent(question, chapter);
  if (guide) return getChapterGuide(guide);
  const entry = retrieveKnowledge(question, chapter, 1)[0];
  if (entry) return { answer: entry.answer, sources: cloneSources(entry.sources), mode: 'local' };
  const current = chapterGuides[canonicalChapter(chapter)];
  return {
    answer: query
      ? `这项内容暂未收录在小醒的讲解资料中。我可以先带你阅读“${current.title}”，也可以试试下方推荐问题；涉及具体历史、实物或赛事规则的结论，需要另核对可靠来源。`
      : `你可以问我当前章节怎么看，或点“讲解本页”，一起阅读“${current.title}”。`,
    sources: cloneSources(current.sources.filter(source => source.chapter === canonicalChapter(chapter))),
    mode: 'local', reason: query ? 'not-in-knowledge' : 'empty-question',
  };
}
