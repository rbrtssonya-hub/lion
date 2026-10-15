# 阅读底板尺寸、加载笔刷预览与红墨时间线

## 范围与状态

- 用户于2026-10-16批准在F盘main实现本方案，基线35c9ab2。仅电脑端，不另开分支、不新增依赖，不改神态、首页视频、书页或全局导航。
- 标题底板使用原bookTitleWidth（40–100%）、bookTitleHeight（0–900px最小高度，0自动），新增bookTitleSpacing（50–150%，默认100）。只调整纸面内边距及纵向留白，不缩放文字；旧存储自动补默认。窄底板把狮头云纹放到标题下方。
- 新BookTimeline从已提交book.index取状态，通过SVG实际弧长控制同一曲线上的狮头和已走过红墨。650ms行进、900ms消散，支持反向/连续接续；复用bookInkEnabled，不再播放静止时的棕色无限墨流。离屏、失焦、后台和非首页暂停；减少动态立即落位；卸载清理RAF及监听。
- 原App跨路由保留预热HomePage，不因本任务销毁书册或重置已选页；离页通过playbackEnabled暂停。原翻页引擎、首次时长、会话规则、素材来源及内容均保留。

## 字体生成与正式接入

- 使用内置imagegen工具，仅生成横排四字的独立透明字稿。参考为现有主标题 `source/public/assets/entry/title-nanfeng-youshi.png`；不重画加载背景。
- 原始输出：`C:/Users/ALLEN/.codex/generated_images/01a12bd9-7f09-70b3-9b45-92dd32acdc97/exec-feffe0e0-fc60-4c51-9cd9-448e0640ff07.png`，保留原文件。
- 项目字稿：`source/design/loading/2026-10-16-brush-title/title-ink-horizontal-preview.png`，2172×724，RGBA，四角alpha=0，SHA256 `e484178805cead8fd076f4966425c4e0cfbe848ba46816297a73caffa06614a1`。
- 整屏确认稿：同目录 `loading-composite-preview.png`，1920×1080。Chrome临时替换标题DOM后截图，字稿宽440px等比例显示，背景、眉题、副标题和进度结构来自真实加载页面。截图显示00%是独立预览未接入宿主准备任务，不作为加载进度验收。
- 最初按方案仅输出确认稿并在聊天展示。用户随后明确“后面不用问我问题了，直接一步生成”，取消逐项确认；Agent据此采用已展示字稿直接接入，并未把原方案批准误记为图片批准。
- 正式字稿为 `source/public/assets/loading/title-ink.png`，与设计原稿逐字节相同，通过startupBrushTitle资源键登记。加载HTML仅增加独立img与可读文字回退，保留语义h1、原背景、进度消息和减少动态逻辑。先监听解码/失败再同步complete状态，图片失败不显示破图。
- 最终生产截图位于 `source/reviews/loading/2026-10-16-brush-title/`，包含正常字稿与失败文字回退。整页截图不作为运行背景；只有透明字稿被部署。

### 实际生成提示词

```text
Use case: style-transfer. Asset type: transparent Chinese brush-calligraphy lettering, preview for a Lingnan lion dance museum loading page. Input image 1 is a brushwork style reference ONLY, not the desired layout or color. Render EXACTLY the four Chinese characters "南风有狮" in this left-to-right order on ONE horizontal line, with a truly transparent alpha background. Match the reference’s powerful, thick hand-painted Chinese brush strokes, varying pressure, dry-brush flying-white gaps, rough bristle edges and energetic tapering endings. Change the warm gold of the reference to very dark natural charcoal ink (#282b25). Each character must be clearly correct, complete, well separated, approximately equal optical height with a balanced broad horizontal composition and generous transparent padding around all stroke tips. Do not use the reference’s two-line arrangement. No English, no subtitle, no punctuation, no seals, no frame, no lion, no landscape, no shadows, no embossing, no background paper or painted checkerboard, no excessive ink splatter. This is lettering only for compositing over the existing loading painting; keep all four characters unclipped. Wide landscape lettering composition.
```

## 审查与恢复

- 新增行为回归：`tests/e2e/archive-panel-timeline.spec.js`。测试实际纸面尺寸、文字中心、真实SVG路径中间帧、拖尾端点和颜色、往返/暂停/连续接续、存储不可用、恢复默认。原书册与设置回归同步更新标签。
- 截图位于 `source/reviews/homepage/2026-10-16-archive-panel-timeline/`，含四个桌面尺寸、运动和停止时间线；均为真实浏览器截图，不是整页AI生成。
- 底板/时间线独立只读审查未发现Critical/Important/Minor；额外检查30组桌面底板尺寸及运行组件的失焦/暂停/减少动态/卸载，未修改工程。加载增量审查发现1920×400/2560×520窗口标题和进度线裁切；新增纵向边界测试先复现，再约束矮窗标题宽高和进度图高度，保留等比例显示。
- 最终测试命令、实际结果和Git交付以本次工程记忆日志为准，不复用历史分支验证。追加的字体解码、失败回退、进度消息和七种桌面窗口测试见 `tests/e2e/loading-brush-title.spec.js`。
