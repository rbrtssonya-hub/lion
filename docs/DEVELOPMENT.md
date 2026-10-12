# 工程开发说明

本页说明日常开发方式；当前进度和验证结果由 [工程记忆](../wiki_memory/README.md) 维护。

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

| 目录或入口 | 维护内容 |
| --- | --- |
| `src/main.jsx` | 挂载 React 与加载全局样式 |
| `src/App.jsx` | 页面组合、章节切换与延迟加载边界 |
| `src/features/home/` | 首页内入场/循环视频状态、文化长页和向下探索 |
| `src/features/model/` | 整体模型页、同页结构示意与信息面板 |
| `src/features/chapters/` | 其余章节的现有占位页面 |
| `src/features/developer-settings/` | 顶栏/侧栏参数、浏览器持久化与推开布局 |
| `src/components/` | 共用品牌狮头、章节导航、视频舞台、图片标题动效 |
| `src/hooks/` | 浏览器地址与 React 状态衔接 |
| `src/services/lionScene.js` | Three.js 场景、模型加载、图形资源与释放逻辑 |
| `src/config/` | 媒体文件路径、Vite 基址适配与章节元数据 |
| `src/data/` | 经来源说明约束的应用数据 |
| `src/styles/` | 全局、首页、模型、章节样式 |

React 负责页面生命周期、热点与信息面板状态，场景服务通过容器接入 Three.js。进入模型页面时才加载相关模块；退出时调用服务释放逻辑。修改场景时检查 resize、指针事件、`requestAnimationFrame`、renderer、几何与材质的清理，避免来回切换章节后累积资源。

首页由 `useEntryPlayback` 管理入场和循环视频：浏览会话首次进入首页播放入场短片，结束、跳过或错误时继续均回到首页循环视频。`sessionStorage` 的 `nanfeng-lion:intro-seen:v1` 防止返回或刷新自动重复，存储不可用时保留当前页面生命周期内的回退；“重播入场”显式重播。`IntroPage` 已移除，视频切换、错误提示和离页暂停由 `VideoStage` 负责。

文化区由 `HomeCulture.jsx`、`home-culture.js` 与 `home-culture.css` 维护，四组图文在首屏之后直接呈现；CTA只滚动到 `#homeCulture`，不导航到其他页。滚动入场动效使用 `IntersectionObserver`，减少动态偏好和缺少观察器时直接显示，离页清理观察器与媒体查询监听。图片路径仍集中在媒体配置，署名及许可在每张图注公开展示；依据见 [文化来源说明](../source/references/home-culture-sources.md)。

整体页的 `sceneContainer` 位于 `modelStage` 直属层，透明画布覆盖整个模型页；中央 `sceneFrame` 只负责布局、热点与加载回退，独立 `scene-interaction` 承接 OrbitControls 的拖动和缩放。中央列不再限定16:9或裁切溢出模型，标题、说明与控件为绝对定位浮层，列高按视口确定，不随两侧档案卡内容拉长。结构工艺在右卡常驻，`showGuide` 控制同页结构示意；开关和复原不更换路由或重建canvas。

Three.js 通过 `alpha: true` 与透明清屏融合全页背景，不添加地面；`camera.setViewOffset` 以中央交互区域的构图和负偏移延展全页可见范围。尺寸变化同时观察画布容器、交互区域与页头，绘制像素比上限为2，并按 `MAX_RENDERBUFFER_SIZE` 限制画布缓冲区；修改时需检查模型越过中央边界的实际像素、面板与导航点击，以及退出后的观察器和图形资源释放。

章节地址与映射以 `src/hooks/useChapterRoute.js`、`src/config/chapters.js` 为准。当前四章为首页 `entry`、狮头与结构 `model`、动作 `action`、神态 `state`；旧 `intro` 映射 `entry`、旧 `structure` 映射 `model`，通过 `replaceState` 规范Hash且不新增历史记录。已移除的评分地址与其他未知Hash均回首页。`App` 在页面外保持唯一 `SiteHeader`，旧页内导航、搜索/菜单和底部入口已删除；四页品牌共用居中的 `BrandLockup` 与 `EntryLionEmblem`，不显示品牌辅助文字。媒体原路径定义在 `src/config/assetPaths.js`，浏览器引用经 `src/config/media.js` 补 `import.meta.env.BASE_URL`。页面数据集中在配置和数据文件，避免把同一媒体路径或章节文案复制到多个组件。

`ChapterNav` 的第五项是设置开关，不增加Hash路由。`DeveloperSettingsPanel` 贴右覆盖完整视口高度，内部独立滚动；打开状态不持久化。`useDeveloperSettings` 保存 `nanfeng-lion:developer-settings:v1`，校验类型、范围与步长；读写不可用时仍能现场调整。字体参数的 `navigationTypographyVersion: 2` 仅将未升级的旧20默认值一次提升至26，其他字段保持；随后手选20仍保留。历史数据未记录是否手选20，因此无法区别这两种旧值。

顶栏/侧栏分别使用背景alpha和backdrop-filter，透明度不淡化文字，模糊0显式为none。首页视频及模型背景延伸到顶栏后方以形成实际透出效果。开启推开时页面为侧栏留出实际宽度；`useSettingsPanelLayout` 用ResizeObserver和窗口resize判断，剩余空间不足900px时临时覆盖，保存原推开偏好。模型布局使用页面容器宽度适配，参数变化不重建video/canvas。

`ResizeHandle` 覆盖顶栏底边或侧栏左边，悬停整条边界在中心显示微交互提示。pointer capture、窗口兜底监听和单一RAF处理实时预览，松手后才持久化；Escape、pointercancel、失去capture/窗口焦点、pagehide和卸载恢复原值，清理监听、RAF、capture及全局拖动样式。方向键、Shift加速、Home/End及双击复原可用。修改此组件时需回归取消不会同时关闭面板、离页清理与实际视图尺寸。

导航字体的WOFF和OFL许可位于 `source/public/assets/fonts/`，来源及生成脚本在 `source/fonts/navigation-brush/`；`SiteHeader` 用集中媒体URL定义font-face，兼容Vite相对基址。数字、标题与辅助文字继承同字体/同字号，数字、图标为白色，辅助透明度独立调整；修改导航或品牌文字后重新生成子集。运行检查包含字体和全部审查图的大小及SHA256。

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
npm run test:e2e
```

构建后可运行 `npm run test:e2e:preview` 回归生产预览。Python 眼层检查使用 `python -B -m unittest discover -s tests/assets -p 'test_*.py'`；v4素材尚未生成时对应检查会显示 skip，需与通过项分开记录。

模型全页绘制的浏览器断言使用真实滚轮及WebGL读像素，检查整体与结构示意状态的模型在旧16:9和当前中央交互区域上下边界外均有实际像素，同时验证默认角落透明、同页共享单canvas、离页释放及重入。2026-10-11历史裁切修正验证见 [全页画布修正日志](../wiki_memory/日志/UI修改/2026-10-11-模型全页画布与裁切修正.md)。2026-10-12融合首页任务实际完成资产8项（330.6ms）、生产构建（56模块）、开发19项（29.9秒）与生产预览19项（28.7秒）回归；构建仍有既有 `lionScene` 超500kB提示。预览首次18/19源于测试将 `/assets` 与 `./assets` 作字面比较，改用 `new URL` 解析后全量通过，产品未因此修改。实际播放脚本观察入场自然ended一次、首页循环回绕一次、返回/刷新不自动入场及手机四图载入，错误数组为空；结果见 [本轮日志](../wiki_memory/日志/功能添加/2026-10-12-入场首页融合与醒狮文化长页.md)。

当前 Playwright 配置使用完整Chromium通道，可由 `PLAYWRIGHT_CHANNEL` 指定已安装的浏览器通道。全局导航与设置侧栏任务实际完成资产9项、63模块构建、Chrome开发/生产预览各30项（43.6秒/40.5秒）；输出为 `tmp/e2e-unified-navigation-dev`、`tmp/e2e-unified-navigation-preview`。回归同时保留原视频/文化/模型行为，并覆盖新材质、推开回退、存储/迁移、拖动与取消清理。最终通过的导航审查图在 `source/reviews/navigation/2026-10-12-larger-typography/`，各版UI均在source归档、登记清单。详情见 [导航与侧栏日志](../wiki_memory/日志/UI修改/2026-10-12-全局顶栏与玻璃设置侧栏.md)。此前实际播放脚本为临时 `tmp/verify-unified-entry.mjs`，三张首页融合审查图仍在 `source/reviews/homepage/2026-10-12-unified-entry/`；临时输出不纳入源码。

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
