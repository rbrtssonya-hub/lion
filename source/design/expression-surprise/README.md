# 惊态五官分层试作素材

日期：2026-10-26。用于本轮用户批准的“眉毛先抬、眼睛随后睁大、狮口再微张、最后复位”。这是 AI 辅助视觉演绎，未作为真实狮艺动作采样或机械结构复原。

## 文件与编辑方式

- 原图：`source/public/assets/expression/lion-surprise-v2.png`，1254×1254 RGBA，SHA-256 `7b167fa62fb0e24afc103e6821322443fd361bd951b5d18ac2a58423f1b97480`，原字节保留。
- 补绘：`source/public/assets/expression/lion-surprise-underpaint-v1.png`，1254×1254 RGBA，1,809,215 字节，SHA-256 `3ccf15f901e51651d8f7a12365d1941f1cb86316c15d842dca5f9325d2b71356`。
- 内置 `imagegen` 图片编辑工具生成，`transparent_background=true`，引用上述原图；未使用外部 API/CLI。
- 原始输出：`C:/Users/ALLEN/.codex/generated_images/01a173ed-1ccb-76a1-8d88-a0ae8d55ce84/exec-89fc4e9e-acd3-4021-bbda-78a9b7e609b9.png`。部署所需文件已复制到项目内，网页不依赖此个人路径。
- 可编辑轮廓为 `src/features/chapters/face-profiles/surprise.js`，共享动画源为 `src/features/chapters/ExpressionLion.jsx`，原 `SurpriseLion.jsx` 保留兼容导出。SVG 使用原图1254坐标，分左右眉、左右眼、口腔/下牙带五个片；静态上牙、胡须、鼻球与大小绒球保留。原图像素用于所有可见静态区域与移动片，补绘只在移动露出的蒙版窗口中可见。
- 默认静止与播放结束始终显示完整原图；所有资产解码成功后才能播放分层。补绘失败、减少动态、离章、切态、对照或后台均回到原图。
- 当前编排（用户反馈后延长）：眉0ms、眼120ms、口240ms启动，统一在3000ms结束；先快速展开、停留、轻回收后再次回应，再自然复位。各片原生WAAPI，结束取消fill并复位。眉向上22/24原图像素，眼展开约3.5%×6.5%，口下移18原图像素，峰值幅度不变。前版720ms属于历史阶段，最新实际播放记录见[三秒补验](../../references/surprise-duration-2026-10-26.md)。这些参数是视觉设计，未宣称来自表演测量。

## 完整编辑提示词

Edit target: the attached transparent red-and-white Southern Chinese lion-dance head, front facing. Precise-object-edit for an animation UNDERPAINT BASE. Keep the square canvas, same head scale, position, central decorations, fabric texture, white side fur, moustache, beard and transparent outer background. Make these THREE local removals only: (1) remove both large white fluffy eyebrow tufts above the eyes and repaint the shell underneath with matching red embroidered cloth and a smooth dark eye-socket rim, providing hidden backing for eyebrows that lift; (2) remove both black-and-red eyeball assemblies, leaving deep black smooth empty eye sockets with no pupils, no white eyeballs, no second eye shapes; (3) remove the LOWER crescent jaw / lower row of teeth below the dark mouth cavity, continue the deep burgundy-black open mouth cavity down into this area, feather smoothly into the unchanged long white chin beard. Keep the upper white moustache above the mouth unchanged. This base will be masked into tiny revealed gaps under the ORIGINAL cutout eyebrows, eyes, and jaw, so prioritize clean matching underpaint around their edges, not a new lion design. No labels, no extra features, no shadows outside the lion, no background. Preserve exact original square composition and silhouette wherever not affected by the three removals.

## 参考边界

- [Kugutu](https://github.com/neka-nat/kugutu)：参考SVG部件分别控制的组织方式，未引入其依赖或复制角色/代码。
- [Codrops Interlude](https://github.com/codrops/interlude)：章节转场参考墨迹覆盖/显现概念，当前React/SVG实现独立编写；未复制Astro引擎或升级Three。
- 初版仅惊态；随后用户明确批准其余七态扩展，当前素材与范围见[八态记录](../expression-eight/README.md)。结构拆解、版面呼吸感调整、React Bits或图片液态变形继续不纳入。
