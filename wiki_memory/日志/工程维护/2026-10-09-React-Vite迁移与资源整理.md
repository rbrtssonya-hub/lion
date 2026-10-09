---
type: log
status: archived
kind: maintenance
task_status: completed
updated: 2026-10-09
topic: react-vite-source-migration-2026-10-09
sources:
  - "用户指令：2026-10-09 完整改造为 React+Vite、npm run dev、source 资源统一管理和 standard 工程记忆"
  - "package.json"
  - "package-lock.json"
  - "index.html"
  - "vite.config.js"
  - "src/main.jsx"
  - "src/App.jsx"
  - "src/config/assetPaths.js"
  - "src/config/media.js"
  - "src/config/chapters.js"
  - "src/components/VideoStage.jsx"
  - "src/features/model/ModelPage.jsx"
  - "src/services/lionScene.js"
  - "src/styles/model.css"
  - "source/asset-manifest.json"
  - "source/README.md"
  - "tests/assets/asset-integrity.test.mjs"
  - "tests/assets/live2d-package.test.mjs"
  - "tests/assets/test_live2d_eye_layers.py"
  - "tests/assets/test_live2d_eye_layers_v4.py"
  - "tests/e2e/app.spec.js"
  - "playwright.config.js"
  - "playwright.preview.config.js"
  - "scripts/requirements.txt"
  - "scripts/optimize-glb.js"
  - "AGENTS.md"
  - "wiki_memory/.memory.json"
---

# React + Vite迁移与资源整理

## 目标与完成范围

按用户要求将网页完整迁移为React + Vite，并通过根目录 `npm run dev` 启动。入口改为 `index.html` → `src/main.jsx` → `App`；首页、入场、模型/结构和其余章节按feature拆分。React管理热点、信息面板和界面状态，Three.js独立服务负责图形生命周期，退出页面会取消载入并释放资源。

移除旧 `site/`、`react/`、`data/`、`output/`、pnpm文件、旧Vite桥接配置和已归档计划的空目录；保留独立 `src/`、`source/`、`scripts/`、`tests/`、`docs/`。运行资产放 `source/public/assets/`，PSD/Cubism、模型版本、审查图、视频变体、方案和来源分别分类。旧计划移至 `source/design/plans/`，保留原文历史路径并加追溯说明。

统一npm锁文件，本地Three.js `0.160.0` 随模型模块延迟载入，无iframe和运行时CDN importmap。根Vite采用相对base与独立dist构建，watch忽略临时测试输出、trace、report及构建目录，避免运行测试时触发无关HMR。

wiki-memory按指定Skill先preview后apply，采用 `docs/wiki_memory/` 的standard模式。建立五页当前状态、3份ADR、2份知识和根AGENTS接入；用户选择与Agent实现选择分别记录。任务日志完成后索引/体检由主任务统一执行，避免并行覆盖。

## 验证环境与版本

2026-10-09，Windows PowerShell，Node.js `v24.16.0`、npm `12.0.1`、Python `3.14.2`，Playwright完整Chromium。起始分支main，revision `dbbc6a7`，工作树初始干净；以下结果均包含本地迁移改动，不代表该原始已提交revision通过。未提交、推送、部署或核对远程最新引用。

## 本轮实际执行

| 验证 | 实际结果与范围 |
| --- | --- |
| `npm install`、`npm ci` | 初始安装与锁文件重装均完成；ci重装69个packages后重新测试、构建及开发浏览器回归通过 |
| `npm test` | 6项通过：68条二进制大小/SHA256/清单完整性、6项运行媒体及public隔离、6热点、分层来源路径、Live2D包引用与动作结构 |
| `npm run build` | 独立dist构建通过；ci后及最后手机样式调整后再次通过 |
| `npm run test:e2e -- --output=tmp/e2e-dev` | 5项通过；ci后和最终修复后开发回归再次5项通过 |
| `npm run test:e2e:preview -- --output=tmp/e2e-preview` | 生产预览回归5项通过；最终修复后 `npm run test:e2e:preview` 再次5项通过 |
| `node --test tests/assets/live2d-package.test.mjs` | 独立包结构检查2项通过，随后纳入npm完整检查 |
| `python -B -m unittest discover -s tests/assets -p 'test_*.py'` | 6项：3通过，3因v4眼层未生成而skip；不计为全部6项通过 |
| 辅助脚本语法与入口 | 8个Python AST与3个JS语法检查通过；Blender导入脚本 `--help` 通过，未生成新素材 |
| GLB结构检查 | 287192顶点、284014三角形；坏索引、退化、非流形、非单位法线均0；236782条边界边为保留模型特性 |
| GLB优化器原件保护负向检查 | 同一现用发布模型作为输入与输出，脚本明确拒绝覆盖，前后SHA256一致；随后npm资产测试6项再次通过 |

浏览器回归覆盖首页视频/图片标题、六章切换、入场ended转场、实际3D ready、自动旋转和六热点、结构滑杆、390×844手机视口、加载503后的重试、快速离开后重新进入唯一canvas、视频失败继续模型、未知hash、后退和刷新。无iframe，无意外pageerror或404。人工查看桌面首页/模型及手机首页/结构截图，页面无横向溢出；最终手机结构滑杆与scene caption的重叠已修复并重新回归。

截图与trace保存在 `tmp/e2e-dev/`、`tmp/e2e-preview/` 或测试输出目录；这些是本轮运行产物，不进入68条素材快照。`source/reviews/react-entry/` 是迁移前历史审查图。

## 本轮修复与性能结果

视频不可播放的首轮检查发现：`play()` Promise失败处理覆盖了真正 `onError` 状态，导致显示播放阻止文案。`VideoStage`已区分 `NotAllowedError` 与真实媒体错误，并忽略AbortError；开发和生产预览回归重跑通过。

辅助工具审核发现原GLB优化器默认写入可覆盖已有文件，与保留原件约定不符；已补输出存在时拒绝，并使用独占写入 `flag: 'wx'` 防止检查后的竞态覆盖。本轮辅助工具唯一新增的行为护栏为此原件保护；原模型字节保持不变。

场景服务改用Three具名导入并保留动态载入边界，Three相关chunk从667.46 kB降至567.53 kB（gzip146.66 kB）；首页198.68 kB（gzip63.52 kB），样式20.78 kB（gzip5.30 kB）。构建仍有Three chunk超过500 kB的提示，未宣称完全无告警，进一步优化属于后续候选。

npm12本机策略未执行esbuild postinstall，但已安装Windows二进制可用，本轮实际构建通过；此为安装环境记录。PSD生成工具缺pytoshop，依赖已列在 `scripts/requirements.txt`，本轮只检查语法、未生成或验收新PSD。

## 保留边界与恢复下一步

动作、神态、评分仍为现有占位；GLB为合并网格，结构为语义/深度示意；Live2D清单仍 `needs-layer-rebuild`，视频首页未加载该包。素材保全、包结构测试和网页迁移不代表这些内容已成品化。

恢复时检查分支与未提交改动，读根AGENTS和standard必读状态，再运行 `npm ci`、`npm run dev`。后续内容、Live2D、性能和正式部署候选见 [[当前状态/当前待办.md|当前待办]]，按用户后续任务决定范围；本日志不扩大授权。工程记忆需随仓库跟踪或迁移，才能跨机器恢复。
