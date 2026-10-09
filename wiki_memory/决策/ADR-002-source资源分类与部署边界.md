---
type: decision
status: active
updated: 2026-10-09
topic: source-asset-organization
sources:
  - "用户指令：2026-10-09 要求图片、视频审查图、方案等资源统一放到 source 文件夹并审查其他资源"
  - "source/README.md"
  - "source/asset-manifest.json"
  - "vite.config.js"
  - "src/config/assetPaths.js"
  - "tests/assets/asset-integrity.test.mjs"
---

# ADR-002 · source 资源分类与部署边界

## 背景与授权

根目录、旧 `site/assets/` 与 `output/` 同时出现视频审查图、首页截图、模型、分层图、PSD、Cubism 导出和设计方案。用户要求统一 `source/` 并按标准工程结构管理。

## 已采用选择

- 用户指定统一 source。Agent采用 `source/public/assets/` 保存网页运行资源，并配置为 Vite `publicDir`；以 `models/`、`live2d/`、`video/`、`reviews/`、`design/`、`references/` 管理非运行材料。
- 应用代码保留标准 `src/` 名称，开发文档放 `docs/`，辅助工具放 `scripts/`，测试放 `tests/`。`source/` 表示资源根，不替代 `src/`。
- 当前媒体路径集中 `src/config/assetPaths.js`，浏览器用 `media.js` 补 Vite `BASE_URL`。Live2D 本地运行包与许可说明保留在 public，PSD、Cubism 工程和创作分层移出 public。
- 保留既有二进制字节，68条迁移记录存于 `source/asset-manifest.json`；测试比较文件大小和 SHA256。主动更新素材时审核单条记录，不通过全量重写快照隐藏遗漏。
- 旧方案与历史实施计划移入 `source/design/`，保留历史文内路径，并标注不能替代当前开发入口。

## 代价与范围

publicDir 的文件原样复制，不经过 Vite 文件名哈希优化；大量运行媒体仍影响部署包大小。未启用 Live2D 包虽会复制到 dist，当前页面不会下载它。原始/创作素材与运行版可能保留相同字节的不同副本，用于明确创作与部署职责。

## 实施与验证线索

目录和 Vite配置已落地。`npm test` 检查快照、运行清单、public越界材料和 Live2D 包结构；完整执行结果见本轮迁移日志。后续更新素材同时检查 `source/README.md`、媒体配置及受影响测试。
