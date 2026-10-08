# 《一头醒狮的出场》实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成一个“AI醒狮视频开场 → 铜镜转场 → 可操作醒狮3D模型 → 结构、动作、神态和竞技评分信息可视化”的可运行网页或交互原型。

**Architecture:** AI视频只负责开场叙事，GLB模型负责完整醒狮展示和交互导航，结构图、时间轴、对比图和评分器负责传达信息。当前GLB是单个合并网格，因此局部内容采用热点高亮、引线和结构示意，不把合并网格伪装成已经分离的真实部件。

**Tech Stack:** HTML、CSS、JavaScript、Three.js、GLTFLoader、SVG/Canvas、JSON、GLB、MP4。

**Spec:** `醒狮_一头醒狮的出场_更新方案.md`

## Global Constraints

- AI视频时长控制在6—10秒，视频只负责叙事氛围。
- 3D模型使用现有醒狮GLB，保留原始文件，不覆盖源文件。
- 结构示意必须标注“资料重建”或“结构示意”。
- 动作数据必须标注“公开视频样本分析”。
- AI生成的画面必须标注“AI辅助创作”。
- 不虚构实地拍摄、采访、师傅测量和官方统计。
- 不把不同年份的醒狮评分规则混在同一张图表中。
- 首屏视频和3D模型的视觉角度、主体位置和主光方向要保持一致。
- 信息图表和评分器的面积与重要性高于装饰性特效。

## Review Focus

- 视频结束角度与3D模型初始角度不一致，导致铜镜转场跳变；由视频制作任务和网页交接任务分别验收。
- GLB模型文件过大或加载失败，导致首屏无法进入；由3D资源任务验收文件解析和加载。
- 合并网格被误解为已拆分部件，导致作品说明失实；由结构信息任务验收标签和方法说明。
- 动作图表只有动作名称没有数据，导致作品退化为动画展示；由动作数据任务验收时长、频次和样本来源。
- 评分规则没有标注年份，导致不同版本分值混用；由评分器任务验收规则版本和计算结果。

## 当前状态

- 方案说明已更新为 `醒狮_一头醒狮的出场_更新方案.md`。
- 原始模型位于 `F:\数媒竞赛\模型\lux3d_model_exports\img23d_21199.glb`。
- 原始模型已完成结构检查：1个节点、1个网格、1个材质、2张嵌入贴图、约28.7万个顶点、约28.4万个三角形。
- 已生成结构优化版 `output/img23d_21199_优化版.glb`，保留原材质和贴图。
- 当前还没有完成AI视频、数据表格和网页原型。

### Task 1: 锁定资料和数据字段

**Files:**
- Create: `data/sources.md`
- Create: `data/lion-structure.json`
- Create: `data/lion-motion-samples.json`
- Create: `data/lion-expressions.json`
- Create: `data/lion-scoring.json`

**Produces:** 统一的数据字段和来源标记，供网页直接读取。

- [ ] 建立资料来源表，至少记录来源名称、链接或出版信息、对应内容和可信度。
- [ ] 在 `lion-structure.json` 中记录部件名称、材料、功能、说明类型和来源标记。
- [ ] 在 `lion-motion-samples.json` 中为每条公开视频记录视频名称、来源、动作名称、开始秒数、结束秒数、持续秒数和备注。
- [ ] 在 `lion-expressions.json` 中分别记录传统八态和竞技十态，并保留两套列表的来源说明。
- [ ] 在 `lion-scoring.json` 中为每个规则版本记录年份、评分项目、满分、扣分条件和来源。
- [ ] 检查所有数字是否有来源；没有可靠数字的字段不写精确值，改用定性说明。

**Verification:** 打开5个JSON文件，确认字段命名一致；抽查每个数值都能回到 `data/sources.md` 的来源记录。

### Task 2: 设计AI视频和模型交接

**Files:**
- Create: `docs/storyboard.md`
- Create: `public/assets/intro/lion-intro-v01.mp4`
- Create: `public/assets/intro/lion-intro-poster.jpg`

**Produces:** 一段可作为网页第一屏的AI醒狮开场视频和一份镜头说明。

- [ ] 写出4到5个镜头的分镜：醒狮轮廓、局部细节、狮眼睁开、铜镜推进、模型交接。
- [ ] 固定最后一帧的醒狮角度、主体位置、背景颜色和主光方向。
- [ ] 使用现有醒狮参考图保持红金配色、铜镜、鼓眼、白须和广府南狮特征。
- [ ] 生成至少一个6—10秒版本，检查是否出现多余人物、文字、水印、变形部件和不必要场景。
- [ ] 为网页生成一张首帧或末帧海报，避免视频加载前出现空白。
- [ ] 在分镜中注明“AI辅助创作”，不把视频内容当作真实现场记录。

**Verification:** 用播放器检查视频首尾是否完整；确认末帧可以与GLB的初始三维视角进行构图对齐。

### Task 3: 准备网页用GLB

**Files:**
- Create: `public/assets/models/lion-overall.glb`
- Create: `public/assets/models/lion-overall-preview.jpg`
- Modify: `scripts/inspect-glb.js`
- Create: `docs/model-asset-report.md`

**Produces:** 一个网页可加载的醒狮模型、预览图和资源报告。

- [ ] 以原始GLB或已验证的优化版为来源制作网页副本，不能覆盖原始模型。
- [ ] 保持整体轮廓、材质和贴图不变，先记录压缩前后的文件大小。
- [ ] 将网页模型命名为 `LionHead_Overall`，把部件热点当作语义标签保存。
- [ ] 检查GLB头、JSON长度、二进制长度、索引范围、贴图引用和材质数量。
- [ ] 记录模型是合并网格，明确说明局部展示使用热点高亮和结构示意。
- [ ] 生成一个固定角度的预览图，作为视频交接的对照图。

**Verification:** 使用 `node scripts/inspect-glb.js public/assets/models/lion-overall.glb` 检查0个坏索引、0个退化三角形，并确认材质和贴图仍然存在。

### Task 4: 搭建网页骨架和视频转场

**Files:**
- Create: `site/index.html`
- Create: `site/styles.css`
- Create: `site/src/main.js`
- Create: `site/src/transition.js`
- Create: `site/src/data-loader.js`

**Interfaces:**
- `loadProjectData()` 读取 `data/*.json` 并返回统一数据对象。
- `createLionScene(container, modelUrl)` 创建Three.js场景并返回 `{ scene, camera, renderer, model, setView, setHotspot }`。
- `playIntroToModelTransition(video, model, options)` 按视频结束事件完成铜镜交接。

- [ ] 创建全屏首屏容器，视频、模型画布、信息层和跳过按钮使用同一个定位舞台。
- [ ] 使用Three.js和GLTFLoader加载 `lion-overall.glb`，加载完成前显示海报和加载状态。
- [ ] 设置模型初始机位，使其与AI视频末帧保持相同构图。
- [ ] 视频结束时暂停在铜镜推进画面，模型从相同位置和缩放开始显示。
- [ ] 让视频在400毫秒内渐隐，模型在400毫秒内渐显，保留约200毫秒重叠。
- [ ] 提供跳过视频入口，跳过后直接进入完整三维模型。
- [ ] 检查手机窄屏和桌面宽屏，确保文字和按钮不遮挡模型。

**Verification:** 在浏览器中完成一次自动播放交接和一次跳过视频交接；刷新页面后模型仍能加载，视频失败时仍能进入模型。

### Task 5: 制作醒狮结构信息层

**Files:**
- Create: `site/src/structure-panel.js`
- Create: `site/src/hotspots.js`
- Create: `site/assets/structure/lion-structure.svg`

**Produces:** 可点击的醒狮部件信息层和结构示意图。

- [ ] 建立热点：`outer_shell`、`eyes`、`mouth`、`horns`、`mirror`、`fur_and_bells`。
- [ ] 点击热点时让模型局部高亮，并显示名称、材料、功能和来源标记。
- [ ] 使用SVG表达由内到外的结构关系，不宣称SVG是从GLB中分离出的真实内部模型。
- [ ] 为“竹篾骨架”和“纸层”添加“资料重建”标记。
- [ ] 让用户能关闭信息卡并回到完整模型。

**Verification:** 逐个点击6个热点，确认每个热点都有内容、有来源标签，并且关闭后不会残留遮挡。

### Task 6: 制作动作、神态和评分可视化

**Files:**
- Create: `site/src/motion-timeline.js`
- Create: `site/src/expression-compare.js`
- Create: `site/src/scoring-calculator.js`
- Create: `site/src/charts.css`

**Produces:** 三个真正承载信息的交互模块。

- [ ] 动作时间轴从 `lion-motion-samples.json` 读取数据，显示动作顺序、持续时间和样本来源。
- [ ] 动作频次图和鼓点波形只使用已经记录的数据，不在前端临时编造数字。
- [ ] 八态和十态使用并列对比，清楚标出新增和替换的神态。
- [ ] 评分器从 `lion-scoring.json` 读取指定年份规则，计算动作规格、艺术表现、难度和失误扣分。
- [ ] 规则版本切换时同步更新标题、分值和来源，禁止跨版本混算。
- [ ] 在模块底部显示“公开视频样本分析”或具体规则年份。

**Verification:** 使用一组固定输入手算并对照评分器结果；切换规则年份后，检查分值和来源同时变化；数据为空时显示明确的资料状态。

### Task 7: 串联叙事和结尾

**Files:**
- Modify: `site/src/main.js`
- Create: `site/src/scroll-story.js`
- Create: `site/src/source-panel.js`

- [ ] 按“完整醒狮 → 结构 → 动作 → 神态 → 评分 → 重新出场”排列内容。
- [ ] 让滚动只控制信息出现顺序和模型高亮，不让部件无意义抖动。
- [ ] 结尾让模型回到完整状态，显示作品简介和资料来源。
- [ ] 显示AI使用说明、模型重建说明和公开视频样本说明。
- [ ] 统一所有页面中的字体、颜色、标签和来源标记。

**Verification:** 从页面顶部连续滚动到底部，信息顺序不跳跃；返回上一段时状态可以恢复；结尾能再次回到完整醒狮。

### Task 8: 最终验收和提交包

**Files:**
- Create: `docs/final-checklist.md`
- Create: `docs/ai-usage-log.md`
- Create: `deliverables/README.md`

- [ ] 在桌面浏览器和手机宽度下检查视频、模型、图表、按钮和文字。
- [ ] 检查首屏加载时间、模型加载失败提示和视频加载失败后的备用入口。
- [ ] 检查所有数字、年份、规则和数据来源。
- [ ] 检查网页内没有把AI画面当成真实现场，也没有把结构示意当成实物测量。
- [ ] 保存源代码、GLB、AI视频、数据JSON、提示词记录和最终演示入口。
- [ ] 录制一段完整操作演示视频，包含视频开场、铜镜转场、模型交互、动作数据和评分器。

**Verification:** 按 `docs/final-checklist.md` 完成一次从空页面到结尾的完整操作，并确认提交目录中每项资源都有实际文件。

## 最小可交付版本

时间不足时，优先完成以下内容：

```text
AI开场视频
→ 铜镜转场
→ 完整醒狮3D模型
→ 6个部件热点
→ 动作时间轴
→ 八态与十态对比
→ 评分器
→ 来源和AI说明
```

地图、复杂城市场景、多套配色、AI问答和高桩动作可以放到最后处理。
