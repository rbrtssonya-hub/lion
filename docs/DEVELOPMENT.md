# 工程开发说明

本页说明日常开发方式；当前进度和验证结果由 [工程记忆](../wiki_memory/README.md) 维护。

自2026-10-14起，后续开发与验收仅以电脑端为目标，不考虑手机端适配或专项手机回归；既有手机相关代码与历史验证不作为本轮验收范围。

## 环境与运行

在根目录运行 `npm ci` 安装锁定版本，再运行 `npm run dev`。Vite 使用根 `index.html`，生产构建输出到独立 `dist/`，不会覆盖源码或创作资源。

Windows 用户安装 Node.js 并完成 `npm ci` 后，可双击根 [runStart.cmd](../runStart.cmd)。它使用 `%~dp0` 定位脚本所在目录，再执行 `npm run dev -- --open`；无需从特定终端目录启动。

```powershell
npm ci
npm run dev
npm run build
npm run preview
```

需要局域网访问时，可运行 `npm run dev -- --host 0.0.0.0`，访问终端显示的网络地址。预览服务器用于本地验收；部署目标、域名与托管环境仍待确认。

## 代码边界

首页首屏之后的 `.home-archive-scene` 为书册及文化图鉴共用用户醒狮纹样背景，两区透明，不叠加旧米纸底和整页滤镜。资源集中配置为 `homeArchiveBackground`，按文档基址转绝对URL；书页本身和官方引擎不变。标题/正文使用完整系统字体回退，醒狮/云纹装饰复用现有透明狮头及原生SVG，来源见 [背景与文字排版](../source/references/home-archive-background.md)。电脑宽度、900px推开和原交互由 `tests/e2e/home-archive-visual.spec.js` 及既有史册/文化回归覆盖。

| 目录或入口 | 维护内容 |
| --- | --- |
| `src/main.jsx` | 挂载 React 与加载全局样式 |
| `src/App.jsx` | 页面组合、章节切换与延迟加载边界 |
| `src/features/home/` | 首页入场/循环视频、岭南醒狮史册、文化图鉴、探索更多跳转与向下文化入口 |
| `src/features/model/` | 整体模型页、同页结构示意与信息面板 |
| `src/features/action/` | 动作首屏、四段长页、共享阶段时间轴与独立媒体播放器 |
| `src/features/chapters/` | 动作/神态挂载入口与神态八态交互图鉴 |
| `src/features/developer-settings/` | 顶栏/侧栏参数、浏览器持久化与推开布局 |
| `src/features/navigation/` | 图标展开/向右收拢、曲线变速与动画清理 |
| `src/components/` | 共用品牌狮头、章节导航、视频舞台、图片标题动效 |
| `src/hooks/` | 浏览器地址与 React 状态衔接 |
| `src/services/lionScene.js` | Three.js 场景、模型加载、图形资源与释放逻辑 |
| `src/config/` | 媒体文件路径、Vite 基址适配与章节元数据 |
| `src/data/` | 经来源说明约束的应用数据 |
| `src/styles/` | 全局、首页、模型、章节样式 |

React 负责页面生命周期、热点与信息面板状态，场景服务通过容器接入 Three.js。进入模型页面时才加载相关模块；退出时调用服务释放逻辑。修改场景时检查 resize、指针事件、`requestAnimationFrame`、renderer、几何与材质的清理，避免来回切换章节后累积资源。

首页由 `useEntryPlayback` 管理入场和循环视频：浏览会话首次进入首页播放入场短片，结束、跳过或错误时继续均回到首页循环视频。`sessionStorage` 的 `nanfeng-lion:intro-seen:v1` 防止返回或刷新自动重复，存储不可用时保留当前页面生命周期内的回退；“重播入场”显式重播。`IntroPage` 已移除，视频切换、错误提示和离页暂停由 `VideoStage` 负责。

首屏与原照片图鉴之间新增《岭南醒狮志》，向下文化入口先抵达史册。`HomeLionBook` 在实际进入视口后加载官方 `@designcodeio/threeui@1.2.0` 的 `Sketchbook` 和共享样式；`LionBookExperience` 负责七页时间线、正文、来源、加载失败重试及宿主通信。`lionSketchbookDocument` 只更换上游文档的内容与可选功能，原18层曲面纸条、光影、拖拽和弹簧翻页保留，未另写翻页引擎。书页与内置imagegen完整提示词见 [史册来源](../source/references/lion-book.md) 和 [插画记录](../source/references/lion-book-art-prompts.md)。

书本容器至少60%可见、七图与引擎就绪并处于前台后，桥接延迟220ms启动官方七页快翻，最终回序卷。快翻资格由宿主通过 `intro-policy` 提供，只有实际开始或用户主动接管才写入独立sessionStorage键 `nanfeng-lion:book-intro-seen:v1`；返回首页、同会话刷新与新iframe不重播，未看见/加载失败不提前消费。存储不可用时模块内存保证当前页面跨路由不重复，不能跨整页刷新保存。滚出视野仍暂停保留进度，减少动态跳过开场；StrictMode重复握手不打断已开始的同一序列。桥接收敛时间线/键盘交接，取消失焦、尺寸变化或指针中断中的未提交拖拽。真实纸面之外不接收翻页；书下投影及照片氛围在自身边界前淡出，保持原曲面/物理引擎。

七幅PNG位于 `source/public/assets/lion-book/`，保持原画布归一化书页位置、中央书脊和透明留白；不要把插画满铺或随意裁掉留白，否则会破坏曲面纹理对齐。实际生成尺寸为1494/1495×1052，与原1760/1240比例一致；资源就绪检查验证全部七页解码及比例，不能仅凭iframe加载事件显示成功。古代渊源与南狮形成纪年分开表述，AI插画明确为历史主题示意。新增史册回归在 `tests/e2e/lion-book.spec.js`，修改时覆盖真实拖拽的卷曲/取消/提交、时间线同步、首次加载、错误重试、滚轮、章节退出重入和电脑侧栏推开。

`scripts/lion-book-vite-plugin.mjs` 只包裹锁定版本的官方文档工厂返回值，校验其完整源SHA256；`lionSketchbookFactory` 从 `assetBaseUrl` 的 `#lion-book=通道` 取出通信通道，清除hash后生成本地醒狮文档。普通未标记的Sketchbook实例保持官方原样。Vite明确排除该包的预构建以保证转换生效，不改 `node_modules`；升级包后必须重审工厂及原核心保留测试。React从第一次渲染就声明适配文档，不在加载后争抢srcdoc。官方sandbox维持 `allow-scripts`，父页面严格校验消息来源/通道/类型和索引；宿主监听/计时/滚动RAF在退出时清理，iframe销毁与其pagehide释放引擎。React StrictMode重放effect时不提前dispose仍挂载的书籍。共享样式内嵌字体的OFL声明与MIT许可一并部署。

文化区由 `HomeCulture.jsx`、`home-culture.js` 与 `home-culture.css` 维护，四组图文位于史册之后。“探索更多”跳转至结构 `#/model`，底部“向下了解醒狮文化”先滚动到 `#homeLionBook`，随后可继续浏览 `#homeCulture` 照片图鉴。滚动入场动效使用 `IntersectionObserver`，减少动态偏好和缺少观察器时直接显示，离页清理观察器与媒体查询监听。图片路径仍集中在媒体配置，署名及许可在每张图注公开展示；依据见 [文化来源说明](../source/references/home-culture-sources.md)。

整体页的 `sceneContainer` 位于 `modelStage` 直属层，透明画布覆盖整个模型页；中央 `sceneFrame` 只负责布局、热点与加载回退，独立 `scene-interaction` 承接 OrbitControls 的拖动和缩放。中央列不再限定16:9或裁切溢出模型，标题、说明与控件为绝对定位浮层，列高按视口确定，不随两侧档案卡内容拉长。结构工艺在右卡常驻，`showGuide` 控制同页结构示意；开关和复原不更换路由或重建canvas。

结构、动作、神态背景按用户附件顺序接入三张原字节PNG，集中路径key为 `modelBackground/actionBackground/stateBackground`，出处及哈希见 [背景说明](../source/references/chapter-backgrounds.md)。App将路由背景提供给site-shell，使用固定cover背景，模型/章节stage透明；页脚及设置推开后的背景保持同图。旧模型装饰祥云/暗角和动作神态黑底移除，局部文字用深褐以适配宣纸；两侧模型档案卡与全页透明canvas保留。四页继续使用唯一全局SiteHeader，不在页面内添加导航。

神态页由 `ExpressionPage.jsx` 与 `src/data/lion-expressions.js` 提供喜、怒、哀、乐、动、静、惊、疑八态。当前为左目录/中央完整狮头/右文字的自适应单屏，高度为视口减实际顶栏，不锁16:9、不整页缩放。旧下半区、眼嘴局部图及独立页脚已删除；原文案未改。页面内部overview/details模式在右侧替换内容：点击中央独立狮头按钮显示meaning/emotion/motion解读，重复点击不切回；返回/Escape恢复简介并聚焦狮头。任一切态入口（含重复点击当前目录项）回到简介，不叠加旧文案或改Hash。

八态牌签、狮头层叠切换、上下按钮、主视觉滚轮及焦点方向键/Home/End保持；狮头按钮Enter/Space查看详情，不覆盖箭头。原生非被动wheel只绑定主视觉，180ms静默+36px累计门槛限制每手势一次，忽略横向/Ctrl缩放，离页解绑。按钮180ms/1.015原生WAAPI回应及右侧200ms过渡在减少动态偏好下关闭；动画在切态/返回/偏好变化/卸载时取消，Escape在详情内不误关闭设置。宽度通过lion-page容器查询、字号通过可用高度共同限制，900px余宽仍三栏；装饰圆纹也受高度预算约束，不能撑出第二屏。白红狮头仍是现有AI辅助提取图，同图姿态不代表真实八态照片；资料说明保留为主界面的一行。来源见 [八态说明](../source/references/lion-expressions.md)，本轮未重绘或修改媒体、Live2D、动作及全局导航。

短高桌面（窗口高度600px及以下）保留外部三栏，但右侧态字与解读标题并排，压缩字号/行距和目录行高；内部grid行显式minmax(0,1fr)，不让最小内容撑大高度，不隐藏或截掉文字。按住Space期间切态会取消该次尚未完成的原生按钮激活，松开不能重新打开详情；后续独立Space仍正常激活。

### 动作四段图鉴

`ChapterPage` 对action挂载独立 `ActionPage`；不再使用旧三栏占位布局。`actionClips.js` 是入场、探步、转身、收势的唯一数据源。首屏左侧16:9媒体、右侧两句简介，以及下方四段左媒体/右简介长页共用选中状态。两条 `ActionTimeline` 共用 `skin="heritage"`，样式与阶段选择分离；后续可换关卡视觉，不把阶段选择当作真实加载百分比。

首屏时间轴只切换内容、不滚动/自动播放；长页时间轴定位到对应段并为顶栏及吸顶目录留空间。程序定位期间锁定选中，到达后在同一滚动位置保留点击目标，真实滚动才恢复视口中部选择；pointer、wheel或滚动键中断时也停止浏览器原生平滑滚动。所有定位保持 `#/action`。减少动态偏好下直接定位、不做缩放过渡。

`ActionVideo` 使用真实HTMLVideoElement，观看入口原位播放并轻放大1.04；播放/暂停、时间、拖动进度、静音、全屏和错误重试由媒体状态驱动。全页最多一个播放意图；离开视口、后台、换源或卸载取消意图和暂停。重复观看是幂等操作，旧play Promise不能暂停更新的播放。全屏豁免仅属于自身播放器，退出后重查可见性；离页断开观察器、文档/窗口事件和RAF/定位计时器。首页 `VideoStage` 不受此实现影响。

当前四条videoKey均为null，不创建空地址请求。四幅海报是用户参考图经内置imagegen辅助提取/扩展的示意，不是正式视频首帧；页面保留“参考示意/视频待接入”。全身图与现有 `media.poster` 哈希一致，复用作错误回退，用户原件未修改。素材与后续视频接入步骤见 [动作来源说明](../source/references/lion-actions.md)。新增视频必须核对内容、画幅、解码、音轨及来源，再登记assetPaths/manifest、填videoKey并替换对应海报。

`tests/fixtures/action-player.jsx` 只在Playwright拦截地址下内存编译，以明确标为TEST MEDIA ONLY的现有短视频测试真实播放器；不进入dist，不代表四段正式视频接入。桌面UI和媒体回归分别在 `tests/e2e/action.spec.js`、`action-player.spec.js`，其余首页/模型/设置/神态回归保留。

Three.js 通过 `alpha: true` 与透明清屏融合全页背景，不添加地面；`camera.setViewOffset` 以中央交互区域的构图和负偏移延展全页可见范围。尺寸变化同时观察画布容器、交互区域与页头，绘制像素比上限为2，并按 `MAX_RENDERBUFFER_SIZE` 限制画布缓冲区；修改时需检查模型越过中央边界的实际像素、面板与导航点击，以及退出后的观察器和图形资源释放。

章节地址与映射以 `src/hooks/useChapterRoute.js`、`src/config/chapters.js` 为准。当前四章为首页 `entry`、结构 `model`、动作 `action`、神态 `state`；“结构”替代原导航名“狮头与结构”，路由不变。旧 `intro` 映射 `entry`、旧 `structure` 映射 `model`，通过 `replaceState` 规范Hash且不新增历史记录。已移除的评分地址与其他未知Hash均回首页。`App` 在页面外保持唯一 `SiteHeader` 及稳定header/trigger/panel refs，旧页内导航、搜索/菜单和底部入口已删除；四页品牌共用居中的 `BrandLockup` 与 `EntryLionEmblem`，不显示品牌辅助文字。媒体原路径定义在 `src/config/assetPaths.js`，浏览器引用经 `src/config/media.js` 补 `import.meta.env.BASE_URL`。页面数据集中在配置和数据文件，避免把同一媒体路径或章节文案复制到多个组件。

首页仍为五项完整文字顶栏；章节页顶栏容器透明，改为左侧品牌首页按钮与右侧结构/动作/神态/设置四项两块红色导航。`NavigationSurface` 用CSS材质、切角细边及SVG低对比云纹包住各组内容；原首页图案DOM只参与退场后隐藏，返回由品牌按钮提供。图案和高亮红线下保留普通sans标题，原标题/辅助文字仍在DOM用于过渡，但紧凑时opacity0、aria-hidden且不可交互。`NavigationIcon`继续载入用户1254×1254金白透明PNG与原viewBox，不改变字节、颜色或节点实例。素材与新设计对应见[原图案说明](../source/references/navigation-user-icons.md)、[分块导航参考](../source/references/navigation-two-panels.md)。

`useNavigationMotion` 捕获实际合成后的symbol/品牌/copy位置；布局更新后用WAAPI补间到最终位置，快速导航从正在显示的位置接续。图案与普通标题在symbol内同步移动；原标题/辅助文案整组右移、水平压缩并淡出，返回反向展开/渐显。品牌章节固定落位，首页额外右移默认24px，在动画页可调0–160px；既有品牌留白仍决定基准位置。默认720ms、200–1600/10ms步长与三条曲线保留，紧凑间距14px/4–36与右留白48px/16–160保留，实际受电脑余宽限制。原生hash/history仍先捕获后更新route；真实宽度/参数变化、减弱动态及卸载取消并清理will-change/监听/观察器。html采用 `scrollbar-gutter: stable`，避免首页长页到神态单屏的滚动条消失改变宽度、误取消刚开始的动画。新回归显示经典滚动条并测中间坐标、缩放/透明度及自然完成。

`DeveloperSettingsPanel` 贴右完整视口，仍为外观/导航/动画/轮播/布局五页，保留页签键盘、独立滚动、关闭与恢复默认。面板默认关闭，推开偏好默认开启，顶栏透明度默认20%；已有明确保存的18%/覆盖/零品牌偏移等参数保留，缺少新字段时补默认值，恢复默认采用新值。`homeBrandOffset` 独立于brandPadding，动画页“首页品牌右移距离”可保存/刷新/校验/复原。存储key与字体版本2保持，旧20→26的一次性迁移规则不变；读写失败仍可现场调整，打开状态不持久化。

设置结构只读参考 `E:/Software Development/WebPage`，未修改该工程。页签交互参考 [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)，代码动画参考 [MDN Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) 与 [MDN cubic-bezier](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/cubic-bezier)。

顶栏/侧栏分别使用背景alpha和backdrop-filter，透明度不淡化文字，模糊0显式为none。首页视频及模型背景延伸到顶栏后方以形成实际透出效果。开启推开时页面为侧栏留出实际宽度；`useSettingsPanelLayout` 用ResizeObserver和窗口resize判断，剩余空间不足900px时临时覆盖，保存原推开偏好。模型布局使用页面容器宽度适配，参数变化不重建video/canvas。

`ResizeHandle` 覆盖顶栏底边或侧栏左边，悬停整条边界在中心显示微交互提示。pointer capture、窗口兜底监听和单一RAF处理实时预览，松手后才持久化；Escape、pointercancel、失去capture/窗口焦点、pagehide和卸载恢复原值，清理监听、RAF、capture及全局拖动样式。方向键、Shift加速、Home/End及双击复原可用。修改此组件时需回归取消不会同时关闭面板、离页清理与实际视图尺寸。

导航字体的WOFF和OFL许可位于 `source/public/assets/fonts/`，来源及生成脚本在 `source/fonts/navigation-brush/`；`SiteHeader` 用集中媒体URL定义font-face，兼容Vite相对基址。导航标题和辅助文字均为真实字体，设置“导航”页可分别调节首页标题字号（14–28px，默认26px）和辅助字号（10–28px，默认18px），辅助透明度独立调整；导航按两类文字的实际字宽计算栏宽，空间不足时共同缩小并保留设定比例。旧保存参数自动补齐辅助字号，标题偏好保留，刷新和恢复默认沿用现有机制。顶部章节数字已移除；修改导航或品牌文字时检查本地字体子集是否覆盖新字。本轮简称“结构”使用既有字符，未更换运行字体或其他资产。运行检查包含字体和全部审查图的大小及SHA256。

导航适配用未动画的离屏copy克隆及DOM Range测真实字宽，避免返回途中字体完成通知把正在压缩的宽度当作排版宽度。首页五项按内容共同缩放，完整单行及字号比例保持；不足时品牌独立第一行、顶栏至少116px。章节四项保持单行紧凑组，独立算间距/右留白/图案与普通标题的高度预算，64px顶栏也不越界。实际高度写 `--site-header-height`、请求 `--header-height` 不变；观察器、字体通知和resize合并单RAF，卸载清理。章节/设置背景先在App解析为完整URL，避免生产stylesheet从assets目录消费相对CSS变量时形成assets/assets；验收直接解码计算后的背景地址，不能只核对文件名。

首页探索按钮使用 `assetPaths.exploreMoreCalligraphy` 的透明PNG，按钮保留aria-label并跳转结构，装饰图不替代可访问名称。题图与按钮取原宽度中间的共同中心，题图向左、按钮与辅助文字向右；中文间距由CSS维护，避免连续空格造成文案超宽。来源、内置imagegen编辑提示词、原图归档及哈希见 [书法素材说明](../source/references/explore-more-calligraphy.md)。

## 资源更新

创作文件归入 `source/`，运行网页只引用 `source/public/assets/`。该目录通过 Vite 的 `publicDir` 映射为网页根目录，例如 `source/public/assets/models/lion-overall.glb` 对应 `assets/models/lion-overall.glb`。公共资产保持文件名，构建会复制到 `dist/assets/`；不要假定这些文件自动获得哈希版本号。

更新步骤：

1. 在对应 `source/` 分类保留原始或创作版本。
2. 将通过验收的网页版本放入 `source/public/assets/`。
3. 更新 `src/config/assetPaths.js`、基址适配、相关数据及资产检查。
4. 运行 `npm test` 和 `npm run build`，涉及媒体交接、布局或模型时补充浏览器回归。
5. 在工程记忆中记录重要替换原因、已验证行为和遗留问题。

Live2D 创作源与运行包分开放置。当前运行包为重制参考，首页没有加载 Cubism/Pixi；不能仅将 manifest 改为 `ready` 就称为完成接入。视觉与绑定问题见 [Live2D 说明](../source/public/assets/live2d/README.md)。

2026-10-12首页循环视频已按用户指定文件替换，运行路径仍为 `assets/entry/home-lion-loop.mp4`；旧运行视频原字节保留在 `source/video/entry/home-lion-loop-v1.mp4`，原资产清单记录迁到该归档路径。新运行视频、dist拷贝与用户源视频SHA-256一致，最终资产清单83条。文化摄影从具体Commons文件许可核对后接入，更新时需同步图注、来源说明和资产清单；不要批量重写已有快照。

## 验证与辅助工具

`npm test` 使用 Node 测试运行器执行 `tests/assets/*.test.mjs`；`npm run test:e2e` 使用 Playwright，配置负责启动应用服务器。首次准备浏览器可运行：

```powershell
npx playwright install chromium
npm test
npm run test:e2e -- --grep-invert 手机
```

首页文化照片采用局部纵深图鉴：React负责图文/连续序号，`CultureDepthGallery`进入可视区域后动态载入 `src/services/cultureDepthGallery.js`。透明Three画布负责透视推进和前景微放大，Raycaster只允许真实前景照片命中/点击，位置稳定且已删除视差/光迹，稳定后停止RAF；不拦截页面滚轮，不改变首屏视频。底部控制栏已移除，直接点击照片下一张，键盘方向键/Home/End保留；暂停开关与间隔/离开等待/过渡时长/聚焦比例在设置的独立“轮播”页，参数通过App→HomePage→HomeCulture传递并原位更新引擎。移开先等待恢复时间，再从头计算播放间隔；重新进入清旧计时。图文、摄影许可和静态图片始终由React维护，减少动态或WebGL故障时照片仍可点选。修改此区时运行 `tests/e2e/home-culture.spec.js tests/e2e/developer-settings.spec.js --grep-invert 手机`，覆盖稳定聚焦/点击/延时恢复/设置迁移、电脑窗口、动态偏好变化、不可用回退及释放重入，并核对 [源码参考与MIT许可](../source/references/home-culture-depth-gallery.md)。

构建后可运行 `npm run test:e2e:preview -- --grep-invert 手机` 回归生产预览；两组命令按当前电脑端约束排除专项手机测试。Python 眼层检查使用 `python -B -m unittest discover -s tests/assets -p 'test_*.py'`；v4素材尚未生成时对应检查会显示 skip，需与通过项分开记录。本轮完整验证结果由当前任务日志记录，下列既有结果仅追溯当时版本。

轮播悬停以真实指针输入进入前景照片为起点。滚动捕获、容器/窗口尺寸变化会复核已有命中并释放无效暂停；高度单独变化也需要窗口resize监听。窗口blur、pointercancel和离开文档清旧指针，自动切图完成只解除失效悬停，不用旧坐标获取新暂停。加载中的静态按钮记录真实指针输入，向就绪画布交接时先清旧暂停，在同一次DOM提交的layout effects中先setActive，再消费一次坐标交给服务syncPointer重新命中验证；仍在主图内保持暂停，移开后恢复，失焦清交接坐标，防止延后的旧坐标覆盖新离开事件。新增监听随组件/服务卸载移除，不用常驻RAF或定时轮询兜底。首页回归包含加载中悬停及交接后继续悬停、精确注入较新离开事件的交接竞态、静止指针下滚动/切图/高度变化、失焦/取消事件及连续三圈图文和画布变化；合成生命周期事件不等于真实操作系统Alt+Tab验收。

模型全页绘制的浏览器断言使用真实滚轮及WebGL读像素，检查整体与结构示意状态的模型在旧16:9和当前中央交互区域上下边界外均有实际像素，同时验证默认角落透明、同页共享单canvas、离页释放及重入。2026-10-11历史裁切修正验证见 [全页画布修正日志](../wiki_memory/日志/UI修改/2026-10-11-模型全页画布与裁切修正.md)。2026-10-12融合首页任务实际完成资产8项（330.6ms）、生产构建（56模块）、开发19项（29.9秒）与生产预览19项（28.7秒）回归；构建仍有既有 `lionScene` 超500kB提示。预览首次18/19源于测试将 `/assets` 与 `./assets` 作字面比较，改用 `new URL` 解析后全量通过，产品未因此修改。实际播放脚本观察入场自然ended一次、首页循环回绕一次、返回/刷新不自动入场及手机四图载入，错误数组为空；结果见 [本轮日志](../wiki_memory/日志/功能添加/2026-10-12-入场首页融合与醒狮文化长页.md)。

当前 Playwright 配置使用完整Chromium通道，可由 `PLAYWRIGHT_CHANNEL` 指定已安装的浏览器通道。全局导航与设置侧栏任务实际完成资产9项、63模块构建、Chrome开发/生产预览各30项（43.6秒/40.5秒）；输出为 `tmp/e2e-unified-navigation-dev`、`tmp/e2e-unified-navigation-preview`。回归同时保留原视频/文化/模型行为，并覆盖新材质、推开回退、存储/迁移、拖动与取消清理。最终通过的导航审查图在 `source/reviews/navigation/2026-10-12-larger-typography/`，各版UI均在source归档、登记清单。详情见 [导航与侧栏日志](../wiki_memory/日志/UI修改/2026-10-12-全局顶栏与玻璃设置侧栏.md)。此前实际播放脚本为临时 `tmp/verify-unified-entry.mjs`，三张首页融合审查图仍在 `source/reviews/homepage/2026-10-12-unified-entry/`；临时输出不纳入源码。

2026-10-12探索书法与导航自适应实际通过资产9项（351.96ms）、64模块构建、Chrome开发/生产预览各33项（47.2秒/42.8秒）。新增真实字宽、单行完整文案、极限参数与900px推开余宽、CTA透明像素/共享中心/文化滚动回归；独立审查900–3840及延迟字体加载通过。资产旧137条保持，仅新增8条至145，字图/字体/首页视频与dist原字节一致。结果及截图见 [本轮任务日志](../wiki_memory/日志/UI修改/2026-10-12-探索书法与导航自适应.md)。

离线模型与分层工具位于 `scripts/`。GLB 检查与优化工具接收文件参数，优化必须输出到新文件；脚本会拒绝已有输出，并使用独占写入防止覆盖原件。Blender 导入工具由 Blender Python 执行。Live2D 分层工具的 Pillow、NumPy、pytoshop 依赖列在 `scripts/requirements.txt`，可在独立 Python 环境使用 `python -m pip install -r scripts/requirements.txt` 安装；这些不属于 npm 网页启动依赖，也不会在 `npm run dev` 时运行。具体命令与输出位置以脚本参数、脚本头部路径和对应测试为准。

## 内容与工程记忆

结构数据属于“资料整理 / 结构示意”，不能将合并网格热点称作已分离的模型部件。视频和 AI 模型素材需保持“AI辅助创作”说明；动作和神态的数据扩展须先补来源与样本。

`source/design/` 中的方案及旧计划保存设计背景，可能含历史路径、旧技术方案或过时进度。恢复当前开发应先读 `AGENTS.md` 和 `wiki_memory/`；从日志追溯历史时核对当时 revision。

工程记忆采用标准五页布局。每轮开始至少读项目概览、当前约束、当前待办；受影响模块再读架构、已知问题与相关 ADR/知识页。开发完成或中断时同步有证据的事实与恢复点，随后统一刷新索引并体检：

```powershell
python "wiki_memory/工具/memory.py" index --project "." --apply
python "wiki_memory/工具/memory.py" check --project "."
```

索引工具只检查记忆结构，不能代替构建、浏览器验收或内容来源核对。
