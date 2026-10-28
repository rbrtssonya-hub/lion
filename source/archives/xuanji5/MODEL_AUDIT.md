# 醒狮模型审计与网页适配记录

## 原始资产与检查方法

- 原文件：`source/科比blend.blend`，136,175,747 bytes。
- SHA-256：`CC5F72C3E1A5C330DD64DAF6842720A91A8E21B6909A01B6F6200A8834545F53`。导出完成后复核一致。
- 源文件为 Zstandard 压缩的 Blender 5.1 文件，文件头 `BLENDER17-01v0501`。使用官方 Blender 5.1.2 便携版，以 `--background --disable-autoexec` 读取。
- 所有处理在内存中的派生对象上进行；没有保存、覆盖或重拓扑原 `.blend`，没有按视觉选区切开原始网格。
- 完整对象、父子关系、材质节点、图像引用见 `public/data/model-audit.raw.json`。网页坐标数据见 `public/data/model-audit.json`。

## 实际结构

场景共有 109 个对象：53 Mesh、49 Empty、3 Curves、3 Light、1 Camera。没有 Armature，没有动画 Action。原始网格合计 **577,721 个三角面**；应用原有倒角和细分修改器后，网页原生网格约 **645,764 个三角面**。这些是不同口径，不能混用。

场景中已有 `Pivot_Body`、`Pivot_Brow_L.001`、`Pivot_Crown`、`Pivot_Beard.001`、`Pivot_Jaw` 等部位轴心。部分轴心为空或没有相应有效子物体，不能把轴心数量当作可拆部件数量。派生 glTF 的原生网格对象逐一保留 `extras.sourceName`、`sourceParent` 和 `atlasPart`，但为网页测量与交互使用平面层级，顶点世界位置不变。

| 部位 | 实际关联原生网格 | 网页映射 | 限制 |
| --- | --- | --- | --- |
| 眉目 | `Lion_Brow_L.001/.002`、`Lion_Brow_R.001/.002` | `brows` | 只有眉饰独立。眼球、眼眶属于融合头壳，不声称可以独立拆开 |
| 额冠 | `Lion_Crown`、`Lion_Forehead_Bead_09`、`Lion_Head.001` | `crown` | 后者虽名为 Head，实际是额珠附近的微型装饰，按位置与几何重新归类 |
| 鬃须 | `Lion_Beard.001` 与两组头部/须部真实 Hair Curves | `beard` | 测量统计采用原生须网格；毛流研究采用真实曲线采样 |
| 织锦 | `Lion_Body` 及 `.001–.004` | `body` | 身体壳与绒毛发射面存在视觉重叠；四肢未计入身体研究统计 |
| 云边 | `Lion_Body_Red_Trim.001/.002` | `trim` | 独立的连续红色装饰层，包络采样不等于布料中心线 |
| 口齿 | `上牙`、`牙下`、`立方体`（纹饰舌片） | `mouth` | 舌片原名无语义，按材质与位置映射；仅原对象独立 |
| 其他 | 主头壳、耳、尾、四肢 | `head/ears/tail/limbs` | 保留完整外观，不强制扩展为研究入口 |

尤其需要注意：`Lion_Nose.003` 不是一个小鼻子，而是 **207,648 三角面的主要头部网格**。连通性检查发现 312 个连通分量，其中最大分量有 93,533 顶点，覆盖主要头壳。眼部没有可靠的独立闭合对象。网页可以将头部点击路由到眉目研究，但眉饰计算不包含整个主头壳，也不伪装眼部已分离。

## 坐标、尺度与测量

Blender 为 Z 向上，狮脸朝 -Y；导出转换为 glTF 的 `[x,z,-y]`，即 Y 向上、脸朝 +Z。原网格整体 glTF 包围盒：

```text
min = [-0.452021, 0.000000, -0.801512]
max = [ 0.452021, 1.000000,  0.801512]
size = [0.904042, 1.000000, 1.603024]
center = [0, 0.5, 0]
```

源场景单位设置为 `METRIC`、`scale_length = 1.0`；没有外部实物标定。因此图鉴采用模型单位或相对比例，避免把模型测量直接解释为某一实物醒狮的实际尺寸。包围盒代表轴向空间范围，不是体积、表面积或真实零件厚度。

## 材质、纹理与毛发

源文件有 24 个材质数据块、35 个图像数据块。其中 33 张 FILE 图像全部已打包，另两张为 Viewer/Render Result。虽然旧外部路径指向其他目录，打包数据完整，不需要用户补齐这些旧路径。主要为 2K 头部/身体图集、金属度/粗糙度图、舌片贴图、1254 × 1254 织锦纹样和 2K 微织物法线。

颜色以朱红绒面、象牙白须毛、珊瑚色头部与金色饰件为主。源材质基本为不透明 Principled BSDF；没有必须进行透明排序的大型透射结构。红色与纹样的历史寓意不能仅凭材质名称推出。

源模型毛发包含：

- 3 组 Hair Curves，共 **169,801 条曲线、849,005 个控制点**；每条 5 点。
- 30 个粒子短绒发射器，共 **30,000 条父毛**，离线渲染配置另有约 **2,120,000 条子毛**。

glTF 不直接携带 Blender Hair Curves、粒子插值或 Wave→Bump 节点图。适配措施：

1. 长毛每隔一根保留一条实际曲线，使用其全部五个原控制点生成渐细、双面带状网格，约 84,901 条。保持原有方向、覆盖区和轮廓，不生成虚构毛流。
2. 短绒使用 30,000 条原父毛的路径生成渐细带状网格，按每个原发射器 `ParticleSystem.settings.material` 指向的真实材质分组（11 组），包括朱红、象牙白及原始图集材质。使用 Blender `uv_on_emitter` 读取每根毛的真实根部 UV，沿该毛保持 UV，使原图集驱动毛色；不人为统一染红、不新增毛色。未导出的子毛不宣称为已还原，短绒密度和离线源渲染存在可见差异。
3. 原生几何和纹理维持；相同打包图像按像素文件哈希合并引用。原始不透明 Base Color 保持像素分辨率，转换为质量 95 的 JPEG；数据贴图和法线仍使用无损 PNG。
4. 原材质的 Wave→Bump 程序微细织纹没有烘焙。导出器会误将上游灰度 mask 当作切线法线，已移除这项错误法线引用；真实微织物法线、舌片法线继续保留。该兼容差异不涉及删除几何。
5. 对派生求值网格运行 Blender 标准数据验证，处理源数据中不合法的内部面/材质记录；无人工选区切割、重拓扑或细节简化。原网格与纹理仍保存在只读源文件中。

`source-preview.png` 是原 Blender 毛发渲染，`derived-preview.png` 是同视角派生几何渲染；二者用于说明兼容差异，不能将派生图当作完全相同的源效果。

## 派生资产与性能口径

当前 `public/models/lion.glb`：**35,159,152 bytes（约 33.5 MiB）**；67 个对象/网格（53 原生 + 3 长毛组 + 11 短绒材质组）、87 个材质 primitive、约 **1,624,972 三角面**、1,937,922 个 primitive 顶点记录、22 个 glTF 材质、12 张嵌入式图像。几何使用 Draco level 6。顶点数按每个 primitive 累加，包含材质边界重复，不能与源唯一顶点直接比较。

87 是模型 primitive 数，也是在每 primitive 一次绘制时的基础 draw-call 估计；页面辅助线、地面、阴影和多通道效果还会增加实测 draw calls。最终运行帧率取决于 GPU、像素比与视角，应以网页 renderer.info 为准，不能由文件体积推断。2K RGBA 图像在 GPU 中约 16 MiB/张（含 mipmap 约 21.3 MiB）；按 12 张图像的尺寸粗估约 243 MiB，纹理共享、实际尺寸和格式会影响实际分配。另有几何与渲染缓冲成本。

原生 glTF 对象的 `extras.sourceParticleEmitter` 明确标记 30 个源发射面；派生毛发有 `derivedHair=true` 和 `derivation=sampled-original-hair-ribbon`，短绒另有 `sourceEmitterNames`。这些信息允许运行时仅对共面发射面设置材质深度偏移，避免误影响真实须毛。源发射面多数与底层三角形重复，但耳部发射面包含独有面，不能全部隐藏。`hairMaterialSources` 记录每个源发射器实际材质、材质槽和根部 UV 来源。

完整模型只加载一次；研究数据已在导出阶段预计算，避免每帧遍历所有原顶点。网页选取应优先使用部位代理或受限目标，并控制 DPR。当前资产主要面向桌面；低性能移动设备可能降低帧率，无法承诺与桌面一致。

## 数据来源与算法边界

- `parts[].bounds/vertices/triangles/structures`：原生求值网格直接测量。
- `parts[].samples`：按顶点索引确定性抽样，适合轮廓/分布展示，不是面积均匀采样。
- `parts[].outline`：真实顶点正交投影后的单调链凸包，**不是含凹部与孔洞的精确轮廓线**。
- `trim.profile`：沿身体纵向分为 48 个区间后，求真实顶点的上、下包络，不是手绘波形。
- `body-uv.json`：约 450 个实际三角面的 UV 坐标抽样，不是完整 UV 展开图。
- `curves.json`：3 组原毛发各约 96 条确定性抽样，保持五个实际控制点与 glTF 世界坐标。
- `texturePalettes`：实际纹理图像缩小到 160 × 160 后以中位切分量化为七色。比例是**纹理像素占比**，不是模型表面积或当前镜头可见像素占比。
- 用户调整产生的曲线、重复单元或幅度变化属于设计推演，应在界面标为抽象参数，不能冒充实测。

## 复现

```powershell
& 'C:\Users\Administrator\.cache\lion-atlas-tools\blender-5.1.2-windows-x64\blender.exe' --background --disable-autoexec '.\source\科比blend.blend' --python '.\scripts\audit_blend.py'
& 'C:\Users\Administrator\.cache\lion-atlas-tools\blender-5.1.2-windows-x64\blender.exe' --background --disable-autoexec '.\source\科比blend.blend' --python '.\scripts\export_lion.py' -- --with-hair --render-derived
python '.\scripts\optimize_glb.py'
```

Blender 安装在用户缓存，不是运行网页的前提。运行网页只需要导出的资产与 Node.js。`optimize_glb.py` 使用 Pillow；网页运行不依赖 Python。
