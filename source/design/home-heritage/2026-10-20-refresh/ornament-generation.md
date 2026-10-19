# 首页小装饰生成与审批记录

- 日期：2026-10-20。
- 工具：内置 image_gen；三次独立生成，transparent_background=true。
- 用户审批：在本聊天看到细节与32px/48px实际尺寸后明确回复“这三个可以”。A探头小狮、B狮爪绒球、C狮尾祥云均通过。早前两张大幅插画已否定，不进入项目。
- 三图原尺寸均1536×1024、RGBA；原字节进入source/public/assets/decor/archive-ornament-{peeking,paw,tail}.png，不裁剪、拉伸或重绘。网页以40–48px等比展示并懒加载，不参与首屏加载等待。
- 生成原文件保留在Codex generated_images；工程内运行文件为相同字节。实际字节与SHA256见source/asset-manifest.json。
- 近景及原尺寸审批截图：source/reviews/home/2026-10-20-refresh/ornament-approval.png。此截图记录审批时状态，后续正式页面截图另存同目录。
- 新背景取自本轮用户附件codex-clipboard-7c95355c-04c5-441a-bfa3-0771437f346f.png，原比例1152×2048，不使用已否定插画。旧背景完整移至本目录previous-archive-background.png，原SHA256为2266fc404bdb3821715413bd3fda158c9771976df391679193d5adf903421c66。

## peeking

Use case: stylized-concept. Asset type: TINY UI ornament for Cantonese lion dance paper-style website. One simple, compact decorative icon designed to read clearly at only 32px or 48px, NOT a scene or illustration, NOT a full-body animal, NOT an elaborate painting. Flat hand-brushed vermilion and antique gold outlines with a few ivory fills, 2 or 3 bold graphic shapes, very few details, clean restrained Chinese folk decorative style. NO text, NO seal, NO badge, NO scenery, NO floor, NO complex texture, NO shadow, NO glowing aura. Genuine transparent background, generous empty margins. A tiny peeking southern lion face with only a single curved brow, two large simple eyes, a little pompom nose, and TWO small paws resting on a short gold horizontal stroke. Squat playful silhouette, rounded line art, not realistic fur. Do NOT draw a body. This must be different from the project's existing detailed 3D red lion mascot.

## paw

Use case: stylized-concept. Asset type: TINY UI ornament for Cantonese lion dance paper-style website. One simple, compact decorative icon designed to read clearly at only 32px or 48px, NOT a scene or illustration, NOT a full-body animal, NOT an elaborate painting. Flat hand-brushed vermilion and antique gold outlines with a few ivory fills, 2 or 3 bold graphic shapes, very few details, clean restrained Chinese folk decorative style. NO text, NO seal, NO badge, NO scenery, NO floor, NO complex texture, NO shadow, NO glowing aura. Genuine transparent background, generous empty margins. A single small fluffy ivory lion paw outlined in vermilion, touching a simple red-and-gold ribbon pompom. Only paw and pompom, no head, no body, no scenery. A compact asymmetrical two-element motif. Keep shapes chunky and clean.

## tail

Use case: stylized-concept. Asset type: TINY UI ornament for Cantonese lion dance paper-style website. One simple, compact decorative icon designed to read clearly at only 32px or 48px, NOT a scene or illustration, NOT a full-body animal, NOT an elaborate painting. Flat hand-brushed vermilion and antique gold outlines with a few ivory fills, 2 or 3 bold graphic shapes, very few details, clean restrained Chinese folk decorative style. NO text, NO seal, NO badge, NO scenery, NO floor, NO complex texture, NO shadow, NO glowing aura. Genuine transparent background, generous empty margins. One curling red southern lion tail with a small ivory fluffy tip, forming a loose S beside one small antique gold cloud curl. Only tail and cloud. Simple continuous brush contours. No lion head, no body, no extra objects.
