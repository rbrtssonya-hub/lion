# 动作厅鼓资产

`gu.blend` 是用户在 2026-10-21 指定 `gu(1).blend` 的原字节归档，没有调用 Blender 保存。43,214,735 字节，SHA256 为 `de6fc54cb1d0943e839a1579bc950d4137f12e09bd74fd891defa8abf8af5ac2`。用户提供用于本工程；未据此判断对工程外的再分发许可。

匹配源版本的 Blender 5.1.2 导出网页副本。359 个可见网格按七组材质合并，全部 295,280 个评估三角保留，不抽面、不缩图。源文件包含鼓腔、双面鼓皮、铜钉、铜圈及描金黑木鼓架，完整高度约 3.2942m；运行模块等比例缩到 2m，四组鼓位于巨幕厅四角 x/z=±6m，鼓面朝向中央，鼓架脚落在 y=.015m。四组共用七组 geometry/material，由七个 InstancedMesh 绘制。

运行 GLB 为 `source/public/assets/models/lion-action-drum.glb`，包含七材质和十二张嵌入纹理。保留基础色、粗糙度、金属度、原切线法线和可导出的漆面 coat 参数；源材质在切线法线上额外叠加的 Height/Bump 微浮雕不属于 glTF 标准通道，网页副本不包含这一层，不宣称 Blender 逐像素一致。原二十张打包贴图全部保留在归档 `.blend`。

从根目录复现（替换本机 Blender/输入路径）：

```powershell
& '<Blender 5.1.2>/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/export_action_drum.py -- --input '<gu(1).blend>'
```

脚本拒绝覆盖不同源归档；重新生成自己输出的 GLB/JSON 时加 `--overwrite`。导出时的 glTF sampler 提示来自合并 roughness/metallic 图片，源采样都使用相同 Repeat/Linear 配置；正式导出未出现数据丢失或切线生成警告。导出记录见 [JSON](../../references/action-drum-2026-10-21.json)。

加载模块 `src/services/actionTheaterDrums.js` 独立于动作厅必需资产：失败可重试，离页中止下载，迟到解析会单独释放；实例属性、几何、材质、纹理和 ImageBitmap 均由模块退出函数回收。独立 Chrome 实际 WebGL 验证及限制见 [浏览器记录](../../references/action-drum-browser-2026-10-21.json)，该记录为孤立鼓资产场景，并不代替最终动作厅组合验收。

动作厅组合实测另见 [四面投影记录](../../references/action-drum-integrated-2026-10-21.json) 与 [1920×1080 实际播放截图](../../reviews/action-drum/2026-10-21/integrated-theater.png)。本机 Chrome 开发环境实际四组鼓底面均为 y=.015m、顶面为 y=2.015m；逐一转向四面巨幕，鼓在各主屏中央 64% 宽、84% 高的画面区域投影重叠均为 0，未阻挡中央醒狮。此测量不宣称任意用户相机角度下都没有遮挡，用户缩放/俯仰会改变前后关系。
