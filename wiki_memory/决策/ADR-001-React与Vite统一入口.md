---
type: decision
status: active
updated: 2026-10-09
topic: react-vite-application
sources:
  - "用户指令：2026-10-09 明确要求完整 React+Vite 网页架构并用 npm run dev 启动"
  - "package.json"
  - "vite.config.js"
  - "index.html"
  - "src/main.jsx"
  - "src/App.jsx"
  - "src/services/lionScene.js"
---

# ADR-001 · React 与 Vite 统一入口

## 背景与授权

用户要求将工程完整迁移为 React + Vite，并规范文件管理。旧入口混合 React 框架与传统网页，源码、运行素材和已有构建文件混放，不适合继续深入开发。

## 已采用选择

- 用户指定 React + Vite 与 `npm run dev`。Agent 在授权范围内采用根 `index.html`、`src/main.jsx`、`src/App.jsx` 的单页结构，去除旧入口桥接和 iframe 页面边界。
- 页面按 feature 拆分，公共组件、配置、Hooks、应用数据、样式和三维服务分别管理。React 管界面与生命周期，Three.js 服务接收 DOM 容器、取消信号与状态回调。
- 依赖统一 npm；保留 React/ReactDOM `19.1.1`、Vite `7.1.9`，Three.js `0.160.0` 改由本地 npm 包加载。版本选择由 Agent依据原依赖及兼容迁移作出，用户没有逐一指定版本。
- 使用 Hash 章节路由，避免静态托管时要求配置每个章节的服务器回退。模型页与场景服务延迟加载，降低首页加载依赖。
- Vite 构建输出单独 `dist/`，不回写源码或资源目录。

## 代价与范围

工程需要先安装 Node/npm 依赖，再启动 Vite；当前目标没有增加动作、神态与评分的成品内容，也没有指定正式部署平台。三维显示仍依赖浏览器 WebGL，失败时保留预览与重试界面。

## 实施与验证线索

入口和模块选择已在列出的源码落地，完整浏览器验证结果以迁移日志为准。后续维护从 `src/App.jsx`、`useChapterRoute` 与模型服务开始，不重新引入旧 `site/` 或 CDN importmap。
