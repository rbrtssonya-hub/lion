# 醒狮八态纵深 V7 资产接入来源

2026-10-28。来源为用户现有独立工程 `F:/数媒竞赛/醒狮八态纵深独立版` 的 V7。该独立目录没有 Git 元数据；本次按其实际文件和 SHA-256 识别版本，不将它称作已存在的 Git 分支或提交。独立工程的历史验收不代替主站接入后的构建和浏览器回归。

## 接入范围与复用

网页运行资产放入 `source/public/assets/expression-depth/`，通过 `src/config/assetPaths.js` 和现有 `src/config/media.js` 的 BASE_URL 映射读取。新增 25 份运行文件，共 10,358,286 字节；其中 8 段旁白、5 个视觉文件、6 个 WOFF2 和 6 份字体许可。未把独立项目的整套 dist、依赖、截图或历史方案放入运行目录。

主站现有的 8 张狮头、8 张隐藏补绘和 8 张单字毛笔字图，均与独立 V7 对应文件逐项 SHA-256 一致，直接复用，不重复分发。逐文件来源、字节数、哈希与源代码版本指纹见 [资产导入清单](../design/expression-depth/v7/import-assets.json)。

| 神态 | 主狮头 media 键 | 隐藏补绘 media 键 | 单字 media 键 | 新旁白 media 键 |
| --- | --- | --- | --- | --- |
| 喜 | expressionJoy | expressionJoyUnderpaint | expressionGlyphJoy | depthNarrationJoy |
| 怒 | expressionAnger | expressionAngerUnderpaint | expressionGlyphAnger | depthNarrationAnger |
| 哀 | expressionSorrow | expressionSorrowUnderpaint | expressionGlyphSorrow | depthNarrationSorrow |
| 乐 | expressionDelight | expressionDelightUnderpaint | expressionGlyphDelight | depthNarrationDelight |
| 动 | expressionMotion | expressionMotionUnderpaint | expressionGlyphMotion | depthNarrationMotion |
| 静 | expressionStillness | expressionStillnessUnderpaint | expressionGlyphStillness | depthNarrationStillness |
| 惊 | expressionSurprise | expressionSurpriseUnderpaint | expressionGlyphSurprise | depthNarrationSurprise |
| 疑 | expressionDoubt | expressionDoubtUnderpaint | expressionGlyphDoubt | depthNarrationDoubt |

`depthPaperBackground` 是独立版的 `paper-reference.png`，原来源为用户提供的《醒狮模型背景.png》，SHA-256 为 `aa62559fbbf74b40ef1020a469f839a10f7332d5eb99a9683f2dfa1a310c9a91`。作为暖纸色和低对比边缘水墨氛围使用。

`depthTitleAtlas` 与 `depthContactAtlas` 分别是透明标题字谱 `title-atlas.png` 和回望补充字谱 `contact-extra-atlas.png`，都是 AI 辅助生成的飞白字形。前者为 4×2 网格，后者补充“一、面、情、随、鼓、生、再、观”。CSS 透明蒙版负责颜色，真实中文仍应保留在 DOM。原提示词、网格与生成路径分别保存在归档 [BRUSH-GLYPH-SOURCES.json](../design/expression-depth/v7/reference/BRUSH-GLYPH-SOURCES.json) 与 [CONTACT-BRUSH-ATLAS-SOURCE.json](../design/expression-depth/v7/reference/CONTACT-BRUSH-ATLAS-SOURCE.json)。

`depthFallback` 为独立 V7 原有 SVG 后备图像；主站仍须保留可读标题、图片说明及失败提示。

## 获批的 Q 版路线图标

`depthRouteMarker` 使用 `ui-lion-marker-q.png`，1254×1254 RGBA，SHA-256 为 `75e844450406311cb43c3e47931bd8c7d6696ba3dac9b1c5fd45e7c2ab08cf26`。这是内置 image_gen 新生成的 Q 版醒狮，具有真实透明通道；源独立工程记录用户于 2026-10-28 明确“通过，替换成这张”后才接入。首次未通过的印记稿未作为本次运行图标。

原始完整提示词、审核文字、透明通道与哈希记录保存在 [UI-MARKER-SOURCE.json](../design/expression-depth/v7/reference/UI-MARKER-SOURCE.json)、[候选来源](../design/expression-depth/v7/review/v7/marker-q-candidate.source.json) 和 [透明通道报告](../design/expression-depth/v7/review/v7/marker-q-candidate.alpha.json)。工具未公开模型版本选项，不宣称已确认 Image2 或其他具体版本。

## 本地字体和许可

| media 键 | 字体族 | 样式和字重 | 本地许可键 |
| --- | --- | --- | --- |
| depthFontBrush | Ma Shan Zheng | normal / 400 | depthFontBrushLicense |
| depthFontSerif | Noto Serif SC | normal / 400–600 | depthFontSerifLicense |
| depthFontSans | Noto Sans SC | normal / 400–600 | depthFontSansLicense |
| depthFontManrope | Manrope | normal / 200–800 | depthFontManropeLicense |
| depthFontSpace | Space | normal / 300–700 | depthFontSpaceLicense |
| depthFontInstrument | Instrument | italic / 400 | depthFontInstrumentLicense |

六套字体按独立 V7 的原字节携带，对应许可均为 SIL Open Font License 1.1。中文子集的官方来源、源 CSS 地址、字符清单与 SHA-256 保存在 [TYPOGRAPHY-SOURCES.json](../design/expression-depth/v7/reference/TYPOGRAPHY-SOURCES.json)。三套英文字体用于保留独立版已有西文排版。系统 STXingkai/华文行楷不随项目分发；未安装时使用随包开源字体后备。

字体声明应由组件通过 media 的实际 URL 注入，不硬编码根目录 `/fonts/`。子集是当前文案的子集，后续增加文字应再次检查覆盖并按需再生成；不能把历史字体报告当成新文字已覆盖的证据。归档 [update-font-subsets.py](../design/expression-depth/v7/scripts/update-font-subsets.py) 保留原独立工程路径和调用方式，直接在主站运行前需调整其工作目录及输入文件。

## 旁白和 AI 辅助边界

八段 WAV 原样来自独立 V7：Windows System.Speech / SAPI 的 Microsoft Huihui Desktop 普通话女声合成，非真人录音、非声音克隆。格式为 24 kHz、单声道、16-bit PCM；网页播放本地 WAV，不依赖访问者的系统安装该声线。源独立工程没有使用 Qwen3-TTS，也没有下载该模型。

旁白只串联每态既有标题、副标题和三行介绍，不引入新的历史断言、识别结果或评分。完整文案与生成参数见 [NARRATION-SOURCES.json](../design/expression-depth/v7/reference/NARRATION-SOURCES.json)，原复现脚本见 [generate-narration.ps1](../design/expression-depth/v7/scripts/generate-narration.ps1)。脚本保留独立版路径，改文案后须同步重生成音频。

八态狮头、隐藏补绘、标题字谱和路线图标均是 AI 辅助视觉演绎。八态是本项目的定性观察框架，等待真实图片/视频样本校核；不代表情绪识别、动作捕捉、量化测量、教学评分或固定情绪发展顺序。理解表演仍需结合情节、锣鼓、身段和连续动作。原 [素材来源](../design/expression-depth/v7/reference/ASSET-SOURCES.json) 与 [五官动作来源](../design/expression-depth/v7/reference/FACE-MOTION-SOURCES.json) 已归档，路径保留为当时独立工程的来源记录。

## 本次资产验证

- Windows / Node24.20.0，主站 `main@edafc0705a3ed52c6083e01e0c0948b1f5e8b1e2` 加本次并行接入工作区。
- `node --test tests/assets/asset-integrity.test.mjs`：10/10，通过，exit 0；包含全清单大小/SHA、运行资产必须登记、私有创作/审查文件不进 public 等检查。
- 既有清单 1225 条对象逐字段保持；仅追加本次 40 条至 1265。新增运行/归档文件使用实际字节与 SHA-256；既有 24 份复用图逐项与 V7 源文件相同。
- `git diff --check -- src/config/assetPaths.js source/asset-manifest.json`：通过。WAV 格式、WOFF2 头长度与字体许可另外按实际文件核对；字体新页面解码和新增文案覆盖需结合主站浏览器验收。
- [归档的独立版 V7 验收](../design/expression-depth/v7/review/VALIDATION-v7.md) 属于独立工程历史证据。本文件的资产检查不等同主站构建、整页视觉、WebGL、音频播放或浏览器交互已通过。
