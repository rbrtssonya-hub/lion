# 炫技3：地域邮票工程归档

2026-10-28 从 `C:\Users\Administrator\Desktop\炫技3` 导入，原仓库 HEAD 为 `8764e9b484a372fc17e0595fc2a017be2cbc3d48`。用户指定的是 `runGo.cmd` 开发服务器：它调用 `scripts/start-edition.mjs regional`，实际使用 `editions/regional/` 的十二枚地域邮票与六种命名光影算法。根 `src/`、`public/` 是保留的旧八态版，不能误作为本次运行基准。

## 文件映射和字节保全

[import-manifest.json](import-manifest.json) 保存原仓库当前跟踪的全部 1,283 个文件、原 Git blob SHA、文件模式、迁移路径、大小与 SHA256。共 553,039,765 字节，复制后逐项校验通过；原版与地域版包含大量同字节历史截图，保留各自目录以维持追溯路径，Git 存储仍按内容去重。

| 原位置 | 当前位置 | 文件数 | 用途 |
| --- | --- | ---: | --- |
| `editions/regional/public/assets/stamps/` | `source/public/assets/spread-stamps/stamps/` | 12 | 本次部署的地域票面 PNG，38,660,775 字节 |
| 根 `artifacts/` | `source/reviews/spread-stamps/imported-xuanji3/original/` | 与下一行合计 995 | 原八态版历史审查及研究证据 |
| `editions/regional/artifacts/` | `source/reviews/spread-stamps/imported-xuanji3/regional/` | 合计 433,897,159 字节 | 地域版历史审查及研究证据 |
| 其余跟踪文件 | `source/archives/xuanji3/original-project/` 中的同名相对位置 | 276 | 双版本源码、完整工程记忆、设计稿、测试、脚本和配置；80,481,831 字节 |

除十二张地域票面外，其余旧版图片、源文件与历史资料不进入网页运行资产。所用纸纹法线由 `SurfaceTexture.js` 生成，动态光场由 `DappledLight.js` 与 `dappledShaders.js` 生成，不存在应额外拷贝的外部法线、深度或环境下载纹理。原仓库没有独立跟踪的字体或许可文件；原完整文档和源代码注释均保留，不另编造许可结论。

原 `AGENTS.md` 统一改名为 `AGENTS.source.md`，原 `.gitignore`、`.gitattributes` 追加 `.source`，历史 `.log` 文件追加 `.source.txt`。正文原字节保持，防止归档指令、换行过滤或忽略规则成为本工程的现用约束。根工程记忆继续以 `wiki_memory/` 为唯一现行入口；外部完整标准记忆位于 `original-project/wiki_memory/`，仅作为历史资料。

本次只复制 Git 跟踪文件。原工程未跟踪的 `prompt/`、`source/Picture_01/` 保留原位，未纳入复制或提交；`node_modules/`、`dist/`、`.sites-runtime/`、`.git/` 等依赖、产物、缓存不复制。源目录、源 Git 分支及其 remote 未修改。

## Git 增量历史

本工程原主线与炫技3没有共同祖先，本轮初始主线无法到达该仓库的十次提交。历史中 910 个唯一 blob 合计 339,367,248 字节，最大仅 6,262,000 字节，不存在超过 100 MiB 的普通文件障碍，因此可以保留原始 SHA、作者、提交者、时间和完整拓扑直接合入。地域开发支线与其回并提交也保留，不将已有十次演进压成一次快照。

原 tip 对象已取入本工程对象库，没有修改 HEAD、当前分支或 index。主代理在完成选择性运行集成、检查和冲突审查后，以 `8764e9b484a372fc17e0595fc2a017be2cbc3d48` 为集成提交的另一父链；GitHub 最终结果以本轮当前工程日志和实际分支核对为准。审计原始 SHA、祖先关系、对象连通及原 commit 字节校验见 [history-audit.json](history-audit.json)。

原历史整树可用以下命令查看：

```powershell
git log --graph --oneline 8764e9b484a372fc17e0595fc2a017be2cbc3d48
git show 8764e9b484a372fc17e0595fc2a017be2cbc3d48:editions/regional/src/rendering/StampMaterial.js
git show 8764e9b484a372fc17e0595fc2a017be2cbc3d48:wiki_memory/当前状态/系统架构.md
```

本目录的原测试报告只证明外部工程当时的版本，不能替代 lion 当前组合版本的真实运行验收。完整移植的光影实现和主工程参数页，由现用 `src/services/spread-stamps/` 及设置模块维护；此归档不建立第二套网页入口。
