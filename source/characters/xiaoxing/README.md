# 小醒角色分层源文件

用户2026-10-26选定 `approved-reference.png`，采用二次元Q版醒狮服装少女。来源为本对话生成并经用户明确选择的图片，原字节保留；该文件是视觉基准。

- `xiaoxing-layered.psd`：9个独立可编辑图层；Photoshop等兼容PSD的软件可打开。
- `xiaoxing-layered.ora`：同层的OpenRaster文件，适合Krita/GIMP。
- `xiaoxing-layered.svg`：自包含图片与矢量图层，任意支持SVG分组的软件可调整部件。
- `rig.json`：画布、图层与转轴坐标。所有层均1349×1166，保持对齐，不要单独裁边。
- `face-repair.png`：imagegen生成的修复底图，仅提取眼眉嘴下方皮肤区域，保持其余获选图像素。
- `assembly-preview.svg` / `merged-preview.png`：默认闭嘴表情合成预览。微笑/说话图层默认隐藏。
- 网页部件位于 `source/public/assets/xiaoxing/`，由assetPaths/media统一注册。

身体与狮头分开；身体下方保留领口补全。双眼、双眉独立，三款嘴型独立。活动幅度为网页小尺寸下的轻摆动、眨眼和嘴型变化，尚不是完整Cubism骨骼模型。

制作使用内置imagegen编辑工具完成脸底修复，原始提示如下：

> Change ONLY the human face: carefully erase the human girl's two eyes including eyelashes, human eyebrows, and smiling mouth, filling those regions with seamless pale warm skin and preserving natural blush and face shading. Keep the lion head's decorative eyes intact. Preserve the entire rest of the supplied image, identical character, hair, lion hood, outfit, ornaments, pose, proportions and transparent background. The blank facial base is for original eyes/eyebrows/mouth as separate movable layers.

随后 `node scripts/xiaoxing/export-rig.mjs` 机械提取原始部件并导出对齐PNG。闭口和小微笑为可编辑SVG路径，说话嘴型提取获选原图。`python scripts/xiaoxing/package-layers.py` 仅编码PSD/ORA容器，不重新绘画。原始imagegen结果和选择图均保留供后续精修。

语音制作与选声参数见 `voice/`；API配置由用户明确延期，本地固定讲解不依赖DeepSeek。
