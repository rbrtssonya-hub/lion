# 暖金 Blender 舞台场景接入

2026-10-27，按用户指令将 `D:/SoftWareDocuments/WeChatDownLoad/xwechat_files/wxid_j88e6n2v2yuz22_9229/msg/file/2026-10/南风有狮_暖金灯光优化.blend` 接入 React 的“舞”动作页。输入 `.blend` 为 186,110,536 字节，SHA256 `14d119ac20d0245d51e5a62c60721a1e74f71a850c0f3b72ada4c784e8a6a278`。项目副本 `source/models/action-theater-warm-gold-2026-10-27.blend` 与输入逐字节相同；导出期间没有保存或改写用户原文件。副本超过 GitHub 单文件限制，使用 `localOnly` 清单记录并忽略提交，网页只使用下述导出资产。

## 网页资产

场景导出以 Blender 5.1.2 读取完整工程，选取房间、1438个建筑网格、完整圆形石台、四面屏幕、28个鼓部件、互动锚点以及全场21盏灯；场景共保留1,816,368个三角面。舞台、建筑与鼓几何合并为低节点数批次，完整狮子从独立集合导出，避免重复狮子并保留所有33组原生毛发。

| 资产 | 网页用途 | SHA256 / 大小 |
| --- | --- | --- |
| `source/public/assets/models/lion-action-theater.glb` | 房间、舞台、建筑、鼓、四块视频屏和源场景元数据；`EXT_meshopt_compression` | 见 `2026-10-27-action-theater-warm-gold.json` |
| `source/public/assets/models/lion-action-theater-lion-full.glb` | 仅动作页使用的完整狮子模型 | `fd7da351f6029a1962cf710d5bcfdd76860d73cb49161fd1b5c38cfa02137088` / 81,310,988 B |
| `source/public/assets/models/lion-action-theater-lion-hair.json` | 动作狮毛发清单，33组/2,295,421根/19,957,105点 | `17bde2a9987b6442fe42bb7e13a95d5e3d6f2a77e467846904fc31b24aa6b151` / 39,205 B |
| `source/public/assets/models/lion-action-theater-lion-hair-01.bin.gz` 至 `-33.bin.gz` | 完整源毛发数据 | 每组字节数与SHA在毛发清单、导出报告及资产清单中登记 |

场景GLB由 Blender 原始导出的120,958,132 B进一步用 `@gltf-transform/cli 4.2.1 meshopt --level high --quantize-position 16 --quantize-normal 16 --quantize-texcoord 16` 压缩至52,940,156 B；不减少三角面，不改贴图编码。提高源位置精度以保留舞台细金饰，超过 `[0,1]` 的UV通道保持未量化；Three.js r160 的 `MeshoptDecoder` 在加载器中解码。原始与压缩文件的 SHA、导出参数及边界数据保存在[场景报告](2026-10-27-action-theater-warm-gold.json)。

## 灯光与网页接合

保留21盏源灯的名称、位置、方向、功率、温度、形状和光束参数到GLB节点附加数据，并单独输出[灯光记录](2026-10-27-action-theater-warm-gold-lights.json)。运行时以Three.js `RectAreaLight`、`SpotLight`、`PointLight` 映射13盏Area、4盏Spot和4盏灯笼点光；Blender瓦特与Three强度单位不同，因此使用有记录的缩放因子。Area光在Three中不能投射阴影，另以低强度方向光近似主光阴影，补少量半球间接光。HDRI仍使用原应用用户可调设置。因此这是实时近似，不是Cycles相机/世界光逐像素复现。

屏幕几何、朝向、锚点及房间保持源场景位置；React只把四块屏幕的材质替换为现有四段视频纹理。四视频路径、主辅屏亮度、单主音轨、环绕控制和狮子36秒匀速自转继续由既有页面服务负责。动作专属模型与毛发路径集中在 `src/config/assetPaths.js`，未改结构页原有 `lion-user-full.glb`。

源文件检查、完整演员/毛发导出、场景导出及Meshopt后处理依次使用：

```powershell
& 'tmp\blender-portable\blender-5.1.2-windows-x64\blender.exe' --background --factory-startup --python-exit-code 1 --python 'scripts\export_full_lion.py' -- --input '<原始 .blend 路径>' --archive 'source/models/action-theater-warm-gold-2026-10-27.blend' --collection '03_Complete_Native_Lion' --output-stem 'lion-action-theater-lion' --hair-key-prefix 'actionTheaterLionHair' --report 'source/references/action-theater-warm-gold-lion-2026-10-27.json'
& 'tmp\blender-portable\blender-5.1.2-windows-x64\blender.exe' --background --factory-startup --python-exit-code 1 --python 'scripts\export_action_theater_scene.py' -- --input '<原始 .blend 路径>' --archive 'source/models/action-theater-warm-gold-2026-10-27.blend' --hair-manifest 'source/public/assets/models/lion-action-theater-lion-hair.json' --output 'source/public/assets/models/lion-action-theater.glb' --report 'source/references/2026-10-27-action-theater-warm-gold.json' --lights-report 'source/references/2026-10-27-action-theater-warm-gold-lights.json'
npx --yes @gltf-transform/cli@4.2.1 meshopt <raw-export.glb> <runtime.glb> --level high --quantize-position 16 --quantize-normal 16 --quantize-texcoord 16
```

## 浏览器证据

最终验收命令和结果写入本条任务的 `wiki_memory/日志/功能添加/2026-10-27-舞展厅暖金Blender场景替换.md`；初始三屏全页桌面截图为 `source/reviews/action-theater/2026-10-27-warm-gold/action-theater-initial-three-screens-1920.png`。图中中央狮子、原舞台、金饰梁架与视频材质都来自本轮接入，页面边缘控件是现有React布局。
