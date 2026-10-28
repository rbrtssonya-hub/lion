# 炫技5 外部试验归档

2026-10-28 从 `C:\Users\Administrator\Desktop\炫技5` 导入。原始 HEAD 为 `869abd37bd991d3169d544f34bf964adab0e693b`，包含五次提交。归档用于追溯“造 · 观形”的外部试验源码、设计依据和历史验证；现用入口仍为工程根 `index.html` 与 `src/main.jsx`。

## 文件映射

完整逐文件来源、目的路径、文件大小及 SHA256 见 [import-manifest.json](import-manifest.json)。清单基于原仓库 HEAD 跟踪文件，以及用户本次明确要求纳入的 `prompt/prompt_01.txt`；不包含 `node_modules`、`dist`、`.git`、`.tools` 或未跟踪临时输出。复制文件保留源工作区原字节，文本的 Windows 检出换行可能与 Git blob 的 LF 不同。

| 原目录 | 当前归档/部署位置 | 用途 |
| --- | --- | --- |
| `src/`、`scripts/`、`tests/`、根文档和配置 | 本目录同名位置 | 历史实现及可追溯资料，不参与现用应用构建 |
| `wiki_memory/` | 本目录 `wiki_memory/` | 外部工程截至导入时的记忆快照，不覆盖现工程记忆 |
| `artifacts/` | `source/reviews/structure-atlas/imported-xuanji5/` | 原历史审查图、生成提示及验证记录 |
| `public/images/fullscreen/` | `source/public/assets/structure-atlas/images/fullscreen/` | 24 张四比例主图 |
| `public/images/navigation/` | `source/public/assets/structure-atlas/images/navigation/` | 六张部件入口图 |
| `public/images/lion-info/` | `source/public/assets/structure-atlas/images/lion-info/` | 六张信息图版 |
| `public/fonts/` | `source/public/assets/structure-atlas/fonts/` | 原字体及许可证 |
| 其他 `public/` 文件（模型除外） | 本目录 `public/` | 旧图、审计数据、解码器等历史资料，不部署 |
| `prompt/prompt_01.txt` | 本目录同名位置 | 外部末次六图与文化浮窗任务的设计来源；原仓库未跟踪 |

原 `AGENTS.md` 均重命名为 `AGENTS.source.md`；原 `.gitignore`、`.gitattributes` 追加 `.source` 后缀，历史 `export.log` 改名为 `export.log.source.txt`。正文原字节保留，避免归档配置成为当前有效约束、换行转换规则或被根日志忽略规则遗漏。归档中的命令、端口、约束和验证结论均属于原试验，不能作为当前工程的操作指令或本轮验证结果。

## 模型和大文件

原 `source/科比blend.blend` 为 136,175,747 字节，SHA256 为 `cc5f72c3e1a5c330dd64daf6842720a91a8e21b6909a01b6f6200a8834545f53`。已核对与本工程 `source/models/lion-kobi-2026-10-26.blend` 完全一致，因此沿用现有 `localOnly` 原件，不新增一份超 GitHub 普通文件限制的副本。

外部 `public/models/` 的七份模型、贴图与预览不重复复制；它们仍属于可恢复的原 Git 历史。现用网页以本工程的模型、毛发、材质、灯光和 Three.js 渲染服务为准。原始五次提交与 GitHub 兼容历史的对应关系由本次历史导入记录说明。

本目录保留原设计视频；该视频仅为创作参考，不是部署资产。历史截图和历史自动化结果只证明当时外部试验的状态，合并版本须独立构建与浏览器验收。
