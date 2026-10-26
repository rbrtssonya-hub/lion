# 小醒角色分层源文件

用户2026-10-26选定 `approved-reference.png`，采用二次元Q版醒狮服装少女。来源为本对话生成并经用户明确选择的图片，原字节保留；该文件是视觉基准。

- `xiaoxing-layered.psd`：9个独立可编辑图层；Photoshop等兼容PSD的软件可打开。
- `xiaoxing-layered.ora`：同层的OpenRaster文件，适合Krita/GIMP。
- `xiaoxing-layered.svg`：自包含图片与矢量图层，任意支持SVG分组的软件可调整部件。
- `rig.json`：画布、图层与转轴坐标。所有层均1349×1166，保持对齐，不要单独裁边。
- `face-repair.png`：imagegen生成的修复底图，仅提取眼眉嘴下方皮肤区域，保持其余获选图像素。
- `assembly-preview.svg` / `merged-preview.png`：默认闭嘴表情合成预览。微笑/说话图层默认隐藏。
- 网页部件位于 `source/public/assets/xiaoxing/`，由assetPaths/media统一注册。

身体与狮头分开；身体下方保留领口补全。人脸双眼、双眉和三款嘴型各自独立，网页通过九层图片与 CSS 控制转轴、视线和表情。

## 网页动效与取景

2026-10-26视觉跟进保留全部1349×1166对齐PNG及源文件，通过CSS收拢原图透明留白。桌宠可拖动区域为152×194px；首页、动作、神态的角色取景框约144×169px，其中可见角色约136×163px。结构页取景框宽128px，保留同一可拖动区域，给左下结构标签留出空间。源图片没有重新裁切，头部组显示在身体上方，防止倾斜时被身体与领口遮住。

- 待机：身体轻微呼吸，狮头以不同节奏独立摆动，人脸双眼自然眨眼。
- 倾听：鼠标悬停桌宠或打开聊天时，狮头倾斜约4°，眼睛轻移、双眉分别抬起。
- 思考：跟随真实问答请求的等待过程，头部朝另一侧轻倾，视线向上、左右眉高低不同。本地资料回应很快时，这一状态可能短暂出现，不增加等待时间。
- 回答：闭口、微笑、张口三种嘴型交替，配合点头和眉毛强调。未播放语音时回答姿态持续4.2秒；语音播放时继续跟随实际播报状态。

网页可见但窗口失去焦点时继续活动；页面进入后台或启用减少动态偏好时停动画，拖动时也暂停连续摆动。当前实现入口为 `src/features/assistant/XiaoxingAvatar.jsx`、`XiaoxingAssistant.jsx` 与 `assistant.css`。

[状态预览页](../../reviews/xiaoxing/2026-10-26/motion/preview.html)与[动效GIF](../../reviews/xiaoxing/2026-10-26/motion/character-states.gif)使用同一组九层PNG和当前源码CSS，可直接比较待机、倾听、思考与回答。预览页直接选择角色状态，其中思考演示不是实时大模型请求。[1366px真实网页截图](../../reviews/xiaoxing/2026-10-26/motion/state-1366.png)及[浏览器采集记录](../../reviews/xiaoxing/2026-10-26/motion/capture.json)另行保留；四章均确认9层，采集期间无页面异常。主任务已运行核心100/100与363模块构建，最终浏览器验收结果见[交付记录](../../references/xiaoxing-assistant-2026-10-26.md)。

制作使用内置imagegen编辑工具完成脸底修复，原始提示如下：

> Change ONLY the human face: carefully erase the human girl's two eyes including eyelashes, human eyebrows, and smiling mouth, filling those regions with seamless pale warm skin and preserving natural blush and face shading. Keep the lion head's decorative eyes intact. Preserve the entire rest of the supplied image, identical character, hair, lion hood, outfit, ornaments, pose, proportions and transparent background. The blank facial base is for original eyes/eyebrows/mouth as separate movable layers.

随后 `node scripts/xiaoxing/export-rig.mjs` 机械提取原始部件并导出对齐PNG。闭口和小微笑为可编辑SVG路径，说话嘴型提取获选原图。`python scripts/xiaoxing/package-layers.py` 仅编码PSD/ORA容器，不重新绘画。原始imagegen结果和选择图均保留供后续精修。

现有临时语音素材及参数见 `voice/`。用户已明确音色由其后续提供，当前暂停选声与语音素材制作；DeepSeek API配置继续延期。
