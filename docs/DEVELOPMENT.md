# 工程开发说明

2026-10-22全站按实际电脑余宽和高度自适应：窄首页导航整项换排，过高顶栏局部滚动；低窗设置/确认框保留内容滚动；首页书册、图鉴和资料使用实际容器宽度，极窄纸面保留可读下限；动作在窄低窗口保留场景并把解读/控件纵排。自适应只派生渲染尺寸，不改保存偏好，也不整页缩放。电脑有效CSS窗口包含640×360至3840×2160和超宽，配合Chrome原生125%/150%/200%缩放检查；手机仍不在范围。修改相关布局应运行 `desktop-window-contract.spec.js`、`home-desktop-layout.spec.js`、`chapters-desktop-layout.spec.js`、`navigation-settings-desktop-layout.spec.js` 以及受影响模块原回归。原生缩放测试使用独立临时profile，不改变用户浏览器设置；新专项覆盖的是实际文本/图片边界、交叠、可点击、实例保留与保存偏好，不能仅检查document无横向滚动。实施和逐阶段实际结果见[本轮说明](../source/references/desktop-responsive-2026-10-22.md)。

2026-10-22入场/史册/设置改版取消根加载动画与全局准备门控：原入场视频直接播放，播放期间隐藏导航，结束或跳过后恢复；各模块继续后台准备及独立重试。史册改为每页8秒按页码循环，开关和3–30秒停留位于“首页→书册”；“资料”提供标题/正文/辅助字号。设置采用预览、显式保存、取消确认，并导出当前参数JSON；本地HDRI只导出文件信息。实现、旧字段处理及实际验证见[本轮说明](../source/references/entry-book-settings-2026-10-22.md)。修改时运行新增 `settings-transaction.spec.js`、`sources-typography.spec.js` 和原入场/书册/设置相关电脑回归；音频及循环计时测试关闭trace。下方首次快翻、前置加载屏和面板自动保存的历史描述不再表示现行行为。

2026-10-22动作场景延伸至共享导航后方，透明和模糊直接采用本页实时画面；原导航默认值不迁移。`action-theater.css` 用双类动作根选择器覆盖通用章节padding，HUD按导航安全距离布局，全屏归零；`actionTheaterScene.js` 只向上扩展视野以保留下方原构图，并观察真实顶栏和全屏变化。修改该区域须运行 `tests/e2e/action-navigation-backdrop.spec.js`，其中截图隐藏画布对照能证明实际背景来源，等尺寸全屏覆盖仅依赖ResizeObserver会漏掉的情形。实际原生截图、79核心/11相关生产结果及范围见[本轮验证](../source/references/action-navigation-2026-10-22-validation.json)。

2026-10-22红白绒毛修复新增 `src/services/lionDiffuseProbe.js`：当前HDRI的线性像素一次积分L1漫反射，并限制过强方向能量；仅醒狮材质采用，高光仍由PMREM计算，原造型、配色、发丝数据与动画保留。正式前后/Blender参考及弃用实验见[修复说明](../source/references/lion-fur-balance-2026-10-22.md)，结果与适用范围见[验证JSON](../source/references/lion-fur-balance-2026-10-22-validation.json)。固定视角原生比较运行 `node scripts/audit_lion_fur.mjs --url=http://127.0.0.1:5198 --output=tmp/lion-fur-final`（先启动Vite，默认基线5b2a307）；Blender只读参考和图像统计分别由 `render_lion_material_reference.py`、`analyze_lion_fur_comparison.py` 提供，脚本头部列参数。常规验证仍为 `npm test`、`npm run build` 及HDRI/视角/动作/结构相关生产Chrome回归。细毛层次尚未达到EEVEE，不能把颜色误差下降等同于完整材质还原。

2026-10-21新增独立“视角”设置页，结构缩放按整体/聚焦部件标准观看距离设置有限阈值，动作取消旧室内高度夹取并开放1–179°极角。HDRI默认采用Blender真实forest.exr与0.35倍补光，可改预设、URL或当前会话本地EXR/HDR；源File/blob不持久化。参数组默认折叠，动作四角使用用户原鼓模型，进度手柄复用已有狮头。配置入口为 `src/config/viewSettings.js`、`src/config/hdri.js`，场景鼓独立为 `src/services/actionTheaterDrums.js`；回归为 `view-scene-settings.spec.js`、`settings-view-source.spec.js` 及原结构/动作/HDRI相关用例。来源、实时渲染与Blender的差异及本轮验证入口见[实施说明](../source/references/view-scene-settings-2026-10-21.md)。

本页说明日常开发方式；当前进度和验证结果由 [工程记忆](../wiki_memory/README.md) 维护。

自2026-10-14起，后续开发与验收仅以电脑端为目标，不考虑手机端适配或专项手机回归；既有手机相关代码与历史验证不作为本轮验收范围。

2026-10-21按最新要求，仅将结构提交 `6e9df36` 的补丁拣选到 `main`，E盘工程随之使用主线；动作悬浮UI的 `ce97297`、`38ba574` 两次提交不合入。推送期间主线新增的 `08d3afc` 视频低音量与安全播放修复保持。结构原制作报告保留历史基线，本次主线组合的资源保全、实际验证和Git结果另见[结构主线整合说明](../source/references/structure-atlas-main-2026-10-21.md)。

2026-10-21结构右栏使用 `StructureReadingPanel.jsx` 的宣纸图鉴，六部件通过 `structure-atlas.js` 映射真实ImageGen书法PNG；原资料仍从 `lion-structure.json` 读取。模型点选、投影标签和前后翻阅共用 `ModelPage` 的选择与聚焦入口，复原/自转位于左侧工具栏。宽380–420px，中部独立滚动，窄电脑余宽使用上下布局；首次进入结构才请求字图，不增加首页预热。旧深红默认通过独立 `structureAtlasVersion` 逐字段升级，保留自定义值与原readingPaper迁移边界。提示词、图片再处理和实际验收见[结构图鉴说明](../source/references/structure-atlas-2026-10-21.md)。

2026-10-15新增最前置水墨加载屏、模型/书册/图鉴预热及跨章节实例复用。设置左侧纵排分类，外观页分别调节所有透明模糊底板；动画页调书册尺寸和水墨时间线，布局页调页面选中命中。运行机制、参数范围和原加载HTML来源见 [本轮实现说明](../source/references/2026-10-15-desktop-iteration.md)。该日工作按当时要求在支线交付；后续分支同步及本轮交付按当前根 `AGENTS.md` 执行。

同日追加整改：首页导航恢复原版连续红栏并删除新增框饰（2026-10-19整栏底板固定；合并后追加标题平移、辅助文字与品牌文字连续淡入淡出），保留右侧“首页”；外观新增参考资料外区和卡片两组完整材质参数；动作只保留讲解区一条阶段目录。当前行为及参数默认值见 [三项整改说明](../source/references/2026-10-15-desktop-rectification.md)。

2026-10-15神态追加改版：逐态独立的八张参考形态PNG，右侧简介/狮艺解读采用明显不同的字体与结构；外观新增神态文字底板六参数，导航新增简介/解读独立字号。素材与真实性边界见 [八态说明](../source/references/lion-expressions.md)，当前单屏/键盘/滚轮交互保持。

2026-10-20醒狮换用用户 `结blend.blend` 的完整数据：结构页和动作剧场共享53网格与33组全量毛发（2,295,421根），不抽发、不减面，也禁用导出器自动修补；原件SHA保持不变。当前唯一导出入口 `scripts/export_full_lion.py`，依赖固定的Blender5.1.2（源与导出器函数指纹保护）。原136MB `.blend` 为精确Git忽略的本地副本，完整GLB、所有无损毛发数据与审计报告纳入Git。加载两种HTTP gzip响应时均严格校验；桌面验证及材质表达边界见[当前模型说明](../source/references/lion-structure-model.md)。下文旧“精简毛发”、41节点和旧LOD预算只描述历史版本。

## 环境与运行

2026-10-21结构与动作环境改用用户指定的 `citrus_orchard_road_puresky_4k.exr`（4096×2048原字节），由 `lionHdriEnvironment.js` 以线性半浮点EXR和PMREM生成照明与反射，不显示为网页背景。设置→HDRI为两章共用参数：开关、强度、水平旋转、曝光补偿和辅助灯倍率，保存到原有偏好；HDRI专用复原不重置其他字段。r160没有`scene.environmentRotation`或`environmentIntensity`，因此保留完整分辨率GPU旋转后重新预过滤，140ms合并拖动；强度作用于实例材质原环境倍率，EV作用于renderer的`2 ** EV`曝光，辅助灯按各灯初始强度缩放。只共享解码CPU数据，各renderer独立持有并回收纹理和PMREM；失败保留完整模型并提供“重新载入 HDRI”，不重建模型。修改后运行 `tests/e2e/hdri-settings.spec.js`，真实像素验证参数，不能仅以dataset值变化宣称生效。来源、默认值和验收见[HDRI说明](../source/references/lion-hdri-2026-10-21.md)。

2026-10-20曾修复 `RoomEnvironment` 未传renderer导致的暗面欠照；本轮已由指定EXR替换该环境，原主/辅/轮廓灯作为可调辅助光保留。旧固定相机照明对照工具 `scripts/audit_lion_lighting.mjs` 和[当日证据](../source/references/lion-lighting-2026-10-20.md)只追溯该阶段，不代替当前HDRI回归。该段记录2026-10-21阶段，当时模型、全部毛发数据与着色器均未改；2026-10-22局部环境漫反射改进见页首。

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

2026-10-20最新整改：首页已移除传承人物，书册→文化→类型→资料四区与四入口侧轨对应；人物资料仅作历史保留，researchPhotos参数不再启用预览。侧轨按实际顶栏与可用高度自适应，减少动态仍观察必要布局但不绘制动画。设置拆为公共模块/外观/导航/首页/章节/资料/动画/轮播/布局九页，首页与章节有子分页；共用控件在`SettingsControls.jsx`。公共材质点击后按范围原子应用四项材质，宽高/字号/播放保持，旧设置兼容；加载辅助字18–20px、进度数字36px。现行路径、边界和验证入口见[本轮说明](../source/references/settings-archive-2026-10-20.md)，下方含人物与五侧栏的段落为前阶段。

2026-10-20首页续接采用用户新竖幅背景分层等比取景，阅读大框的边角淡纹理随原surface透明度一起减弱。三款获批小装饰使用独立透明PNG，显示40–48px；不再以品牌狮头重复点缀标题。七年代书下导航复用原游戏角色idle/mov/poster图集，不含加载百分比；`HomeArchiveNav`为固定五栏目侧轨，滚动同步、不改Hash，共用原粒子开关。三形制图片初始居中，点击/键盘展开，切换与Escape/收起复位；观察点仅为正文。详细边界见[首页续接说明](../source/references/home-refresh-2026-10-20.md)。

六张传承人新闻照片尚无公开复用确认，只存Git忽略的`tmp/home-inheritor-photos/`。开发环境显式`?researchPhotos=1`可预览，生产构建始终显示姓名档案牌及来源链接，不部署或请求这些照片。不得以来源署名代替许可；AI示意、代表人物选编与工程许可统一在资料区折叠说明保留。新回归`home-archive-refresh`、`home-navigation-refresh`与`home-heritage-reveal`覆盖实际首页挂载、资源清理、尺寸和照片边界；真实结果及初次开发依赖重载记录见同日工程日志。

2026-10-19首页下方顺序为书册→文化照片图鉴→醒狮形制→传承人物→统一资料与摄影许可。`HomeHeritage.jsx`的两个栏目和提取出的`HomeCultureSources.jsx`作为`HomeCulture`的同级组件挂载，避免原照片区键盘事件作用到新控件；静态名单、观察点与来源ID统一在`src/data/home-heritage.js`。三形制明确区分传统流派与融合形制；六人物按表演/扎作筛选，未核实肖像许可时显示原创姓名档案牌，不伪造统一师承世系。来源与许可边界见[本轮资料说明](../source/references/home-heritage-sources.md)。

新标题/正文沿用`cultureTitle`/`cultureBody`，末尾资料区保留原六参数；标题使用自身命名容器处理40%窄底板，不缩放文字或裁切装饰。三幅类型PNG仅作为AI辅助示意，通过assetPaths/media注册并懒加载，`useStartupLoading`明确排除`lionType`前缀，不把下方新图加入首屏等待。新增回归为`home-heritage.spec.js`和`tests/assets/home-heritage.test.mjs`；截图归档`source/reviews/home/2026-10-19-heritage/`，不发布设计原件、提示词与审查图。

首页首屏之后的 `.home-archive-scene` 为五个阅读栏目共用用户醒狮纹样背景，当前使用三层同源取景与宣纸底色，不把竖图拉伸成整页。资源集中配置为 `homeArchiveBackground`，按文档基址转绝对URL；书页本身和官方引擎不变。标题/正文使用完整系统字体回退；当前小装饰采用用户批准的新透明PNG，原透明品牌狮头只继续用于品牌和侧轨。前阶段来源见 [背景与文字排版](../source/references/home-archive-background.md)，当前资源与交互以上方续接说明为准。电脑宽度、900px推开和原交互由 `tests/e2e/home-archive-visual.spec.js` 及既有史册/文化回归覆盖。

| 目录或入口 | 维护内容 |
| --- | --- |
| `src/main.jsx` | 挂载 React 与加载全局样式 |
| `src/App.jsx` | 页面组合、章节切换与延迟加载边界 |
| `src/features/home/` | 首页入场/循环视频、岭南醒狮史册、文化图鉴、探索更多跳转与向下文化入口 |
| `src/features/model/` | 结构页：左侧三维模型与工具栏、右侧书法部件图鉴及完整工艺/文化资料 |
| `src/features/action/` | 四面视频巨幕、当前动作解说、共享媒体控制与平面观看 |
| `src/features/chapters/` | 动作/神态挂载入口与神态八态交互图鉴 |
| `src/features/developer-settings/` | 顶栏/侧栏参数、浏览器持久化与推开布局 |
| `src/features/navigation/` | 图标、原毛笔标题与品牌收拢，辅助文字连续平移/淡入淡出及动画清理 |
| `src/components/` | 共用品牌狮头、章节导航、视频舞台、图片标题动效 |
| `src/hooks/` | 浏览器地址与 React 状态衔接 |
| `src/services/lionScene.js` | Three.js 场景、模型加载、图形资源与释放逻辑 |
| `src/config/` | 媒体文件路径、Vite 基址适配与章节元数据 |
| `src/data/` | 经来源说明约束的应用数据 |
| `src/styles/` | 全局、首页、模型、章节样式 |

React 负责页面生命周期、部件选择与信息面板状态，场景服务通过容器接入 Three.js。`App` 在启动时预热模型模块、GLB、纹理和着色器，并常驻同一 `ModelPage`；切到其他章节或页面进入后台时通过 `setActive(false)` 暂停绘制，返回时复用原画布。组件卸载、重试或场景故障时才释放资源。修改场景时检查 resize、指针事件、`requestAnimationFrame`、renderer、环境贴图、几何与材质的清理。

书册标题纸面在“设置→首页→书册→书册标题底板”分别调整宽度、最小高度（0自动）与标题底板留白；默认宽69%居中，旧100%默认只迁移一次，之后自选100%不再升级。留白50–150%不缩放文字，`bookTitleSpacing`默认100。按2026-10-17最新要求，历史导航由`BookTimeline`改为同高直线与Canvas离散红金粒子，移除旧波浪和SVG水墨层；650ms接续当前狮头位置，500–850ms粒子消散，最多80颗，静止后无RAF。2026-10-19追加修复：点击年代/宿主方向键立即更新狮头目标和节点选中，详情及书页仍跟随真实提交；实际焦点进入书纸时交回纸面控制，旧消息不回拉最后目标。开关在“动画→书册导航粒子拖尾”，兼容原`bookInkEnabled`偏好；组件退出清理RAF和观察器，跨路由预热保留时通过`playbackEnabled`暂停。加载页保留独立横排深墨透明字稿及文字失败回退；来源、提示词和确认历史见[前次记录](../source/references/2026-10-16-archive-panel-timeline.md)，当前导航/标题迁移见[本轮记录](../source/references/2026-10-17-straight-particles-game-guide.md)。

首页由 `useEntryPlayback` 管理入场和循环视频：浏览会话首次进入首页播放入场短片，结束、跳过或错误时继续均回到首页循环视频。`sessionStorage` 的 `nanfeng-lion:intro-seen:v1` 防止返回或刷新自动重复，存储不可用时保留当前页面生命周期内的回退；“重播入场”显式重播。`IntroPage` 已移除，视频切换、错误提示和离页暂停由 `VideoStage` 负责。

首页声音开关使用 `SoundControl` 的 `line` 变体：hero右下角透明白线，有声波浪、静音直线；不影响动作页的standard变体。没有声音提示弹框，原生自动播放受限时沿用静音推进与真实手势恢复，音量保持25%。相关布局/键盘及原生策略回归为 `home-audio-line.spec.js` 和 `home-audio-line-policy.spec.js`；后者文件内关闭trace，不能用快照引入的激活证明自动播放成功。真实故障仍保留重试。详情见[白线交付记录](../source/references/home-audio-line-2026-10-22.md)。

2026-10-22续改：有声波浪通过CSS `d: path(...)` 在1.1秒内连续形变，不是实时音频振幅分析；静音/等待手势时取消动画并恢复直线，后台暂停沿用原声音状态，离页移除按钮，减少动态模式保留静态波浪。`home-audio-wave.spec.js` 采样真实计算几何与动画资源，不能只检查keyframes声明；[本轮证据](../source/references/home-audio-wave-2026-10-22.md)另记最新main整合与逐帧数据。

2026-10-19视频资源先在独立分支替换，现随远端9cb0097合入E盘红金组合树：`media.intro`为用户入场视频.mp4（7.407秒），`media.home`为用户循环视频.mp4（14.001秒），均2560×1440、HEVC/AAC，保留原字节及默认静音，不更改上述播放逻辑。旧运行文件归档在source/video，路径/哈希及兼容性边界见[替换记录](../source/references/home-video-replacement-2026-10-19.md)。2026-10-20组合树已在本机Chrome与Edge实际验证HEVC自然结束和循环回绕，不据此宣称所有浏览器/设备均支持；回归入口为`home-video-replacement.spec.js`及`startup-loading.spec.js`，新结果保存于独立组合树验收。

首屏与原照片图鉴之间新增《岭南醒狮志》，向下文化入口先抵达史册。`HomeLionBook` 在实际进入视口后加载官方 `@designcodeio/threeui@1.2.0` 的 `Sketchbook` 和共享样式；`LionBookExperience` 负责七页时间线、正文、来源、加载失败重试及宿主通信。`lionSketchbookDocument` 只更换上游文档的内容与可选功能，原18层曲面纸条、光影、拖拽和弹簧翻页保留，未另写翻页引擎。书页与内置imagegen完整提示词见 [史册来源](../source/references/lion-book.md) 和 [插画记录](../source/references/lion-book-art-prompts.md)。

书本容器至少60%可见、七图与引擎就绪并处于前台后，桥接延迟220ms启动官方七页快翻，最终回序卷。快翻资格由宿主通过 `intro-policy` 提供，只有实际开始或用户主动接管才写入独立sessionStorage键 `nanfeng-lion:book-intro-seen:v1`；返回首页、同会话刷新与新iframe不重播，未看见/加载失败不提前消费。存储不可用时模块内存保证当前页面跨路由不重复，不能跨整页刷新保存。滚出视野仍暂停保留进度，减少动态跳过开场；StrictMode重复握手不打断已开始的同一序列。桥接收敛时间线/键盘交接，取消失焦、尺寸变化或指针中断中的未提交拖拽。真实纸面之外不接收翻页；书下投影及照片氛围在自身边界前淡出，保持原曲面/物理引擎。

2026-10-19传播页用内置imagegen去除图片自带的外轮廓黑边，原v2归档`source/design/lion-book/spread-v2.png`，新图原生1493×1053，其他六页不变；保持原几何和18层卷曲，详见[整改与完整提示词](../source/references/2026-10-19-navigation-feedback-fixes.md)。

七幅PNG位于 `source/public/assets/lion-book/`，保持原画布归一化书页位置、中央书脊和透明留白；不要把插画满铺或随意裁掉留白，否则会破坏曲面纹理对齐。实际生成尺寸为1494/1495×1052，与原1760/1240比例一致；资源就绪检查验证全部七页解码及比例，不能仅凭iframe加载事件显示成功。古代渊源与南狮形成纪年分开表述，AI插画明确为历史主题示意。新增史册回归在 `tests/e2e/lion-book.spec.js`，修改时覆盖真实拖拽的卷曲/取消/提交、时间线同步、首次加载、错误重试、滚轮、章节退出重入和电脑侧栏推开。

`scripts/lion-book-vite-plugin.mjs` 只包裹锁定版本的官方文档工厂返回值，校验其完整源SHA256；`lionSketchbookFactory` 从 `assetBaseUrl` 的 `#lion-book=通道` 取出通信通道，清除hash后生成本地醒狮文档。普通未标记的Sketchbook实例保持官方原样。Vite明确排除该包的预构建以保证转换生效，不改 `node_modules`；升级包后必须重审工厂及原核心保留测试。React从第一次渲染就声明适配文档，不在加载后争抢srcdoc。官方sandbox维持 `allow-scripts`，父页面严格校验消息来源/通道/类型和索引；宿主监听/计时/滚动RAF在退出时清理，iframe销毁与其pagehide释放引擎。React StrictMode重放effect时不提前dispose仍挂载的书籍。共享样式内嵌字体的OFL声明与MIT许可一并部署。

文化区由 `HomeCulture.jsx`、`home-culture.js` 与 `home-culture.css` 维护，四组图文位于史册之后。“探索更多”和底部“向下了解醒狮文化”先滚动到 `#homeLionBook`，随后可继续浏览 `#homeCulture` 照片图鉴。滚动入场动效使用 `IntersectionObserver`，减少动态偏好和缺少观察器时直接显示，离页清理观察器与媒体查询监听。图片路径仍集中在媒体配置，署名及许可在每张图注公开展示；依据见 [文化来源说明](../source/references/home-culture-sources.md)。

### 结构模型与部件聚焦

2026-10-19 结构页改用用户提供的 `model/醒狮_保留UV_三角转四边_优化.blend` 导出模型。当前部署路径为 `source/public/assets/models/lion-structure-optimized.glb`，由 `assetPaths.model` 和 `media.model` 引用。此前单狮头 `lion-overall.glb` 原字节归档至 `source/models/lion-head-overall-v1.glb`，不再部署。用户原始 Blender 输入保留在 `model/`，不改写、不复制到 public，也不纳入本次提交；导出检查数据见 [模型记录](../source/references/lion-structure-model.json)。

电脑端使用单屏双栏：左侧 `scene-column` 展示完整醒狮，右侧唯一 `structurePanel` 集中标题、加载状态、旋转/复原、六组部件目录、工艺/文化资料及来源说明，详情在卡内滚动。`sceneContainer` 仍位于 `modelStage` 直属层，透明画布覆盖整页；左侧 `sceneFrame` 与独立 `scene-interaction` 负责构图及 OrbitControls 拖动、缩放、表面点击，不恢复16:9内框、地面或中央裁切。旧固定百分比热点、`showGuide`、结构滑杆、假拆解进度和示意图层已删除。

六组数据来自 `lion-structure.json`：彩绘狮头、鼓眼与狮眉、额饰与狮角、狮嘴、须毛与边饰、狮被与狮尾。`objectNames` 用实际网格名前缀匹配眉、口、额饰、须、身体与尾等分件；共用头壳中的眼部等区域使用 `surfaceRegions` 椭球标记可见表面语义，不宣称内部结构已经拆分。Raycaster 命中真实模型后同步右侧选择，并聚焦实际命中点；拖动、取消手势或点击空白不触发选择。右侧目录提供同一选择入口，默认关闭自动旋转。

同日材质/卡顿修复后，网页 GLB 为 20,238,640B、513,600 三角、740,169 顶点。`scripts/export_lion_structure.py` 修复 Blender 导出遗漏的 Sheen Weight，按源 `Tint RGB × Weight` 写入扩展（atlas 0.12、织锦 0.18）；再调用 `scripts/optimize_lion_structure.mjs` 执行法线/UV 加权减面、等值去重和量化，保留六张嵌入 JPEG 原字节。原 `.blend` 不保存、不修改。参数、逐项修正与误差边界见[模型导出说明](../source/references/lion-structure-model.md)。场景使用曝光1及经对照校准的中性主/辅照明，保留 PMREM 反射。

场景仅为本模型实例启用 `three-mesh-bvh@0.8.0` 的加速求交，间接索引保留材质组，不改 Three 全局原型；静止后停止模型 RAF/绘制，拖动、阻尼、聚焦、复原、自动旋转或尺寸变化再按需绘制。多部件命中观察仅在镜头稳定后刷新，避免转动中反复逐三角形求交。`onProjectParts` 将六个源模型锚点的真实投影交给 DOM refs，更新标签、点和连线；框外标签隐藏，窄桌面使用短名，右侧目录保留全部入口。标签不进行遮挡射线探测，不能将背侧锚点的投影可见等同于表面可命中。

`focusOn({ id, target, distance, point })` 中，目录 `target`、数据中的 `surfaceRegions` 与 `pickPoints` 使用源 glTF 场景坐标，服务通过模型变换换算；点击回传的 `point` 使用当前世界坐标。`distance` 是模型最长边缩放到1.78后的世界距离。聚焦/复原共用单一渲染循环内的相机补间，目标对齐左侧展示中心；减少动态偏好下直接定位。只读 canvas `dataset` 发布实际相机距离、目标投影、部件可命中投影及补间状态，供浏览器回归核对。

结构、动作、神态背景按用户附件顺序接入三张原字节PNG，集中路径key为 `modelBackground/actionBackground/stateBackground`，出处及哈希见 [背景说明](../source/references/chapter-backgrounds.md)。App将路由背景提供给site-shell，使用固定cover背景，模型/章节stage透明；页脚及设置推开后的背景保持同图。旧模型装饰祥云/暗角和动作神态黑底移除，局部文字用深褐以适配宣纸；结构页采用右侧单一资料卡与全页透明canvas。四页继续使用唯一全局SiteHeader，不在页面内添加导航。

2026-10-19共享云纹SVG仅将viewBox扩为`0 -4 100 60`，修复3px描边顶部越界，中央与左牌签同步完整。

神态页由 `ExpressionPage.jsx` 与 `src/data/lion-expressions.js` 提供喜、怒、哀、乐、动、静、惊、疑八态。当前为左目录/中央完整狮头/右文字的自适应单屏，高度为视口减实际顶栏，不锁16:9、不整页缩放。旧下半区、眼嘴局部图及独立页脚已删除；原文案未改。页面内部overview/details模式在右侧替换内容：点击中央独立狮头按钮显示meaning/emotion/motion解读，重复点击不切回；返回/Escape恢复简介并聚焦狮头。任一切态入口（含重复点击当前目录项）回到简介，不叠加旧文案或改Hash。

八态牌签、狮头层叠切换、上下按钮、主视觉滚轮及焦点方向键/Home/End保持；狮头按钮Enter/Space查看详情，不覆盖箭头。原生非被动wheel只绑定主视觉，180ms静默+36px累计门槛限制每手势一次，忽略横向/Ctrl缩放，离页解绑。按钮180ms/1.015原生WAAPI回应及右侧200ms过渡在减少动态偏好下关闭；动画在切态/返回/偏好变化/卸载时取消，Escape在详情内不误关闭设置。宽度通过lion-page容器查询、字号通过可用高度共同限制，900px余宽仍三栏；装饰圆纹也受高度预算约束，不能撑出第二屏。白红狮头仍是现有AI辅助提取图，同图姿态不代表真实八态照片；资料说明保留为主界面的一行。来源见 [八态说明](../source/references/lion-expressions.md)，本轮未重绘或修改媒体、Live2D、动作及全局导航。

短高桌面（窗口高度600px及以下）保留外部三栏，但右侧态字与解读标题并排，压缩字号/行距和目录行高；内部grid行显式minmax(0,1fr)，不让最小内容撑大高度，不隐藏或截掉文字。按住Space期间切态会取消该次尚未完成的原生按钮激活，松开不能重新打开详情；后续独立Space仍正常激活。

### 动作沉浸式巨幕厅

`ChapterPage` 在 `#/action` 挂载 `ActionPage`，以全屏高的四面巨幕替换旧长页、角色目录及待接入播放器。导航继续共用 `SiteHeader`。默认四段用户视频静音循环，转向当前主面时同步解说、450ms主辅亮度与唯一音频；按钮与左右方向键同样转向实际摄像机。视频来自用户指定目录，原始MP4字节保持；来源、完整解码与海报抽帧见[视频记录](../source/references/2026-10-19-action-theater-videos.md)。

`actionClips.js` 定义探青采青、抖毛、狮子吐球、踩梅花桩与四个屏幕名/方向/素材键。`useTheaterPlayback` 保留四个稳定视频实例，切屏不重置时间，暂停/续播、当前进度、声音与错误重试均由实际媒体状态驱动；静音后才能切音轨，隐藏与离页使旧播放请求失效并暂停。平面观看与三维空间复用同一视频，不另造播放器或用首页视频替代。

`actionTheaterScene.js` 仅在动作页动态加载，负责GLB、VideoTexture、独立相机与36秒Y轴旋转。单RAF按可见性暂停，12°优势与180ms稳定停留后切主屏，距离/高度/俯仰联合约束；视频完整contain，主1/辅0.25渐变。退出取消fetch、视频帧回调和动画，释放控制器/图形资源；异常可重试并继续平面观看真实视频。原生Blender工程和GLB字节不改。

2026-10-19后续红金重构由 `actionTheaterArchitecture.js` 模块化构造红柱、斗拱、三层雕梁、四屏黑金厚框、深色石地和9.4m×0.4m三级圆台，旧无饰柱/网格地面/厚台运行时隐藏。重复几何实例共1445份、29个渲染网格、636412三角形；无新增依赖或参考图背景。原狮同比1.3落台，四屏同比0.9为14.4×8.1m。初始相机(0,1.6,8.6)看向(0,1.45,0)，FOV56°；环绕7.2–8.8m/高度1.55–3.75m/polar74–89.5°，窄桌面保持74°水平视野。实际网格与圆周投影验收主狮32–42%高、全台60–75%宽，避免用圆台AABB空角高估。

`actionTheaterReflection.js` 复用r160 Reflector，768²/18Hz上限与9点模糊，窄桌面初始512²；细微空间变化避免完美镜子。静置累计180帧平均低于35FPS时DPR降1、反射512²/9Hz、阴影512²；默认DPR≤1.5，窄桌面≤1.25。石材粗糙度采用轻微非周期纹理与mipmap/各向异性过滤，避免对向光下银白台面/摩尔纹；不整体提曝光或环境亮度。重型renderer/PMREM/编译等待共享导航真实 `data-nav-animating=false` 后执行，防止冷载长任务吃掉标题与辅助文字后半段动画；等待支持中断、取消、卸载清理。

动作服务在上述等待结束后使用 `renderer.compile(scene, camera)` 再首绘。锁定r160的 `compileAsync` 会额外建立不可取消的10ms私有轮询，快速离页释放材质后可访问已移除的currentProgram；组合树联合验收实际复现后改为同一同步编译入口，避免残留回调。header等待的settled标记与每次取消旧RAF同时保证只结束一次；卸载清MO、RAF和abort监听。结构模型预热机制保持，勿据动作修复批量替换其他服务。

`tests/e2e/action.spec.js`、`action-theater.spec.js` 和 `action-player.spec.js` 在真实产品路由加载正式四视频，覆盖画布像素、方向/镜头/旋转、播放时间、主音轨、进度、循环、失败重试、迟到Promise与离页释放。新增 `action-theater-ornate.spec.js` 检查真实投影、落台、三屏/后屏、16:9、实例建筑、反射更新/暂停与桌面浮层；`action-theater-integrated.spec.js` 检查新首页真实视频与剧场的跨章节生命周期。旧fixture仅作普通组件输入示例；`guide-refresh.spec.js` 保留书册覆盖并迁移动作断言。输出使用独立 `tmp/`，`ACTION_THEATER_REVIEW_DIR` 指定当前图集。视觉阶段九张QA与[原验收](../source/references/2026-10-19-action-theater-ornate-validation.json)冻结在 `source/reviews/action-theater/2026-10-19-ornate/`，合并树另存 `2026-10-19-ornate-integrated/` 并记录于[独立组合树验收](../source/references/2026-10-19-action-theater-ornate-integrated-validation.json)。最终集成验收发生2026-10-20，文件沿任务开始日命名；首次接入八图与[原网页记录](../source/references/2026-10-19-action-theater-web.md)保留历史范围。

### 共用导航、设置与结构场景

Three.js 通过 `alpha: true` 与透明清屏融合全页背景，不添加地面；`camera.setViewOffset` 以左侧交互区域的构图和负偏移延展全页可见范围。尺寸变化同时观察画布容器、交互区域与页头，绘制像素比取设备 DPR、1.5、`sqrt(2600000 / (width × height))` 与硬件 `MAX_RENDERBUFFER_SIZE` 上限中的最小值；修改时需检查模型真实绘制、聚焦中心、面板与导航点击、离页暂停复用，以及组件卸载或重试后的观察器、收敛计时器、BVH和图形资源释放。中性 `RoomEnvironment` 经 PMREM 生成反射贴图，不显示额外背景；生成器与临时场景及时释放，保留的环境渲染目标随服务 `dispose` 释放。

章节地址与映射以 `src/hooks/useChapterRoute.js`、`src/config/chapters.js` 为准。当前四章为首页 `entry`、结构 `model`、动作 `action`、神态 `state`；“结构”替代原导航名“狮头与结构”，路由不变。旧 `intro` 映射 `entry`、旧 `structure` 映射 `model`，通过 `replaceState` 规范Hash且不新增历史记录。已移除的评分地址与其他未知Hash均回首页。`App` 在页面外保持唯一 `SiteHeader` 及稳定header/trigger/panel refs，旧页内导航、搜索/菜单和底部入口已删除；四页品牌共用居中的 `BrandLockup` 与 `EntryLionEmblem`，不显示品牌辅助文字。媒体原路径定义在 `src/config/assetPaths.js`，浏览器引用经 `src/config/media.js` 补 `import.meta.env.BASE_URL`。页面数据集中在配置和数据文件，避免把同一媒体路径或章节文案复制到多个组件。

首页保留连续红色五项完整文案横栏。2026-10-19合并后按用户最新要求，首页/结构/动作/神态/设置在展开与紧凑模式共用同一 `.site-nav-heading strong`，保留原毛笔字体、字号、字重和内容；紧凑时移至图案下方，删除重复的sans小标题。唯一 `NavigationSurface` 仍覆盖完整顶栏，跨模式及动画帧的宽高、渐变、透明度、模糊与圆角保持。章节品牌狮头收拢到右侧“首页”左邻并可返回首页，“南风有狮”文字随品牌移动渐隐，回首页渐显；完成收拢后不占宽度。原PNG字节、颜色与节点实例保持。此前[分块导航参考](../source/references/navigation-two-panels.md)及“仅图标/品牌动画、文案不动画”均为已被替代的历史规格；最新结果见[本轮日志](../wiki_memory/日志/UI修改/2026-10-19-导航文字连续动画与品牌收拢.md)。

`useNavigationMotion` 在切页前捕获 `.site-nav-icon`、`.site-nav-heading`、`.site-nav-description`、品牌胶囊及 `.site-brand-copy` 的当前合成矩形与透明度，布局后统一测量再启动WAAPI。图案/原标题平移，辅助文字平移并连续淡出/恢复到用户设定透明度，品牌文字只在父级位移上叠加透明度动画；不重复计算父级位移。紧凑辅助文字和品牌文字保留绝对定位目标，静态为opacity0/visibility:hidden，不能以display:none破坏退场与返回；动画期间临时可见。文字按行框中心换算Y偏移，避免紧凑行高改变造成首帧跳字。快速导航和原生hash/history均先捕获当前状态再取消接续，CSS像素兼容125%缩放。默认720ms、200–1600/10ms步长与三条曲线、品牌右移0–160px、紧凑间距/右留白参数继续生效。真实宽度/参数变化、减少动态及卸载取消并清理will-change/监听/观察器；`scrollbar-gutter:stable`避免滚动条变化误取消。逐帧回归核对五个标题与全部辅助字的持续动画、中断透明度、品牌渐隐及固定底板。

`DeveloperSettingsPanel` 贴右完整视口，仍为外观/导航/动画/轮播/布局五页，保留页签键盘、独立滚动、关闭与恢复默认。面板默认关闭，推开偏好默认开启，顶栏透明度默认20%；已有明确保存的18%/覆盖/零品牌偏移等参数保留，缺少新字段时补默认值，恢复默认采用新值。`homeBrandOffset` 独立于brandPadding，动画页“首页品牌右移距离”可保存/刷新/校验/复原。存储key与字体版本2保持，旧20→26的一次性迁移规则不变；读写失败仍可现场调整，打开状态不持久化。

设置结构只读参考 `E:/Software Development/WebPage`，未修改该工程。页签交互参考 [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)，代码动画参考 [MDN Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) 与 [MDN cubic-bezier](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/cubic-bezier)。

顶栏/侧栏分别使用背景alpha和backdrop-filter，透明度不淡化文字，模糊0显式为none。首页视频及模型背景延伸到顶栏后方以形成实际透出效果。开启推开时页面为侧栏留出实际宽度；`useSettingsPanelLayout` 用ResizeObserver和窗口resize判断，剩余空间不足900px时临时覆盖，保存原推开偏好。模型布局使用页面容器宽度适配，参数变化不重建video/canvas。

`ResizeHandle` 覆盖顶栏底边或侧栏左边，悬停整条边界在中心显示微交互提示。pointer capture、窗口兜底监听和单一RAF处理实时预览，松手后才持久化；Escape、pointercancel、失去capture/窗口焦点、pagehide和卸载恢复原值，清理监听、RAF、capture及全局拖动样式。方向键、Shift加速、Home/End及双击复原可用。修改此组件时需回归取消不会同时关闭面板、离页清理与实际视图尺寸。

导航字体的WOFF和OFL许可位于 `source/public/assets/fonts/`，来源及生成脚本在 `source/fonts/navigation-brush/`；`SiteHeader` 用集中媒体URL定义font-face，兼容Vite相对基址。导航标题和辅助文字均为真实字体，设置“导航”页可分别调节首页标题字号（14–28px，默认26px）和辅助字号（10–28px，默认18px），辅助透明度独立调整；导航按两类文字的实际字宽计算栏宽，空间不足时共同缩小并保留设定比例。旧保存参数自动补齐辅助字号，标题偏好保留，刷新和恢复默认沿用现有机制。顶部章节数字已移除；修改导航或品牌文字时检查本地字体子集是否覆盖新字。本轮简称“结构”使用既有字符，未更换运行字体或其他资产。运行检查包含字体和全部审查图的大小及SHA256。

导航适配用离屏copy及完整品牌克隆、DOM Range测量请求字号下的真实宽度；克隆显式恢复辅助文字静态排版及品牌文字，不能用紧凑态隐藏后的宽度计算首页预算。各路由共用展开预算、实际标题字号、五栏宽度和顶栏高度；首页完整单行且保留标题/辅助字号比例，不足时品牌独立第一行，实际顶栏至少116px。紧凑五项用同一标题字宽计算按钮宽度，行高收紧并按实际顶栏高度限制图标，64px顶栏仍保持标题完整。实际高度写 `--site-header-height`，请求 `--header-height` 不变；观察器、字体通知和resize合并单RAF，卸载清理。章节/设置背景仍先由App解析为完整URL，验收解码计算后的地址，不能只核对文件名。

首页探索按钮使用 `assetPaths.exploreMoreCalligraphy` 的透明PNG，按钮保留aria-label并按顶栏实际高度滚到首页书册区，装饰图不替代可访问名称。题图与按钮取原宽度中间的共同中心，题图向左、按钮与辅助文字向右；中文间距由CSS维护，避免连续空格造成文案超宽。来源、内置imagegen编辑提示词、原图归档及哈希见 [书法素材说明](../source/references/explore-more-calligraphy.md)。

## 资源更新

### 前阶段独立巨幕厅 Blender 工程

`source/models/immersive-theater/` 保存前阶段离线创作交付，不进入 `publicDir`；后续网页接入使用上文运行副本。先读[交接文档](../source/models/immersive-theater/SouthWindLion_Immersive_Theater_Handoff.md)，其中保留原生工程、网页LOD、真实渲染及离线交付时的素材条件。重建源工程使用本机 Blender 5.0（用户 launcher 的同目录可执行文件）：

```powershell
& 'F:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_immersive_theater.py
& 'F:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_immersive_theater.py -- --render-only --render Front,Left,Right,Back,Overview --resolution 1600 --samples 64
& 'F:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build_immersive_theater.py -- --export-web
& 'F:/Blender/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/validate_immersive_theater.py -- --baseline-only
& 'F:/Blender/blender.exe' --background --factory-startup source/models/immersive-theater/SouthWindLion_Immersive_Theater_Blockout.blend --python-exit-code 1 --python scripts/validate_immersive_theater.py -- --glb source/models/immersive-theater/SouthWindLion_Immersive_Theater.glb
```

构建脚本默认拒绝已有输出；明确重建本任务生成文件时可追加 `--overwrite`，不影响固定只读的 `model/醒狮_保留UV_三角转四边_优化.blend`。新环境需准备该用户输入；它未纳入Git。交付工程已打包图像和OFL字体，可以独立打开。构建与渲染使用 Blender 自带 Python；仅字体重建另需 Python/fontTools，见[字体说明](../source/fonts/immersive-theater/README.md)。

前阶段于2026-10-19实际完成原件/最终工程独立重开、160项原生与GLB检查、五图逐张查看及 Lux3D 插件文件检查；证据见 `source/references/2026-10-19-immersive-theater*.json`。当时资产清单由360条增至368，`npm test` 40/40、309模块构建通过，网站代码与运行资产未改。后续网页接入另有47项资产/核心检查、生产41项浏览器回归和8张审查图，详见[网页验收记录](../source/references/2026-10-19-action-theater-web-validation.json)，不将离线结果代替网页交互证据。

创作文件归入 `source/`，运行网页只引用 `source/public/assets/`。该目录通过 Vite 的 `publicDir` 映射为网页根目录，例如 `source/public/assets/models/lion-structure-optimized.glb` 对应 `assets/models/lion-structure-optimized.glb`。公共资产保持文件名，构建会复制到 `dist/assets/`；不要假定这些文件自动获得哈希版本号。

更新步骤：

1. 在对应 `source/` 分类保留原始或创作版本。
2. 将通过验收的网页版本放入 `source/public/assets/`。
3. 更新 `src/config/assetPaths.js`、基址适配、相关数据及资产检查。
4. 运行 `npm test` 和 `npm run build`，涉及媒体交接、布局或模型时补充浏览器回归。
5. 在工程记忆中记录重要替换原因、已验证行为和遗留问题。

Live2D 创作源与运行包分开放置。当前运行包为重制参考，首页没有加载 Cubism/Pixi；不能仅将 manifest 改为 `ready` 就称为完成接入。视觉与绑定问题见 [Live2D 说明](../source/public/assets/live2d/README.md)。

2026-10-12首页循环视频已按用户指定文件替换，运行路径仍为 `assets/entry/home-lion-loop.mp4`；旧运行视频原字节保留在 `source/video/entry/home-lion-loop-v1.mp4`，原资产清单记录迁到该归档路径。新运行视频、dist拷贝与用户源视频SHA-256一致，最终资产清单83条。文化摄影从具体Commons文件许可核对后接入，更新时需同步图注、来源说明和资产清单；不要批量重写已有快照。

## 验证与辅助工具

2026-10-22声音、神态和结构目录改动分别运行 `tests/e2e/video-audio.spec.js`、`expression-motion.spec.js`、`structure-directory.spec.js`，同时按范围复核原 `structure-atlas.spec.js`、`content-comparison.spec.js` 和 `action-player.spec.js`。音频spec必须关闭trace：快照可能注入用户激活，严格策略需独立干净Chrome和`userGesture:false` CDP观察。默认有声若受阻则静音继续，右下角共用开关及首个真实手势启声，显式静音会话保留。神态测试检查实际中途矩形/旧字隐藏/反向中断/减少动态清理，目录测试核对真实模型焦点和独立滚动；不能以文字变化替代模型联动。八字为实际内置ImageGen输出，无图像后处理。来源、逐图提示词和各阶段实际验证见[本轮说明](../source/references/interface-audio-motion-2026-10-22.md)。

结构图鉴改动运行 `tests/e2e/structure-atlas.spec.js`，覆盖六图真实解码/alpha、真实模型射线点选、前后循环、全部原资料、900/1366/1920电脑窗、电脑缩放余宽、设置迁移和首页请求隔离。原GPU按需绘制/投影、滚轮真实像素、观察往返和全量毛发检查继续运行相应结构子集；局部聚焦允许视锥裁剪，完整毛发绘制在「复原整体」后核对。六字源文件位于 `source/design/structure-atlas/2026-10-21/`，按用户要求的透明裁剪可用 `python scripts/prepare_structure_calligraphy.py` 复现；该脚本只后处理已有六张真实原输出，不替代ImageGen生成。最终命令、环境、结果与范围记录于本轮说明和工程日志。

结构材质与转动性能新增 `tests/e2e/structure-interaction.spec.js`，核对六个真实投影标签/点击聚焦、旋转后锚点移动和稳定后停止模型绘制。可在开发服务器运行时通过 `node scripts/benchmark_lion_scene.mjs --dpr=1 --output=tmp/structure-after-dpr1` 复现性能采样；加 `--baseline-ref=1f8f206` 读取修复前同一场景与 GLB，`--dpr=2` 核对高分屏预算。该工具只在浏览器请求中注入计时，默认每阶段6秒，分别输出 JSON 和 CPUProfile，不改产品源码。2026-10-19同机 RTX5070Ti/Chrome155 的实际前后结果、源码/模型hash及限制见[性能报告](../source/references/2026-10-19-structure-performance.json)；约180FPS是高刷新率同机对照，不能推广为所有电脑保证，JS提交耗时也不等于GPU计时。本轮最终门禁与生产QA见[材质/性能修复日志](../wiki_memory/日志/Bug处理/2026-10-19-结构材质与旋转性能修复.md)。

`npm test` 使用 Node 测试运行器执行 `tests/assets/*.test.mjs`；`npm run test:e2e` 使用 Playwright，配置负责启动应用服务器。首次准备浏览器可运行：

```powershell
npx playwright install chromium
npm test
npm run test:e2e -- --grep-invert 手机
```

首页文化照片采用局部纵深图鉴：React负责图文/连续序号，`CultureDepthGallery`进入可视区域后动态载入 `src/services/cultureDepthGallery.js`。透明Three画布负责透视推进和前景微放大，Raycaster只允许真实前景照片命中/点击，位置稳定且已删除视差/光迹，稳定后停止RAF；不拦截页面滚轮，不改变首屏视频。底部控制栏已移除，直接点击照片下一张，键盘方向键/Home/End保留；暂停开关与间隔/离开等待/过渡时长/聚焦比例在设置的独立“轮播”页，参数通过App→HomePage→HomeCulture传递并原位更新引擎。移开先等待恢复时间，再从头计算播放间隔；重新进入清旧计时。图文、摄影许可和静态图片始终由React维护，减少动态或WebGL故障时照片仍可点选。修改此区时运行 `tests/e2e/home-culture.spec.js tests/e2e/developer-settings.spec.js --grep-invert 手机`，覆盖稳定聚焦/点击/延时恢复/设置迁移、电脑窗口、动态偏好变化、不可用回退及释放重入，并核对 [源码参考与MIT许可](../source/references/home-culture-depth-gallery.md)。

构建后可运行 `npm run test:e2e:preview -- --grep-invert 手机` 回归生产预览；两组命令按当前电脑端约束排除专项手机测试。Python 眼层检查使用 `python -B -m unittest discover -s tests/assets -p 'test_*.py'`；v4素材尚未生成时对应检查会显示 skip，需与通过项分开记录。本轮完整验证结果由当前任务日志记录，下列既有结果仅追溯当时版本。

轮播悬停以真实指针输入进入前景照片为起点。滚动捕获、容器/窗口尺寸变化会复核已有命中并释放无效暂停；高度单独变化也需要窗口resize监听。窗口blur、pointercancel和离开文档清旧指针，自动切图完成只解除失效悬停，不用旧坐标获取新暂停。加载中的静态按钮记录真实指针输入，向就绪画布交接时先清旧暂停，在同一次DOM提交的layout effects中先setActive，再消费一次坐标交给服务syncPointer重新命中验证；仍在主图内保持暂停，移开后恢复，失焦清交接坐标，防止延后的旧坐标覆盖新离开事件。新增监听随组件/服务卸载移除，不用常驻RAF或定时轮询兜底。首页回归包含加载中悬停及交接后继续悬停、精确注入较新离开事件的交接竞态、静止指针下滚动/切图/高度变化、失焦/取消事件及连续三圈图文和画布变化；合成生命周期事件不等于真实操作系统Alt+Tab验收。

当前结构回归见 `tests/e2e/app.spec.js`：真实滚轮配合 WebGL 读像素检查模型放大，核对全页画布、默认角落透明、900/1366/1920电脑双栏、右侧目录和真实表面命中、实际相机距离与左侧目标投影、拖动/空白不误选及单canvas离页暂停重入。`startup-loading.spec.js` 覆盖新模型冷启动预热、失败和下载中上下文丢失；资产测试检查全部网格索引、UV、嵌入纹理及语义映射。最终模型统计与本轮实际验证见 [结构替换任务日志](../wiki_memory/日志/功能添加/2026-10-19-结构新模型与部件聚焦.md)，初版结果不代替最终模型验收。2026-10-11曾以旧单狮头验证越过16:9及中央交互区上下边界，这一形状阈值已由本轮完整醒狮构图检查替代；历史裁切修正验证见 [全页画布修正日志](../wiki_memory/日志/UI修改/2026-10-11-模型全页画布与裁切修正.md)。2026-10-12融合首页任务实际完成资产8项（330.6ms）、生产构建（56模块）、开发19项（29.9秒）与生产预览19项（28.7秒）回归；构建仍有既有 `lionScene` 超500kB提示。预览首次18/19源于测试将 `/assets` 与 `./assets` 作字面比较，改用 `new URL` 解析后全量通过，产品未因此修改。实际播放脚本观察入场自然ended一次、首页循环回绕一次、返回/刷新不自动入场及手机四图载入，错误数组为空；结果见 [本轮日志](../wiki_memory/日志/功能添加/2026-10-12-入场首页融合与醒狮文化长页.md)。

当前 Playwright 配置使用完整Chromium通道，可由 `PLAYWRIGHT_CHANNEL` 指定已安装的浏览器通道。全局导航与设置侧栏任务实际完成资产9项、63模块构建、Chrome开发/生产预览各30项（43.6秒/40.5秒）；输出为 `tmp/e2e-unified-navigation-dev`、`tmp/e2e-unified-navigation-preview`。回归同时保留原视频/文化/模型行为，并覆盖新材质、推开回退、存储/迁移、拖动与取消清理。最终通过的导航审查图在 `source/reviews/navigation/2026-10-12-larger-typography/`，各版UI均在source归档、登记清单。详情见 [导航与侧栏日志](../wiki_memory/日志/UI修改/2026-10-12-全局顶栏与玻璃设置侧栏.md)。此前实际播放脚本为临时 `tmp/verify-unified-entry.mjs`，三张首页融合审查图仍在 `source/reviews/homepage/2026-10-12-unified-entry/`；临时输出不纳入源码。

2026-10-12探索书法与导航自适应实际通过资产9项（351.96ms）、64模块构建、Chrome开发/生产预览各33项（47.2秒/42.8秒）。新增真实字宽、单行完整文案、极限参数与900px推开余宽、CTA透明像素/共享中心/文化滚动回归；独立审查900–3840及延迟字体加载通过。资产旧137条保持，仅新增8条至145，字图/字体/首页视频与dist原字节一致。结果及截图见 [本轮任务日志](../wiki_memory/日志/UI修改/2026-10-12-探索书法与导航自适应.md)。

离线模型与分层工具位于 `scripts/`。GLB 检查与优化工具接收文件参数，优化必须输出到新文件；脚本会拒绝已有输出，并使用独占写入防止覆盖原件。Blender 导入工具由 Blender Python 执行。Live2D 分层工具的 Pillow、NumPy、pytoshop 依赖列在 `scripts/requirements.txt`，可在独立 Python 环境使用 `python -m pip install -r scripts/requirements.txt` 安装；这些不属于 npm 网页启动依赖，也不会在 `npm run dev` 时运行。具体命令与输出位置以脚本参数、脚本头部路径和对应测试为准。

## 内容与工程记忆

结构工艺文字属于资料整理与工艺示意，当前醒狮是用户提供的造型模型；真实网格分组与头壳表面语义须分别说明，不把眼部可点选区域或毛发采样当作内部机构已分离、真实结构测量或动作模拟。视频和 AI 模型素材需保持“AI辅助创作”说明；动作和神态的数据扩展须先补来源与样本。

`source/design/` 中的方案及旧计划保存设计背景，可能含历史路径、旧技术方案或过时进度。恢复当前开发应先读 `AGENTS.md` 和 `wiki_memory/`；从日志追溯历史时核对当时 revision。

工程记忆采用标准五页布局。每轮开始至少读项目概览、当前约束、当前待办；受影响模块再读架构、已知问题与相关 ADR/知识页。开发完成或中断时同步有证据的事实与恢复点，随后统一刷新索引并体检：

```powershell
python "wiki_memory/工具/memory.py" index --project "." --apply
python "wiki_memory/工具/memory.py" check --project "."
```

索引工具只检查记忆结构，不能代替构建、浏览器验收或内容来源核对。
