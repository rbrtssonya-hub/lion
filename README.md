# 南风有狮 · 醒狮信息可视化

本项目使用 React + Vite，包含入场首页、醒狮文化长页、Three.js 整体与结构展示。全局顶栏提供首页、狮头与结构、动作、神态四个章节入口，以及第五项界面设置。应用源码位于 `src/`，媒体、模型、创作材料与审查图片统一位于 `source/`。

## 启动开发服务器

在项目根目录打开终端，先安装依赖，再启动：

```powershell
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173/`。首次取得工程时使用 `npm ci` 按 `package-lock.json` 安装；主动修改依赖时使用 `npm install` 并同步锁文件。Node.js 版本要求见 `package.json` 的 `engines` 字段。

Windows 下安装依赖后，也可以双击根目录的 [runStart.cmd](runStart.cmd)。脚本自动切换到工程目录，执行 `npm run dev -- --open` 并打开浏览器；关闭服务时在命令窗口按 `Ctrl+C`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动支持热更新的 Vite 开发服务器 |
| `npm run build` | 将生产网页生成到 `dist/` |
| `npm run preview` | 本地预览 `dist/`，默认端口 4173 |
| `npm test` | 检查运行资产清单与包结构 |
| `npm run test:e2e` | 浏览器回归，测试配置自动启动开发服务器 |
| `npm run test:e2e:preview` | 浏览器回归生产预览；运行前先完成构建 |
| `npm run memory:index` / `npm run memory:check` | 刷新工程记忆索引 / 只读结构体检 |

浏览器测试需要 Playwright Chromium，首次运行可执行 `npx playwright install chromium`。辅助 Python 工具的依赖与运行方式见 [开发说明](docs/DEVELOPMENT.md)。

## 工程目录

```text
lion/
├─ index.html                   # Vite HTML 入口
├─ package.json                 # npm 命令、依赖与 Node 版本约束
├─ package-lock.json            # 唯一的 npm 依赖锁文件
├─ vite.config.js               # 根目录、静态资产与构建配置
├─ runStart.cmd                 # Windows 开发启动脚本
├─ src/
│  ├─ main.jsx                  # React 挂载入口
│  ├─ App.jsx                   # 章节与页面组合
│  ├─ components/              # 导航、视频与标题等公共组件
│  ├─ features/                # 首页、文化图文、模型及章节功能
│  ├─ hooks/                   # 章节路由等 React Hooks
│  ├─ config/                  # 媒体路径与章节元数据
│  ├─ services/                # Three.js 场景与资源生命周期
│  ├─ data/                    # 应用直接使用的结构化数据
│  └─ styles/                  # 按页面拆分的样式
├─ source/
│  ├─ public/assets/           # 网页静态资产，Vite publicDir
│  ├─ models/                  # 保留的优化与绑定模型版本
│  ├─ live2d/                  # PSD、Cubism 工程、分层及原始导出
│  ├─ video/                   # 视频制作版本和海报变体
│  ├─ fonts/                   # 毛笔字体来源、许可与子集生成方法
│  ├─ reviews/                 # 首页与视频审查截图、抽帧、回归图
│  ├─ design/                  # 设计稿、方案与历史实施计划
│  └─ references/             # 来源资料与内容说明
├─ scripts/                    # GLB、Live2D、Blender 等离线工具
├─ tests/                      # 资产检查与浏览器回归
├─ docs/
│  └─ DEVELOPMENT.md          # 工程开发与资源更新规范
├─ wiki_memory/                # 标准工程记忆、README导航与维护工具
└─ AGENTS.md                   # 后续开发指令与记忆接入
```

`node_modules/`、`dist/` 与测试运行输出由工具生成。`source/` 的分类规则见 [资源说明](source/README.md)；只有 `source/public/` 会作为静态资源进入生产构建。替换运行资源后，保持 `src/config/assetPaths.js`、`src/config/media.js` 与资产检查一致。

## 开发入口与当前边界

- 入场就是首页：当前浏览会话首次打开播放入场短片，结束或跳过后进入用户提供的首页循环视频；返回与刷新不自动重复，可用“重播入场”重新观看。原图片标题及动效保留。
- 首页首屏之后直接阅读四组醒狮文化图文，“探索更多”向下滚动到文化区；图文保留摄影署名、来源和许可链接，资料见 [文化来源说明](source/references/home-culture-sources.md)。
- 四页共用顶部导航与左上品牌，旧右上牌签、搜索/菜单和底部导航已移除；旧入场地址映射首页，旧结构地址映射狮头与结构。Logo 与“南风有狮”居中对齐，品牌不再附带说明文字。
- 顶栏第五项“设置”打开默认收起的右侧全高参数面板。顶栏/侧栏可分别调透明度与模糊，并可设置字号、图标、留白和“面板推开页面”；参数在本浏览器保存，窄窗口暂时覆盖显示。悬停顶栏底边或侧栏左边会出现居中提示，可拖动调节尺寸，Escape 取消、双击复原，亦支持方向键和 Shift 加速。
- 导航与品牌使用本地毛笔字体，序号和图标为白色，辅助文字为白色半透明；默认字号26px，较窄桌面自适应缩小。字体来源、SIL OFL 许可与可编辑文字的子集生成方式见 [字体说明](source/fonts/navigation-brush/README.md)。
- 整体页使用覆盖整页的透明 Three.js 画布，中央列负责拖动、缩放与热点交互；“查看结构示意”同页开关叠层，右侧始终提供结构工艺资料。模型可以越过中央列边界，与网页共用背景，没有独立内框或地台。动作、神态保留已有占位，不将尚无来源的数据当作成品功能。
- Live2D 包与创作源文件保留供后续重制；当前首页使用视频，模型清单的 `needs-layer-rebuild` 状态尚未解除。说明见 [Live2D 资产说明](source/public/assets/live2d/README.md)。
- 工程记忆采用 `standard` 模式，从 [工程记忆](wiki_memory/README.md) 开始读取。当前架构、约束、待办与问题分别维护；历史方案不替代当前状态。

2026-10-12全局导航与设置侧栏经用户UI通过后，资产9项、生产构建、开发及生产预览各30项浏览器回归通过；工程记忆已同步。范围与审查图见 [导航与侧栏任务日志](wiki_memory/日志/UI修改/2026-10-12-全局顶栏与玻璃设置侧栏.md)。此前视频替换及文化长页的实际播放证据见 [融合首页日志](wiki_memory/日志/功能添加/2026-10-12-入场首页融合与醒狮文化长页.md)。

## GitHub 与本地同步

GitHub 仓库页面展示所选分支已经提交并推送的文件。本地未提交的改动和未跟踪的新文件不会出现在页面上。此前 React/Vite 重构与资源整理留在工作区，导致 GitHub 仍显示旧的 `site/`、`react/`、`output/` 目录及简短 README；此次同步将根入口、`src/`、`source/`、测试、开发说明和 `runStart.cmd` 纳入版本管理，并移除旧入口与已跟踪的旧构建输出。

`node_modules/`、`dist/`、`tmp/` 和测试运行输出由本地命令生成，不纳入提交。后续项目修改按 [AGENTS.md](AGENTS.md) 的交付约定同步工程记忆、验证、审查并提交推送；具体核实记录见 [工程记忆](wiki_memory/README.md)。
