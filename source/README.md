# 工程资源目录

`source/` 统一管理媒体、模型、创作源文件、设计文档、审查截图与参考资料。应用代码位于根 `src/`。

| 分类 | 存放内容 | 网页构建 |
| --- | --- | --- |
| `public/assets/entry/` | 首页循环视频、封面与图片标题 | 复制到 `dist/assets/entry/` |
| `public/assets/intro/` | 当前入场视频与运行海报 | 复制到 `dist/assets/intro/` |
| `public/assets/models/` | 当前网页使用的 GLB 模型 | 复制到 `dist/assets/models/` |
| `public/assets/poster/` | 网页使用的预览与海报 | 复制到 `dist/assets/poster/` |
| `public/assets/live2d/` | 保留的 Live2D 运行包、本地库与许可说明 | 随 publicDir 复制，当前首页不加载 |
| `models/` | 保留的优化与面部绑定模型版本 | 不复制 |
| `live2d/` | 分层图、PSD、Cubism 工程与原始导出 | 不复制 |
| `video/intro/` | 入场视频制作版本、对照海报 | 不复制 |
| `reviews/homepage/` | 首页视觉审查图 | 不复制 |
| `reviews/video/` | 视频抽帧、接触表、尾帧与动作审查图 | 不复制 |
| `reviews/react-entry/` | 迁移前 React 入口及章节审查截图 | 不复制 |
| `design/` | 设计稿、方案说明与历史实施计划 | 不复制 |
| `references/` | 资料来源说明 | 不复制 |

根 `texture_00.png` 与 Cubism 导出文件归入 `live2d/root-export/`；根首页审查 PNG、视频审查 JPG 和抽帧目录归入 `reviews/`；原 `output/` 中的模型及分层创作文件归入对应 `models/`、`live2d/` 或 `design/`。资源位置以当前目录为准，旧方案中的 `site/`、`output/`、`data/` 路径只供历史追溯。

`public/` 是 Vite 静态资产根目录。相对网页地址 `assets/entry/home-lion-loop.mp4` 对应 `source/public/assets/entry/home-lion-loop.mp4`；文件路径集中维护在 `src/config/assetPaths.js`，`media.js` 补上 Vite 基址。新增素材先区分运行版与创作版，只有需要随网页交付的文件放入 `public/`。

未启用的 Live2D 包保留供后续接入，不代表其视觉问题已解决；继续制作前读 [Live2D 说明](public/assets/live2d/README.md)。动作和评分资料尚未完整补齐，来源边界见 [资料说明](references/sources.md)。

`asset-manifest.json` 记录68条二进制迁移快照的来源路径、现路径、大小和 SHA256。`npm test` 检查这些资源是否完整保留；后续主动替换素材时应审核并同步对应记录，保留变更原因。

本轮浏览器验收截图生成在 `tmp/e2e-dev/`、`tmp/e2e-preview/`，默认测试输出为 `test-results/`；它们属于运行产物，不加入历史素材快照。

历史方案与设计资料保存原文；当前工程状态由 [工程记忆](../wiki_memory/README.md) 统一维护。
