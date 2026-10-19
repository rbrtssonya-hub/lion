# 南风有狮 · 沉浸式巨幕厅交接

本次交付为独立 Blender 场景与网页接口准备，未修改现有网站页面。采用 Lux3D 的本地文件交付流程，由本机 Blender 组装场景；未请求或执行云端模型生成，也不创建云任务编号。实际文件、哈希与检查结果见 [场景记录](../../references/2026-10-19-immersive-theater.json)。

## 文件与素材

- 主工程：[SouthWindLion_Immersive_Theater_Blockout.blend](SouthWindLion_Immersive_Theater_Blockout.blend)，92,962,597 字节。
- 网页交接导出：[SouthWindLion_Immersive_Theater.glb](SouthWindLion_Immersive_Theater.glb)，31,826,708 字节，尚未接入网站。
- 原始醒狮：项目根 `model/醒狮_保留UV_三角转四边_优化.blend`，139,309,821 字节，SHA256 `2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2`。原件不覆盖、不移动。
- 巨幕占位字使用 [nanfeng-theater-labels.ttf](../../fonts/immersive-theater/nanfeng-theater-labels.ttf)，为演示秋鸿楷的 116 字符子集，字体族名 `Nanfeng Theater Labels`，68,240 字节；保留 [SIL OFL 1.1 许可](../../fonts/immersive-theater/OFL.txt)。字体随 `.blend` 打包，无需安装系统字体，也不替换网页导航字体；重建方式见[字体说明](../../fonts/immersive-theater/README.md)。
- 已有传统场景参考：[动作首屏](../../design/action/action-hero-reference.png)、[动作讲解](../../design/action/action-detail-reference.png)，可见石材地面、暗红立柱、传统鼓及鼓架。它们是此前的界面设计参考，不能称为本次新上传的舞台实景照片。
- 当前请求未提供可访问的专用舞台参考图；项目及相邻素材目录也未找到四段已经核对内容的指定动作视频。因此四屏使用明确标注的占位材质，视频路径为空，未挪用首页或入场视频。

## 空间与对象

Blender 使用米制：`+Z` 向上，`+Y` 为前方，舞台中心位于 `(0, 0)`。空间为 20 × 20 米，净高 10.4 米；四屏均为 16 × 9 米，下沿高 0.8 米。提示词中的 16 × 6.5 米与 16:9 不一致，本场景采用明确要求的 16:9，并相应增加净高。

圆形舞台直径 5 米，台面接触高度 `Z = 0.22` 米。整体使用暗棕石材、黑红环境、少量暗金细边和暖色补光；不含发光地面、复杂宫殿装饰或额外副屏。

| Collection | 内容 |
| --- | --- |
| `00_Environment` | 地面、围墙与克制的传统背景 |
| `01_Stage` | `Lion_Stage_Base`、舞台石材表面及细边 |
| `02_Lion` | `Lion_RotationRoot` → `Lion_Model` → 醒狮原有层级 |
| `03_Screens` | 四个独立视频显示面 |
| `04_Screen_Frames` | 与显示面分离的薄边框 |
| `05_Lighting` | 柔和补光及屏幕光照预览代理 |
| `06_Cameras` | 主摄像机、环绕参考与预览摄像机 |
| `07_Interaction_Anchors` | 方向参考点与四个 UI 锚点 |
| `08_Proxies` | 明确标记的待替换视频文字 |

## 中央醒狮

主工程直接附加原始 `.blend` 中的 23 个有效网格、18 个原生毛发 `CURVES` 和 41 个辅助空物体，保留网格、UV、材质及曲线属性；仅排除已逐项核实完全重合的 15 个网格副本和 3 盏源灯。17 组毛发通过独立 `Native_Fiber_Radius_Unit_Recovery` 节点修正器，按源 `fiber_world_radius_max` 将归一化半径恢复为米制，原曲线点与半径数据不改；鼻口短毛无需该修正。

10 张原始 PNG 内容经字节相同去重后打包，正式字体一并内嵌；文件中保留的旧图片路径不构成外部文件依赖。原生材质节点保留，不将已有的推断 PBR 或参考织纹称为实测文物材质。

`Lion_RotationRoot` 控制整体竖直旋转，`Lion_Model` 负责统一摆放与缩放，原部件保持相对关系。仅控制器添加 Z 轴动画：24 FPS，第 1 帧为 0°，第 865 帧为 360°，线性插值并循环；播放区间为 1–864，完整一周 36 秒。没有抖毛、探青、吐球、行走、呼吸或部件单独运动。

展示采用 2.05 倍等比缩放，模型约为 1.853 × 3.286 × 2.05 米；控制器位于 `(0, 0, 0.22)`，模型脚部落在台面附近。保留原始四足之间的高度差，不通过变形强行压平。

网页应以 `2π / 36` 弧度/秒独立更新模型旋转；原生工程绕 Z 轴，导出 GLB 绕其 Y 轴。摄像机不得挂在该控制器下，也不得因切换屏幕而重置模型角度。

## 四面巨幕接口

| Blender 方向 / 中心坐标（米） | 显示面 | 动作 / 视频键 | UI 锚点 |
| --- | --- | --- | --- |
| 前 / `(0, 9.55, 5.3)` | `Screen_Tanqing` | 探青采青 / `video_tanqing` | `UI_Anchor_Tanqing` |
| 右 / `(9.55, 0, 5.3)` | `Screen_Doumao` | 抖毛 / `video_doumao` | `UI_Anchor_Doumao` |
| 后 / `(0, -9.55, 5.3)` | `Screen_Tuqiu` | 狮子吐球 / `video_tuqiu` | `UI_Anchor_Tuqiu` |
| 左 / `(-9.55, 0, 5.3)` | `Screen_Meihuazhuang` | 踩梅花桩 / `video_meihuazhuang` | `UI_Anchor_Meihuazhuang` |

四面正面均朝向室内。每屏具有独立 `Video_<名称>_Replaceable` 材质和 `Screen_Brightness` 数值节点；初始探青采青为 `PRIMARY` / 1.00，其他三面为 `SECONDARY` / 0.25。`video_path` 为空、`is_placeholder = true`、`resource_status = MISSING_VERIFIED_ACTION_VIDEO`，表示素材缺失，不表示视频播放已实现。

以后接入时，核对真实视频动作、画幅、解码和音轨后再绑定对应键；采用完整 16:9 画面，不拉伸或错误裁切。`PROXY_*` 文字仅为缺片标记，正式视频接入后移除或隐藏。

以下为提示词提供的初始文案，仍需与未来真实视频逐项核对，不能据此断言现有视频包含这些动作：

| 动作 | 初始解说 / 关键词 |
| --- | --- |
| 探青采青 | 通过观察、试探、靠近与采青，呈现神态、步法与表演智慧。察青、探青、试青、采青。 |
| 抖毛 | 通过狮头摆动与狮身协调震动，呈现力量与精神。蓄势、抖动、发力、定势。 |
| 狮子吐球 | 通过狮头与绣球互动，观察道具与动作的协调。探头、吐球、滚动、互动。 |
| 踩梅花桩 | 在高桩间跨步、腾跃、落桩与调整平衡。观察、起跳、落桩、平衡。 |

## 摄像机与待实现的网页逻辑

`Camera_Main` 为初始室内透视：位置 `(0, -7, 2.8)` 米，望向 `(0, 1, 2.7)`，焦距 22.5 毫米。`Camera_Target` 与 `Camera_OrbitCenter` 位于 `(0, 0, 2.8)` 米。另有 `Camera_Left`、`Camera_Right`、`Camera_Back` 和 `Camera_Overview`；整体关系视图使用室内全景摄像机，不应作为网页初始镜头。

场景 `web_orbit_limits` 保存交接参数：半径 5.3–7.2 米、摄像机高度 2.6–4.6 米、极角 72–92°、默认关闭摄像机自动环绕。网页需联合约束这些范围，并实现拖拽、滚轮、碰撞与俯仰限制；它们在 Blender 中是交接参数，尚无鼠标约束程序。停止操作后保留视角。

主屏根据摄像机水平观看方向自动选择。参考参数为 12° 方向滞回、180 毫秒稳定停留；边界附近保持当前屏幕。亮度与文字同步过渡 450 毫秒（可在 0.3–0.6 秒内调整），只在当前主屏附近显示该动作的简短解说，不覆盖视频中央。

四面 HTML 视频纹理、主辅弱动态状态和 DOM 解说均需网页实现。切换时保留各视频播放进度，避免轻微转向反复重播；仅主屏可发声，其他三面静音，并遵守浏览器用户手势要求。Blender 材质和时间轴不能代替这些网页逻辑。

导出至 glTF 时坐标映射为 `(Blender X, Blender Z, -Blender Y)`：网页 `+Y` 向上，Blender 前方对应网页 `-Z`。转换方向判断和锚点时一并处理，不直接混用两套坐标。

最终GLB场景的 `coordinate_system` 为 `GLTF_METERS_Y_UP_FRONT_MINUS_Z`，`web_orbit_limits.target` 为 `[0, 2.8, 0]`；根旋转轴为Y，四屏 `screen_front_normal` / `front_normal_gltf` 也为实际glTF方向。原Blender说明保留在 `authoring_*` 字段，避免相机接口混用坐标。

## GLB 与实际预览

GLB 是单独导出的网页 LOD：采用现有 `lion-structure-optimized.glb` 的 41 个网格，其中毛发为已有抽样发带，不能代替主工程的 18 组完整原生毛发。石材程序纹理与屏幕渐变转为常量 PBR / 自发光颜色；醒狮的 Sheen 扩展保留。显示面、模型层级、四组锚点及方向元数据独立存在；不含摄像机、灯光、占位文字几何或烘焙旋转动画，前端应自行实现照明、文字、视频与旋转。导出过程没有改写主 `.blend`。

最终主工程重新打开后实际渲染：[正面](../../reviews/immersive-theater/2026-10-19/Preview_Front.png)、[左侧](../../reviews/immersive-theater/2026-10-19/Preview_Left.png)、[右侧](../../reviews/immersive-theater/2026-10-19/Preview_Right.png)、[后方](../../reviews/immersive-theater/2026-10-19/Preview_Back.png)（均为 1600 × 900），以及[空间全景](../../reviews/immersive-theater/2026-10-19/Preview_Overview.png)（1600 × 800）。全景为 360° 等距柱状图，后屏跨接缝显示在两端，实际仍只有四块屏幕。各图均保留探青采青主屏的保存状态，不代表已按镜头实现主屏自动切换。

独立进程重开最终 `.blend` 并与原件核对，完成 160 项检查，均通过；五张最终渲染也已逐张视觉审查。详见[原生工程与 GLB 检查记录](../../references/2026-10-19-immersive-theater-validation.json)。[Lux3D 本地结构检查](../../references/2026-10-19-immersive-theater-lux3d-inspection.json)验证最终 GLB 容器与嵌入资源有效，不能单独证明视觉质量或网页交互已实现。两份记录均绑定实际最终文件 SHA256。

## 后续替换与验证边界

尚待补充：专用舞台参考图、四段正式动作视频及其音轨；随后依据实际动作复核解说。当前四屏不包含真实动作播放，也未在网站中启用该影厅。

构建与重新渲染脚本为项目根 `scripts/build_immersive_theater.py`；独立检查脚本为 `scripts/validate_immersive_theater.py`。执行时使用本机 `F:/Blender/blender.exe`（与用户提供的 `F:/Blender/blender-launcher.exe` 同目录），不要覆盖原始醒狮文件。源文件由较新 Blender 版本保存，本机 5.0 读取时的兼容警告与实际验证范围应保留在检查记录中。
