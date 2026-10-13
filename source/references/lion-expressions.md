# 醒狮八态图鉴与素材来源

2026-10-14 用户要求删除动作/神态页黄色底层，并按第二张参考图重排神态页，点击左侧八态或在狮头上上下滚动时联动右侧及下方文案。

- 参考布局：用户第二张附件，归档于 `source/design/expression/eight-states-reference.png`。左侧八态依次为喜、怒、哀、乐、动、静、惊、疑。
- 白毛红纹正面狮头：使用内置 `image_gen`，以第二张附件为编辑目标生成透明提取版本；网页资产为 `source/public/assets/expression/lion-head-front.png`，应用经 `assetPaths.expressionLion` / `media.expressionLion` 引用。输出不是保证像素不变的抠图，也不是实拍样本。
- 八态观察提示：`src/data/lion-expressions.js`。喜态标题/引导参照用户附件，其余为 Agent 在授权范围内编写的定性观察提示；不作为标准化分类、经样本验证的神态特征或量化结论。八态复用同一 AI 辅助狮头，通过轻微姿态与层叠过渡辅助导航，不伪称八套真实神态照片。
- 眼神/嘴部图：CSS 放大同一狮头显示局部，未新增真实摄影或变更原图片字节；局部仅帮助理解观察位置，文字随八态更新。
- 原章节宣纸背景和全局导航保持；黄色渐变遮罩与暖黄色卡片底已去除。动作专用视频仍待接入，不以入场视频补位。

页面保留“AI辅助视觉 · 八态定性观察提示 · 等待真实图片/视频样本校核”标注。将来接入真实图片/视频时应逐态登记来源，再更新对应图像与观察结论。

## 内置 imagegen 提示词

```text
Use case: background-extraction. Asset type: isolated transparent PNG for an interactive Chinese lion dance exhibition website. Input image is the edit target: extract ONLY the large frontal white-fur and vermilion-red Southern Chinese lion head in the middle-left of the reference layout. Preserve its centered frontal view, complete fluffy white ears and beard, red pom-poms, silver forehead mirror, black white red spiraled eyes, gold and red painted details, open smiling red mouth with white teeth. Make the lion head fill most of the square image with a small transparent margin around all fur tips. Remove ALL surrounding page background, brush circle, arrows, navigation badges, text, clouds and other lions. This is a single beautiful photorealistic lion HEAD cutout with richly detailed silky white fur, matching the reference. No body, no pedestal, no shadows behind it, no text, no UI, no frame. True transparent alpha background. Preserve all edges and include full beard.
```
