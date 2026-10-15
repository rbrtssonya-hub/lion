# 醒狮八态图鉴与素材来源

## 2026-10-15 八态形态与阅读框更新

用户指定图二中的八种形态分别替换主狮头，不再用同一张图旋转模拟。`lion-expressions.js` 每态通过imageKey对应一张独立透明PNG，主图、过渡退场图和左侧当前态小狮头像同步；8张图片由现有启动准备流程提前解码。具体编辑目标、各态提示词、原始输出及像素/alpha/哈希记录见 [八态素材说明](lion-expressions-eight-poses.md)。它们是依据用户参考图进行AI辅助提取及被文字遮挡部分的补全，不能当作八套经过真实表演验证的样本。旧单张狮头原字节保留，未覆盖。

右侧新增淡米色神态文字底板：设置→外观可调宽度/高度/透明度/模糊/圆角/底色；高度是受当前可用视口限制的最小高度，0自动，自定义大字体/窄框时在框内滚动。设置→导航的“神态文字”可独立调简介和解读字号16–32px，默认22/18；短窗口按可用高度适当约束显示字号，保留操作与原三栏。

简介采用大书法态字、图二短标题/题句与醒狮主题短句；点击中央完整狮头后，换成“狮艺解读”标签、缩小印章态字、加粗sans标题、狮头/锣鼓图标和两块编号观察卡。观察文案改为具体的狮眼狮口、身段步法与鼓点提示；仍是Agent在用户授权内编写的定性观察引导。文字与图标不随底板透明度淡出。返回/Escape/切态复位、方向键/滚轮、Space取消、减少动态和卸载清理保持。

下方旧单张狮头与CSS姿态属于此前实现，已由本节和新素材说明替代；旧来源/提示词只追溯历史。原背景、全局导航、首页、动作和模型保持。

## 此前单张狮头的历史记录

2026-10-14较早版本按八态参考图联动右侧及下方文案；同日最新方案已改为自适应单屏，删除原下半区、眼嘴局部图及页脚。点击中央完整狮头后，原下半区meaning/emotion/motion介绍替换到右侧；返回/Escape及切态恢复简介。

- 参考布局：用户第二张附件，归档于 `source/design/expression/eight-states-reference.png`。左侧八态依次为喜、怒、哀、乐、动、静、惊、疑。
- 白毛红纹正面狮头：使用内置 `image_gen`，以第二张附件为编辑目标生成透明提取版本；网页资产为 `source/public/assets/expression/lion-head-front.png`，应用经 `assetPaths.expressionLion` / `media.expressionLion` 引用。输出不是保证像素不变的抠图，也不是实拍样本。
- 八态观察提示：`src/data/lion-expressions.js`。喜态标题/引导参照用户附件，其余为 Agent 在授权范围内编写的定性观察提示；不作为标准化分类、经样本验证的神态特征或量化结论。八态复用同一 AI 辅助狮头，通过轻微姿态与层叠过渡辅助导航，不伪称八套真实神态照片。
- 眼神/嘴部局部图是较早版本对同一图片的CSS取景，当前单屏已删除，不改原狮头文件字节。定性观察文案保留并迁移到右侧解读。
- 最新单屏参考：“裁剪.png”原字节归档为 `source/design/expression/single-screen-reference.png`，SHA256为 `1e00236057e6636bee9fac2b6e84fb008088ae92f8dea9ae2a83896fd1ff918a`；只用作设计参考，不把截图、印章或另套品牌导航部署到网页。
- 原章节宣纸背景和全局导航保持；黄色渐变遮罩与暖黄色卡片底已去除。动作专用视频仍待接入，不以入场视频补位。

页面保留“AI辅助视觉 · 八态定性观察提示 · 等待真实图片/视频样本校核”标注。将来接入真实图片/视频时应逐态登记来源，再更新对应图像与观察结论。

## 内置 imagegen 提示词

```text
Use case: background-extraction. Asset type: isolated transparent PNG for an interactive Chinese lion dance exhibition website. Input image is the edit target: extract ONLY the large frontal white-fur and vermilion-red Southern Chinese lion head in the middle-left of the reference layout. Preserve its centered frontal view, complete fluffy white ears and beard, red pom-poms, silver forehead mirror, black white red spiraled eyes, gold and red painted details, open smiling red mouth with white teeth. Make the lion head fill most of the square image with a small transparent margin around all fur tips. Remove ALL surrounding page background, brush circle, arrows, navigation badges, text, clouds and other lions. This is a single beautiful photorealistic lion HEAD cutout with richly detailed silky white fur, matching the reference. No body, no pedestal, no shadows behind it, no text, no UI, no frame. True transparent alpha background. Preserve all edges and include full beard.
```
