# 八态五官分层素材与动作源

2026-10-26，用户认可惊态三秒效果后明确要求其余七态采用同样设计。本目录记录七张新隐藏补绘底层，惊态沿用[原素材记录](../expression-surprise/README.md)。所有参数均为 AI 辅助视觉演绎，不作为真实狮艺动作采样或机械结构复原。

## 素材和可编辑源

- 原图为 `source/public/assets/expression/lion-{id}-v2.png`，八张原字节保留，1254×1254 RGBA。
- 七张底层通过内置 `imagegen` 分别编辑各自原图，`transparent_background=true`；喜态再编辑一次清除露出的多余补绘牙条。没有使用外部API、CLI或程序修图。补绘仅显示在原部件移动后露出的遮罩窗口；眉、眼、狮口以及其它可见区域均保留原图纹理。
- 共享渲染与取消：`src/features/chapters/ExpressionLion.jsx`。独立1254坐标轮廓、枢轴与编排：`face-profiles/front.js`（喜/怒/乐）、`poses.js`（哀/动/静/疑）、`surprise.js`（惊）。这些文件是可编辑动画源，无新增依赖。
- 原 `SurpriseLion.jsx` 保留兼容导出；静止/结束使用原 IMG，失败、后台、切态、对照、离章、减少动态时取消并回到原图。全套约3秒，眉眼口分次展开、停留、轻回收、再次回应、复位；每片 `duration=3000-delay`。
- 哀态原图闭口，口部仅轻收窄唇缝，不添加牙齿或张嘴；疑态和动状态按原朝向调整。静态动作幅度有意克制。
- 本任务不改变页面布局、主视觉与面板尺寸、章节墨迹，不包含结构拆解与版面呼吸感。

| 神态 | 部署路径 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| 喜 | `source/public/assets/expression/lion-joy-underpaint-v1.png` | 1713559 | `b831020f1d37f44848aa29fbecc26baad8cc929edb44e60be1699309c7e55f67` |
| 怒 | `source/public/assets/expression/lion-anger-underpaint-v1.png` | 2047820 | `5229dd7a6b8b20779c79b95e9f309388462bc86d16e4321b2f361e93e8c175d6` |
| 哀 | `source/public/assets/expression/lion-sorrow-underpaint-v1.png` | 1996477 | `266f21fa53b5a6701b0d27078690cbb2ca9950dcdb5ed50bab0de532f394a451` |
| 乐 | `source/public/assets/expression/lion-delight-underpaint-v1.png` | 1946657 | `d7ed77a8bdf8f876ba2a79ba2965822d51706d9cace75fa91b3b4655a8358fc2` |
| 动 | `source/public/assets/expression/lion-motion-underpaint-v1.png` | 2117141 | `bf27ef4f3c6d2e3f17ff4923e88e930f4704d1b79ffd6a44fb662db09737df0d` |
| 静 | `source/public/assets/expression/lion-stillness-underpaint-v1.png` | 1939047 | `3222ceca66dcf12f08528b14e4f5d82e6eb584fc37852437397088ed838dc093` |
| 疑 | `source/public/assets/expression/lion-doubt-underpaint-v1.png` | 1816450 | `d1513155cbc52982c91c963179cb403e8da2e0adab116602e2201e2d0a050e25` |

## 完整编辑提示词与原输出

原输出保留于本机生成目录；网页仅依赖项目内副本。以下每项分别引用对应的原图。

### 喜 / joy

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-ac6455b8-5dfd-4fa8-bf18-7687ea5f7e06.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

### 怒 / anger

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-2e4282a5-2be2-498e-9442-c5e4c11658aa.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

### 哀 / sorrow

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-f87c2071-e6d6-4f00-bfb3-5e29b61d2f32.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, this is a CLOSED-MOUTH expression: do not invent an open mouth, tongue or teeth. Remove only the narrow original lip seam and make a softly shaded dark-red contact shadow behind it, continuing the adjacent natural white fur. Keep the lower beard and white moustache fully intact. This underpaint will only fill tiny revealed gaps behind original moving facial cutouts. No labels, no extra objects, no background, no extra facial features. Match the reference's original square composition and preserve full alpha transparency.

### 乐 / delight

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-5d858108-726c-4640-8e2b-4b0530e21bea.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

### 动 / motion

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-e9ccbb90-d682-4819-92f8-db999c947d43.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

### 静 / stillness

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-377d3c69-a200-4efd-b026-50c46bf6608d.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

### 疑 / doubt

原输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-05e8c6d5-6c34-4a5d-a060-7c47344a598f.png`

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head. Precise-object-edit to make a HIDDEN UNDERPAINT BASE for facial layer animation. Preserve EXACT square canvas, original head position, scale, pose, tilt and viewpoint: do not straighten, rotate, zoom, redesign or recenter this head. Keep the original transparent outer background, central forehead mirror, nose pompom, upper decorations, side fur, white moustache and beard. Make only local feature removals: remove both fluffy eyebrow tufts and reconstruct matching red embroidered shell underneath; remove both black/red/white eye assemblies so there are smoothly shaded deep black empty sockets with no pupils or duplicated eye shapes. Keep surrounding fur and original face proportions. For the mouth, remove the LOWER teeth crescent and lower red jaw/lip only, continue the deep burgundy-black mouth cavity behind it, blending into unchanged white chin fur; keep the UPPER teeth and upper white moustache static and intact. This is underpaint only, hidden beneath original cutout brows, eyes and mouth; only small movement gaps will show it, so prioritize clean coherent edge backing. No labels, no extra objects, no background, no second face or extra teeth. Match the reference's original square composition and preserve full alpha transparency.

## 喜态口腔补绘修订

首次浏览器截图发现喜态下颌移动后露出生成底图中多余的宽白牙弧。第二次仅编辑隐藏口腔，清除该牙弧，保留原图窄上牙由静态层呈现。运行文件为上表最终 SHA，第一次中间输出仅留在个人生成目录，无需部署。

最终生成输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-72472e17-94b9-4732-bc25-54a9d18d844b.png`

完整修订提示词：

Precise local underpaint correction. Edit ONLY the mouth backing area of the attached transparent, eyebrowless and eyeless red Chinese lion-head base. This is an animation hidden underpaint, not a finished lion. Remove ALL white teeth, the thin red tooth border and the small gold horizontal mouth strip visible directly under the central white moustache (approximately x480–755, y800–865 on the 1254×1254 canvas). Fill that small tooth-strip area with a continuous smooth deep burgundy-black mouth-cavity shadow, matching the existing mouth cavity immediately below. Do NOT add any teeth, lip, tongue, symbol or other light-colored shape inside the dark mouth. Keep the white moustache and chin beard exactly in place; preserve the empty eye sockets, red/gold shell, decorations, alpha transparency, original 1254 square canvas, head scale and position. Change nothing elsewhere. The original image's authentic upper teeth will be overlaid separately in the web animation, so this backing must be toothless.

## 验收入口

[八态实际验证与边界](../../references/eight-state-face-motion-2026-10-26.md)。评审截图位于 `source/reviews/eight-face/2026-10-26/`，未放入部署资产。初版惊态参考 Kugutu 的SVG部件组织思想，代码独立编写；本轮无拷贝第三方代码或新增运行依赖。
