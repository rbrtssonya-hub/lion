# 结构页：用户 Blender 模型的网页导出

核实日期：2026-10-19。源文件由本轮用户提供；这里只转换为网页资产，不保存或重写用户 `.blend`。

## 原件与产物

| 项目 | 实际结果 |
| --- | --- |
| 源文件 | `model/醒狮_保留UV_三角转四边_优化.blend`，139,309,821 B，保留在用户指定原位置，不纳入 Git |
| 源 SHA256 | `2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2` |
| 网页资产 | `source/public/assets/models/lion-structure-optimized.glb`，20,238,640 B（19.30 MiB） |
| GLB SHA256 | `d4158473799871c9676f022e0a526c240a3c2bfb0f77abf4fc2f8b36160d257f` |
| 几何 | 完整四足醒狮；41 个 mesh / 41 个 node，513,600 三角，740,169 个导出顶点；其中 23 个源分件与 18 个毛发网页近似网格 |
| 材质与纹理 | 14 个等值去重后的材质、6 张嵌入 JPEG（质量 90）；六张 JPEG 与首次导出的原字节相同，保留原 2048×2048 / 1254×1254 尺寸及使用中的 UV |
| 量化 | `KHR_mesh_quantization`；位置 16 位、法线 8 位、单位范围 UV 16 位；超出 [0,1] 的铺陈 UV 保留 Float32 |

本模型与旧的单网格狮头不同。源对象包含真实命名的可见表层分区；源自定义属性明确记录这些分区来自原三角形的空间 / UV 颜色选择，存在未封口切边，不是重建的完整工艺内构、解剖拓扑或可变形关节。眼球与部分口鼻轮廓仍在大头壳中，网页表面分区点击不代表新增了独立眼球零件。

## 复现

本机使用 `F:/Blender/blender.exe`，版本 5.0.0。源文件由 5.1 写入，读取时会出现新版文件兼容警告；导出不调用任何保存 `.blend` 的操作，并在前后比较源 SHA256。Blender 退出还报告本身的未释放内存块，进程仍以 0 结束；网页资产的有效性另行验证。

```powershell
# 首次导出：默认拒绝覆盖已有 GLB
& 'F:/Blender/blender.exe' --background --factory-startup --python scripts/export_lion_structure.py

# 有意更新既有网页导出
& 'F:/Blender/blender.exe' --background --factory-startup --python scripts/export_lion_structure.py -- --overwrite

# 只检查源文件；报告输出到显式路径，避免覆盖正式报告
& 'F:/Blender/blender.exe' --background --factory-startup --python scripts/export_lion_structure.py -- --inspect-only --report "$env:TEMP/lion-source-inspection.json"
```

脚本使用固定的 `@gltf-transform/cli@4.2.1`，通过 `npm exec` 运行本项目的 `scripts/optimize_lion_structure.mjs`，使用该固定工具携带的 glTF Transform 与 meshoptimizer 0.24.0 做离线减面、等值去重和量化；首次需要 npm 下载，之后可以复用 npm 缓存。应用不依赖此离线制作工具。标准量化由现有 Three GLTFLoader 支持，不需要 Draco、Meshopt 或外部 WASM 解码器。`--input`、`--output`、`--report` 支持项目相对路径或绝对路径，并要求分别为 `.blend` / `.glb` / `.json`；已有 GLB 默认拒绝覆盖。`--fiber-stride` 默认 12；`--fiber-point-tolerance` 默认 0.000025 米（0.025 mm）；`--simplify-ratio` 默认 0.25、`--simplify-error` 默认 0.003。这些值均验证合法范围。`--skip-quantization` 跳过整个离线优化阶段，仅供未减重的检查导出，仍保留 Sheen 修正。工具说明见 [glTF Transform CLI](https://gltf-transform.dev/cli) 与 [meshoptimizer Simplifier](https://github.com/zeux/meshoptimizer/tree/v0.24/js#simplifier)。

## 实际优化与显示修正

- 15 个 `.001` 对象是可见结果完全相同的重叠副本。严格指纹包括顶点、索引、每面长度与材质索引、平滑标记、全部 UV、浮点世界矩阵、材质节点输入 / 连线 / 设置与 packed 图片原字节；只忽略材质副本名称。网页导出排除这些副本，原件保留。
- 对选中 mesh 在内存执行 Blender `Mesh.validate(clean_customdata=False)`，修复少量非法多边形；随后在网页产物上执行考虑法线、全部使用中 UV 的 meshoptimizer 减面。目标比率 0.25 受 0.003 的相对加权误差约束，达不到目标时保留更多三角；法线三分量权重各 0.1，UV 分量权重各 0.01。保留存活顶点原有完整属性，不重铺 UV、不改图集、不重建源拓扑。这是误差受限的有损网页减面，不能等同于数学上的逐点零误差。每个 primitive 的实际前后数量与误差见 JSON 的 `web_optimization`。
- glTF 不承载 Blender 原生毛发曲线。18 个曲线对象按每 12 根保留 1 根转为双面窄带；鼻口短毛 1,958 根全部保留，总计 24,081 根采样毛发，与首次导出的根数一致。仅在 0.025 mm 的世界空间中心线 / 半宽误差内减少中间点，85,458 点保留 85,007 点；每根的两端保持，三角形简化器不处理独立窄带，避免直接删掉完整毛发。半宽依据源 `fiber_world_radius_max`（约 0.14–0.16 mm）还原；鼻口曲线本身已有米制半径，直接保留。原材质 Hair BSDF 以既有猩红 Principled 材质代替。这是明确的网页近似，并非无损毛发转换。
- 首次网页导出 24,428,652 B / 720,271 三角 / 885,411 顶点；本轮保持六张嵌入 JPEG 原字节，经上述减面、材质等值去重、标准量化及前后两次等值顶点焊接后为 20,238,640 B / 513,600 三角 / 740,169 顶点，分别减少 17.15% / 28.69% / 16.40%。最后去掉 2,314 个索引重复而面积为零的量化收缩三角，并清理未引用顶点；此步不删除可绘制面积。没有新增运行下载贴图。
- 源 `Lion_Atlas_PBR_Refined` 的程序化 Bump 网络被 Blender glTF 导出器误识别，灰度织纹 mask 被写成 RGB 法线图，造成四肢大块黑白碎斑。实际浏览器逐项对照表明 DoubleSide、相机精度、环境反射与单独关闭金属度均不能修复；只关闭这张错误法线即可恢复完整足部。脚本在内存移除不支持的程序化 Bump 输出；保留颜色、粗糙度、金属度、UV 和真实 Normal Map 节点，最终 GLB 不含错误灰度法线。源文件未改。
- 首次导出的 `KHR_materials_sheen.sheenColorFactor` 遗失了 Blender 的独立 `Sheen Weight`，把织物白色 tint 当成强度 1，导致红色被白色绒面高光覆盖。脚本读取源 Principled 的未连线 Weight / Tint，在导出后按材质精确名字写入 `factor = Tint RGB × Weight`。两个 atlas 的源权重 0.12、织锦 0.18，米白绒面为 0.20 / 0.25 / 0.23，红绒为 0.22；12 处修正前后值见 JSON 的 `material_sheen_corrections`。保留原颜色贴图、粗糙度 / 金属度与真实法线，未修改用户原件。实际浏览器分离对照证实此修正恢复红色，场景光照再做适量平衡。

## 部件映射与坐标

glTF 轴向为 `(Blender X, Blender Z, -Blender Y)`，即 +Y 向上、+Z 朝脸前。下表 center 为未经页面归一化的模型空间，供命中 / 聚焦核对；完整 min/max 在 JSON。页面以完整模型的实际包围盒居中并归一化，不能直接把表内坐标当作归一化世界坐标。

| 页面组 | 主要源对象 | glTF center (X, Y, Z) |
| --- | --- | --- |
| 彩绘狮头 | `Lion_Nose`（实际为大头壳）、`Lion_Ear_L/R` | `(-0.000565, 0.636894, 0.455724)` |
| 鼓眼与狮眉 | `Lion_Brow_L/R`，眼球采用头壳表面区域 | `(-0.000570, 0.764021, 0.662497)`，为眉组中心 |
| 额饰与狮角 | `Lion_Crown`、`Lion_Forehead_Bead_09`、`Lion_Head.001` 小部件 | `(0.000402, 0.853874, 0.553701)` |
| 狮嘴 | `上牙`、`牙下`、`立方体`，外唇 / 鼻形采用头壳表面区域 | `(0, 0.439061, 0.653032)`，为新增口内对象组中心 |
| 须毛与边饰 | `Lion_Beard` 与 `*_WebFibers` | `(-0.000619, 0.305057, 0.640391)`，为胡须组中心 |
| 狮被与狮尾 | `Lion_Body`、`Lion_Body_Red_Trim`、`Lion_Tail` 与 `Foreleg/Forepaw/Hindleg/Hindpaw_L/R` | `(0, 0.393929, -0.098748)` |

## 来源标注边界

检查了场景、对象、mesh、材质的自定义属性。源头部标为 `head_highdetail_4055287`，身体标为 `g1_full_lion_4054240`；未发现明确 Lux3D 或 AI 服务商归属，不能由通用 ID 推定此新模型的生成方式。材质属性明确写明颜色推断 PBR，不是实测织物或还原的刺绣；装饰织锦名称包含 `ReferenceInspired` / `Study`，页面作为模型与工艺资料示意呈现。旧模型的 AI 来源记录不随本次替换删除。

## 核实范围

脚本实际完成 Blender 导出、Sheen 修正、加权减面 / prune / dedup / quantize / weld、源 hash 前后相同校验，且严格副本复核仍为上述 15 个。通过固定 `gltf-validator@2.0.0-dev.3.10` 的 `validateBytes` 实际验证最终上述 SHA 的文件，返回 0 errors、3 warnings：三处真实法线纹理的切线空间由运行时生成，跨渲染器一致性仍有边界；1 条 info 为原 1254² 非二次幂纹理，无重复索引退化三角提示。验证后补录的 `post_export_verification` 绑定本次 GLB hash；将来重新导出后须重新运行验证，不能复用旧结果。

通过固定 glTF Transform NodeIO 解码并与 `main@1f8f206` 中的首次导出比较，最终 41 个 node 名字、每个有颜色纹理 primitive 的 UV 语义覆盖一致，整体世界包围盒六个端点差值均为 0；六张嵌入 JPEG 的大小 / SHA 逐张相同。这些结果保存在 JSON 的 `post_export_verification`，证明部件命名 / 点击映射、模型尺度和源纹理保留；不代表局部减面逐像素相同。

显示故障用 1920×1080 的桌面 Chrome、Playwright 响应拦截独立对照，未改服务源码进行实验；临时诊断图留在系统临时目录，不进入部署资产。最终页面构建、部件交互、响应尺寸与生产截图由本轮整体验收记录。
