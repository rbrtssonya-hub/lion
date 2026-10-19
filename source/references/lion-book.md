# 《岭南醒狮志》数字史册：内容、来源与适配边界

2026-10-14，依据用户本轮“在衔接处添加书籍翻阅效果”的要求整理。实施者为 Agent。本文件记录来源及当前源码中的适配方式，不作为浏览器验收或资产交付通过记录。

## 用户目标与首页位置

- 将 ThreeUI Sketchbook 的真实 DOM + CSS 3D 翻书实现用于“南风有狮”首页，改为《岭南醒狮志》；保留纸张层级、卷曲、拖拽、弹簧动画、书籍厚度及随容器缩放的布局，不以轮播或单块平面旋转替代翻页。
- 用户参考图的绿色框位于首页视频底边与文化导言、照片轮播顶部之间。当前 `src/features/home/HomePage.jsx` 在首屏 `entry-gate` 后挂载 `HomeLionBook`，随后保留 `HomeCulture`。顶部“向下了解醒狮文化”滚动入口指向 `#homeLionBook`；“探索更多”仍进入结构页。
- 原有纵深实景照片、摄影署名与文化解读继续位于史册之后；本模块是新增的历史叙事，未将实景摄影换成生成插画。
- 视觉目标为宣纸米白、醒狮朱红、墨线与少量暖金，保持水彩手绘、纸张肌理和文献档案气质。用户给出的 50% 米白、30% 醒狮红、15% 墨黑、5% 金色是创作配色方向，不是已经测量验证的像素比例。
- 删除新加坡旅行叙事、原场景背景、植物装饰、放大镜、放大镜拖动与可选缩放控制；首页外层环境已于2026-10-14按用户新图改为连续醒狮纹样背景，并同步标题/正文层次，见 [背景与排版来源](home-archive-background.md)。书页内容和官方翻页核心保持。

## ThreeUI 版本、原始实现与许可

- npm 依赖固定为 `@designcodeio/threeui` **1.2.0**，以本项目 `package.json`、`package-lock.json` 和实际安装包为版本依据。
- 应用入口 `src/features/home/LionBookExperience.jsx` 使用用户要求的正式导入：

  ```jsx
  import { Sketchbook } from '@designcodeio/threeui';
  import '@designcodeio/threeui/style.css';
  ```

- 官方仓库：[MengTo/threeui](https://github.com/MengTo/threeui)。官方组件：[Sketchbook.tsx](https://github.com/MengTo/threeui/blob/main/src/shaders/sketchbook/Sketchbook.tsx)；官方文档生成器：[sketchbookDocument.js](https://github.com/MengTo/threeui/blob/main/src/shaders/sketchbook/sketchbookDocument.js)；生成器注明的规范原稿：[meng-to-sketchbook.html](https://github.com/MengTo/threeui/blob/main/public/landing-pages/meng-to-sketchbook.html)。以上 `main` 链接用于定位上游；后续上游变化不能替代已锁定 1.2.0 安装包的实际内容。
- 官方组件当前公开的属性只有 `assetBaseUrl`、`className`。组件通过 iframe 的 `srcDoc` 加载 `createSketchbookDocument(assetBaseUrl)` 产出的完整文档，sandbox 保持 `allow-scripts`。它没有可传入七个任意页面文件、关闭放大镜、替换页面标题或接收翻页回调的公开属性。
- 许可为 **MIT**，版权为 `Copyright (c) 2026 Meng To`。官方[完整许可证](https://github.com/MengTo/threeui/blob/main/LICENSE)已保留在本项目[部署许可证](../public/assets/licenses/threeui-LICENSE.txt)，网页页脚通过 `media.lionBookLicense` 链接该文本。上游原代码的版权与完整许可须随分发保留；不把本项目新插画标成上游原图。
- 安装包同时提供 `ASSET-LICENSES.md`、`FONT-LICENSES.md`、`THIRD_PARTY_NOTICES.md`。本模块不分发原新加坡书页、植物与背景；iframe适配文档去掉原旅行字体声明，中文阅读区使用系统衬线字体。正式导入的包级样式保持上游内容，其字体另受 SIL OFL 1.1 约束；完整[字体许可](../public/assets/licenses/threeui-FONT-LICENSES.txt)由 `media.lionBookFontLicense` 提供网页入口。七幅醒狮主题书页另按下文标明 AI 辅助创作。

## 适配方式与不重写的核心

当前代码入口：

| 文件 | 职责 |
| --- | --- |
| `src/features/home/HomeLionBook.jsx` | 首页史册标题、懒加载边界、占位与异常边界 |
| `src/features/home/LionBookExperience.jsx` | 以带通道标记的属性正式挂载 `Sketchbook`，处理通信、页码、时间线、来源和重试 |
| `scripts/lion-book-vite-plugin.mjs` | Vite局部转换锁定安装包的document工厂返回值，保留官方规范文档和样式原文 |
| `src/services/lionSketchbookFactory.js` | 识别资源URL中的史册通道标记，清理hash，再把原工厂结果交给七页适配器 |
| `src/services/lionSketchbookDocument.js` | 只适配官方产出的文档内容及可选展示功能，附加宿主通信和资源就绪观察 |
| `src/data/lion-book.js` | 七个展开页的顺序、年代、正文、文件名和来源 |
| `src/styles/lion-book.css` | 网页外层宣纸色、标题、时间线及阅读区 |
| `src/config/assetPaths.js`、`src/config/media.js` | 部署资源相对路径及 Vite 基础路径统一处理 |

现行链路在 Vite 转换阶段局部包裹官方文档工厂的返回值，让正式 React `Sketchbook` 声明的 `srcDoc` 从一开始就是醒狮史册文档，不由父页面改写 iframe 的 `srcdoc`。前期直接改写DOM属性的接入被官方组件内部 `onLoad` 更新恢复，因此改用文档工厂边界，避免与 React 对同一属性的管理冲突。

`scripts/lion-book-vite-plugin.mjs` 以 `enforce: 'pre'` 只匹配安装包中的 `lib-dist/shaders/sketchbook/sketchbookDocument.js`。它核对1.2.0版本、模块原文的SHA-256与唯一返回语句，然后包裹 `createSketchbookDocument` 的最终返回。官方 `CANONICAL_SKETCHBOOK_HTML` 字符串、其中的全部纸张/翻页/拖拽函数及官方宿主样式保留原文；没有修改 `node_modules`，没有复制重造翻书引擎。`vite.config.js` 将包排除在 `optimizeDeps` 预构建之外，使开发时也经由同一局部转换。上游模块结构或内容变化时插件拒绝静默套用。

`LionBookExperience` 由 `media.lionBookCover` 推导绝对资源目录，为本次装载生成独立通道，把 `#lion-book=CHANNEL` 放入 `assetBaseUrl` 后直接声明 `<Sketchbook assetBaseUrl={assetBaseUrl} />`。`lionSketchbookFactory.js` 仅识别该标记；提取、解码并校验通道后去掉hash，使用清理后的资源URL调用原工厂，再将原文档与真实 `lionBookPages` 交给内容适配器。标记不会进入图片请求地址；未带标记的其他 `Sketchbook` 实例继续使用原工厂结果。

父页面的 `useLayoutEffect` 绑定正式iframe的 `load`、`message`、书本容器可视性及页面焦点，设置中文标题、请求状态同步并传递播放条件，不修改 `srcdoc`，也不以 `MutationObserver` 反复回写文档。通信严格校验 `event.source` 为当前iframe的 `contentWindow`、通道一致以及页码和状态类型；重试更换通道，由 React 依据新的属性生成文档。iframe 内桥接仍有观察原引擎书本DOM与就绪标记的 `MutationObserver`，用于读取状态，不是争抢父层文档控制权。

React effect清理移除父层消息/载入监听、超时与滚动RAF；不在 StrictMode effect重放时向仍挂载的文档发 `dispose`。iframe 文档在 `pagehide` 时清理自身桥接、观察器与动画状态，文档替换或iframe销毁同时结束其浏览上下文。实际重试和离页行为已由本轮真实HTTP503恢复、翻页中退出和重入验证，具体结果见验收记录。

适配器目前明确改变以下内容或可选功能：

1. 把原新加坡 `PAGES` 与目录替换为七个醒狮主题展开页，替换标题、年代、描述和提示文本；起始页设为序卷 `LAND=0`。
2. 提取原书本及相关纸张样式、层级，移除原旅行站点的导航、正文、背景、植物和站点跳转。
3. 删除独立放大镜 DOM、样式和行为，删除可选放大、缩小、重置工具；原绘制循环中调用的可选放大镜接口仅留下空兼容函数，避免牵动翻页循环。
4. 恢复官方 `startIntro` / `riffleStep` 快翻：全部七图与引擎就绪、实际书本容器至少60%可见且页面处于前台时，延迟220ms播放一次七页快翻并回到序卷。离开视野或失焦暂停，返回接续；手动输入立即接管，不重播。遵守上游减少动态及粗指针跳过条件，不从宿主URL读取拍摄参数。
5. 添加读取已提交页码 `idx`、翻页和开场状态的通信桥。外部时间线、方向键和首尾操作先清理旧手势/动画，再调用原 `goTo` / `step`；桥接不另计算或模拟翻页进度。失焦、隐藏、指针取消/捕获丢失或尺寸变化时取消未提交拖拽；动态开启减少动态时结束在途动画，后续使用原静态提交。
6. 添加七幅图片的加载、解码、最小清晰度及宽高比检查与出错状态；就绪条件不是仅依赖 iframe 的 `load` 事件。资源以归一化纸面几何显示，允许生成工具的同比例原生尺寸。父层与iframe的清理边界见上述生命周期说明。
7. 独立投影层缩至真实纸面下方，三层椭圆渐变在嵌入区域内淡至透明，不再用越过iframe边界的模糊阴影；左右输入热区限制为纸面，透明留白不触发翻页。曲面纸条、页沟光影和SVG运动模糊定义保持上游实现。

核心仍使用官方的 `.sb-3d` / `.sb-tilt` / `.sb-book`、左右半页、`.curl` 嵌套条带、正反面、页沟阴影及光照样式；`N=18` 条带、`SPAN=0.449`、`BETA=0.60` 的曲面几何以及 `buildCurl`、`applyTurn`、`paint`、`tick`、`startTurn`、`commit`、`cancel`、`step`、`goTo` 与原 pointer 拖拽处理未用新逻辑替代。适配器包含针对安装包脚本和纸张样式的结构指纹，输入不符时拒绝适配，避免升级后静默错改。

这是真实采用上游 DOM + CSS 3D 曲面条带翻页：CSS 3D 是原系统的实现技术，不等同于用单块图片 `transform` 冒充纸张卷曲。当前电脑Chrome的实际拖拽、资源交接/退出和原模块兼容性验证见本轮验收记录；不以函数名或检查代码存在推定其他环境也通过。

## 展开页资源与纸面几何

本项目 Vite 的静态目录为 `source/public/`。运行资产使用 `source/public/assets/lion-book/`，不创建第二个根级 `public/`。组件以 `media.lionBookCover` 推导统一目录，将装载通道放在URL hash后传给 `Sketchbook.assetBaseUrl`；工厂清除该标记，再与同目录内的数据文件名拼接图片地址。所有显式部署路径集中在 `assetPaths.js`，由 `media.js` 追加 `import.meta.env.BASE_URL`。

计划的完整运行资源映射：

| 数据 id | 资源文件 | 语义 |
| --- | --- | --- |
| `cover` | `source/public/assets/lion-book/cover.png` | 展开的序卷，含书名、红金醒狮、鼓、红绸与印章 |
| `origin` | `source/public/assets/lion-book/origin.png` | 广义狮舞的瑞兽文化渊源，不画现代醒狮复原图 |
| `formation` | `source/public/assets/lion-book/formation.png` | 明清民间技艺及狮头工坊主题 |
| `martial` | `source/public/assets/lion-book/martial.png` | 武馆、狮队、红旗与红鼓主题 |
| `spread` | `source/public/assets/lion-book/spread.png` | 港口、船、海外华人街区与节庆，不用地图 |
| `modern` | `source/public/assets/lion-book/modern.png` | 青少年传承与现代城市中的醒狮 |
| `ending` | `source/public/assets/lion-book/ending.png` | 完整醒狮及品牌收束 |

`cover` 在这里指打开后可阅读的序卷，而非另做一个合上书本动画；这样进入模块即能看到打开的古籍，后续直接沿原书页翻阅。

上游 `.sb-book` 整幅画布比例为 **1760 / 1240**，书页图是含透明留白的展开书本 PNG，而非铺满画布的矩形插画。官方原稿的纸面参考边界约为归一化 `x=0.051–0.949`、`y=0.218–0.782`，书沟位于 `x=0.5`；页沟阴影上下默认留白均为 `21.8%`。`SPAN=0.449` 对应中央书沟至外侧纸边。

七幅生成书页的原生尺寸为 **1494×1052 或 1495×1052 RGBA PNG**，纵横比与上游1760/1240的差小于0.1%；保留工具输出，不将它们伪称为1760×1240，也不为满足名义尺寸做后期像素改绘。纸面采用同比例的归一化位置、中央书沟与透明留白，运行时在原书本画布中等比显示，使上游左右半页采样和18条曲面切片衔接。逐张尺寸、主体alpha边界、工具原始输出与提示词见 [lion-book-art-prompts.md](lion-book-art-prompts.md)。不得为迁就随意裁切的新图修改曲面常量，或另写一套卷曲算法；图片数值和几何约定不代替实际翻页视觉验收。

## 历史表述的边界

用户原稿把第一页定为“汉唐以前”。核查后使用 **“汉唐渊源”**：中国非遗网项目说明和相关文献研究把汉代百戏、唐代宫廷狮舞列为广义狮舞的文化渊源，并将广东狮子的文献记载置于更晚时期。不能因此宣称汉唐以前已经有今日岭南南狮，更不能将瑞兽传说图像当成史实或出土实物。

五阶段是方便翻阅的文化叙事分期，传统的形成、武术融合、传播与传承彼此延续交叠：

- “明清形成”不表示某年突然发明醒狮。中国非遗网所载谢中元研究明确指出，狮舞辗转传至广东的具体时间暂不可考；其引用明代记载说明“广东狮子”已见于文献。
- “清末民初兴盛”不表示武术融合始于清末。该研究讨论了更早的武技型狮舞及清代寓武于狮的传承。
- “20世纪传播”选择海外社群持续发展为叙事重点，不表示20世纪才首次出海。新加坡华族文化中心的材料提供1920、1939年的会馆狮团及战前战后社群活动线索；本书不虚构某次船只航行或单一首传事件。
- “现代传承”中的2006年是国家级名录公布时间，不是醒狮诞生时间，也不是所有地方狮舞项目同时入选的年份。

## 逐页正文、创作意图与证据

以下正文与当前 `src/data/lion-book.js` 对应。书页上的题名、画面和外层可选择文字共同承担叙事；插画中的场景是主题创作，不构成逐字文献复原。

### 序卷：岭南醒狮志

题句：**一狮一鼓，百年传承**

循着鼓点翻阅岭南，从瑞兽意象、纸扎匠艺，到狮武相融、越洋传艺，读一段仍在生长的文化记忆。

画面目标：红金醒狮、红绸、鼓、岭南建筑剪影与朱砂印章。文字为本项目编辑性开篇；事实背景参见[中国非遗网《狮舞（广东醒狮）》](https://www.ihchina.cn/project_details/12869.html)。

### 第一页：起源 · 瑞兽文化

年代：**汉唐渊源**

在中国传统文化中，狮子被赋予护佑与纳福的象征。汉代百戏与唐代宫廷狮舞留下早期线索，后来逐渐走入民间。这一页回望广义狮舞的文化渊源，尚不是今日岭南醒狮的形成纪年。

画面目标：水墨山水、瑞兽意象、早期民俗符号与少量朱红。避免现代醒狮、现代训练服或现代高桩；祭祀场景若出现，仅表达文化意象。

依据：[中国非遗网《狮舞（广东醒狮）》](https://www.ihchina.cn/project_details/12869.html)解释瑞兽象征及早期狮舞渊源；[谢中元《依武而传：广东醒狮的武术性传统及其城乡传承》](https://www.ihchina.cn/Article/Index/detail?id=24139)，2021-11-04，第一节讨论汉唐狮舞及后续南传。

### 第二页：南狮形成 · 民间技艺

年代：**明清时期**

明代文献已见“广东狮子”的表演记载。入清以后，狮艺在岭南城乡延续，狮头扎作也伴随舞狮发展。艺人用竹篾搭骨、纱纸塑形，再施彩装饰，让轻巧的狮头拥有鲜明神采。

画面目标：红狮头、竹骨、纱纸、颜料、木桌、工具与艺人，不虚构明确首创者。

依据：[中国非遗网《依武而传》](https://www.ihchina.cn/Article/Index/detail?id=24139)援引明代地方志及“广东狮子”记载；[广州市委党史文献研究室、广州市地方志办公室《醒狮扎作》](https://www.gzsqw.org.cn/c/sdfzpc/gfwh/2861.jhtml)，2020-09-02，介绍竹篾、纱纸、着色及清末广州扎作行业。当前数据同时提供工艺主来源和 `additionalSource`“南狮文献”链接，二者共同支撑本页。

### 第三页：武术融合 · 醒狮兴盛

年代：**清末民初**

清末民初的岭南，武馆与狮会相伴而生。工匠、商贩与乡民在习武中学狮，以稳健步法承托腾挪，以鼓乐连接彼此。狮武相融的传统，既关乎力量与技艺，也凝聚着守望相助的日常。

画面目标：武馆、双人舞狮、训练动作、红旗、红鼓与红衣，保留水彩和墨线的留白。

依据：[中国非遗网《依武而传》](https://www.ihchina.cn/Article/Index/detail?id=24139)，作者谢中元，结合文献梳理和田野访谈，分层考察清代至民国的武馆、行会、狮会、劳动者互助与城乡传承。

### 第四页：岭南传播 · 走向世界

年代：**20世纪**

醒狮随粤籍移民越洋，在海外华人社区扎根。二十世纪，新加坡的会馆与狮团持续传艺，节庆中的采青连接乡情，也孕育新的地方风格。红灯与鼓声之间，岭南狮艺成为跨越海洋的文化纽带。

画面目标：港口、船、华人街区、红灯笼和海外节庆，以连续场景表达传播，不使用地图。画面是主题归纳，不宣称记录某一历史航次。

依据：[新加坡华族文化中心“新加坡华族文化百科”《南狮》](https://culturepaedia.singaporeccc.org.sg/zh/social-practices/southern-lion-dance/)，作者李国樑，2025-12-11更新。其资料包括1920年星洲怡怡堂瑞狮团、1939年更名、战前战后会馆与社群活动，并附1950年代舞狮祭祖、1960年代采青照片；文中引用新加坡国家文物局制作的2020年影像《狮城狮艺》。本项目仅据此编辑文字，不复制这些照片作为生成插画或运行资产。

### 第五页：非遗传承 · 今日醒狮

年代：**现代**

2006年，狮舞（广东醒狮）列入首批国家级非物质文化遗产代表性项目名录。今天，青少年表演赛、校园与社区传习，让更多年轻人接过狮头与鼓槌；传统在一次次练习和协作中继续生长。

画面目标：年轻狮队、青少年传习、现代城市，红色醒狮为主体。无需以虚构人物冒充实名传承人。

依据：[中国非遗网项目名录](https://www.ihchina.cn/project_details/12869.html)列明2006年第一批、项目序号108、编号Ⅲ-5；[广州文旅局《第九届广州青少年醒狮表演赛于6月2日正式启动》](https://www.gz.gov.cn/zfjg/gzswhgdlyj/mlgz/whgz/content/post_10299678.html)，2025-06-06，为赛事主办方发布；[广州市科技局体育文化进校园报道](https://kjj.gz.gov.cn/kpzl/kphd/content/post_8791451.html)记述广州体育文化博物馆的学生互动与传习活动。当前数据提供名录主来源和 `additionalSource`“青少年传承”链接，校园活动证据在此补充。

### 终章：南风有狮

题句：**鼓声未远，狮魂长存**

翻到最后一页，传承仍未落笔。愿每一次举狮、每一次击鼓，都让旧日技艺与新的目光相逢。

画面目标：完整红色醒狮、少量金色与温润留白，收束于网站品牌。题句与短文是本项目的编辑性创作，并非历史引语；[广州青少年醒狮传承活动](https://www.gz.gov.cn/zfjg/gzswhgdlyj/mlgz/whgz/content/post_10299678.html)提供当代传承背景。

## 时间线与 AI 标注

- 五个历史节点依次为“起源 / 形成 / 兴盛 / 传播 / 传承”，序卷与终章单独显示；通过原引擎实际提交的 `idx` 同步当前页、正文和年代；2026-10-19节点/狮头改为即时反馈最新手动目标，纸面/正文仍以真实提交为准。实际纸面焦点可接管导航，见 [整改记录](2026-10-19-navigation-feedback-fixes.md)。
- 七幅插画须保留统一水彩手绘风格、纸纹与红色识别，不采用3D渲染、游戏概念图或商业海报语言。页面文字及年代应保持可辨认，正文另外以网页真文字提供。
- 统一公开标注：**“AI辅助绘制 · 历史主题示意，非文物或史料影像。年代为叙事分期，文化传承延续交叠。”** 当前 `LionBookExperience` 页脚已包含该文字；插画不是历史文物照片、考古证据或实名人物复原。
- 来源核查日为2026-10-14。实际命令、结果、资源到齐和最终截图见[本轮功能日志](../../wiki_memory/日志/功能添加/2026-10-14-岭南醒狮志真实翻页史册.md)，源码或清理接口本身不能代替运行证据。
- 同日后续的快翻恢复、阴影与稳定性修复见[修复验收日志](../../wiki_memory/日志/Bug处理/2026-10-14-书页稳定性与阴影边界修复.md)：30项资产/核心、241模块构建及电脑开发/生产各84项全部通过，四张生产预览截图归档。当前行为以上文适配说明及该修复日志为准。
