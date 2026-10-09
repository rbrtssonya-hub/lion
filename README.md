# 南风有狮 · 醒狮信息可视化

本项目使用 React + Vite，包含醒狮视频首页、入场视频、Three.js 三维展示和六个章节入口。应用源码位于 `src/`，媒体、模型、创作材料与审查图片统一位于 `source/`。

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
│  ├─ features/                # 首页、入场、模型及章节功能
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

- 首页循环视频和图片标题保留；六个章节为入场、整体、结构、动作、神态、评分。
- 整体和结构章节复用本地 Three.js 模型场景；动作、神态、评分保留已有占位，不将尚无来源的数据当作成品功能。
- Live2D 包与创作源文件保留供后续重制；当前首页使用视频，模型清单的 `needs-layer-rebuild` 状态尚未解除。说明见 [Live2D 资产说明](source/public/assets/live2d/README.md)。
- 工程记忆采用 `standard` 模式，从 [工程记忆](wiki_memory/README.md) 开始读取。当前架构、约束、待办与问题分别维护；历史方案不替代当前状态。

## GitHub 与本地同步

GitHub 仓库页面展示所选分支已经提交并推送的文件。本地未提交的改动和未跟踪的新文件不会出现在页面上。此前 React/Vite 重构与资源整理留在工作区，导致 GitHub 仍显示旧的 `site/`、`react/`、`output/` 目录及简短 README；此次同步将根入口、`src/`、`source/`、测试、开发说明和 `runStart.cmd` 纳入版本管理，并移除旧入口与已跟踪的旧构建输出。

`node_modules/`、`dist/`、`tmp/` 和测试运行输出由本地命令生成，不纳入提交。后续项目修改按 [AGENTS.md](AGENTS.md) 的交付约定同步工程记忆、验证、审查并提交推送；具体核实记录见 [工程记忆](wiki_memory/README.md)。
