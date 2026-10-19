# 结构页：用户 Blender 模型的网页导出

核实日期：2026-10-19。源文件由本轮用户提供；这里只转换为网页资产，不保存或重写用户 `.blend`。

## 原件与产物

| 项目 | 实际结果 |
| --- | --- |
| 源文件 | `model/醒狮_保留UV_三角转四边_优化.blend`，139,309,821 B，保留在用户指定原位置，不纳入 Git |
| 源 SHA256 | `2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2` |
| 网页资产 | `source/public/assets/models/lion-structure-optimized.glb`，24,428,652 B（23.30 MiB） |
| GLB SHA256 | `f4f7f6a25f84d8457afd6fd42e44702607213b037613d019b936d10c4422b0e0` |
| 几何 | 完整四足醒狮；41 个 mesh / 41 个 node，720,271 三角，885,411 个导出顶点；其中 23 个源分件与 18 个毛发网页近似网格 |
| 材质与纹理 | 16 个材质、6 张嵌入 JPEG（质量 90）；保留原 2048×2048 / 1254×1254 尺寸及使用中的 UV |
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

脚本使用固定的 `@gltf-transform/cli@4.2.1`，通过 `npm exec` 顺序执行 quantize、prune、weld；首次需要 npm 下载，之后可以复用 npm 缓存。应用依赖与 `package-lock.json` 不增加此离线制作工具。标准量化由现有 Three GLTFLoader 支持，不需要 Draco、Meshopt 或外部 WASM 解码器。`--input`、`--output`、`--report` 支持项目相对路径或绝对路径；`--fiber-stride` 默认 12，`--skip-quantization` 仅用于未减重的检查导出。工具说明见 [glTF Transform CLI](https://gltf-transform.dev/cli)。

## 实际优化与显示修正

- 15 个 `.001` 对象是可见结果完全相同的重叠副本。严格指纹包括顶点、索引、每面长度与材质索引、平滑标记、全部 UV、浮点世界矩阵、材质节点输入 / 连线 / 设置与 packed 图片原字节；只忽略材质副本名称。网页导出排除这些副本，原件保留。
- 对选中 mesh 在内存执行 Blender `Mesh.validate(clean_customdata=False)`，修复少量非法多边形；不重拓扑、不进一步整体减面。修复明细与导出设置见同目录 JSON。
- glTF 不承载 Blender 原生毛发曲线。18 个曲线对象按每 12 根保留 1 根转为双面窄带；鼻口短毛 1,958 根全部保留，总计 24,081 根 / 122,754 三角。半宽依据源 `fiber_world_radius_max`（约 0.14–0.16 mm）还原；鼻口曲线本身已有米制半径，直接保留。原材质 Hair BSDF 以既有猩红 Principled 材质代替。这是明确的网页近似，并非无损毛发转换。
- 原始直导 67.4 MB，7 张高位深 PNG 约 30.34 MB；改为 JPEG90、移除未使用顶点属性、标准量化及等值顶点焊接后为上述最终 24.43 MB。没有新增运行下载贴图。
- 源 `Lion_Atlas_PBR_Refined` 的程序化 Bump 网络被 Blender glTF 导出器误识别，灰度织纹 mask 被写成 RGB 法线图，造成四肢大块黑白碎斑。实际浏览器逐项对照表明 DoubleSide、相机精度、环境反射与单独关闭金属度均不能修复；只关闭这张错误法线即可恢复完整足部。脚本在内存移除不支持的程序化 Bump 输出；保留颜色、粗糙度、金属度、UV 和真实 Normal Map 节点，最终 GLB 不含错误灰度法线。源文件未改。

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

脚本实际完成 Blender 导出、量化 / prune / weld、源 hash 前后相同校验，且严格副本复核仍为上述 15 个。`npm exec --yes --package=@gltf-transform/cli@4.2.1 -- gltf-transform validate source/public/assets/models/lion-structure-optimized.glb` 实际返回 0 errors、3 warnings：三处真实法线纹理的切线空间由运行时生成，跨渲染器一致性仍有边界；5 条 info 包括原 1254² 非二次幂纹理，以及 4 个毛发窄带 mesh 中经量化收缩的 374 个退化三角（总 720,271 中约 0.052%）。未以这些提示声称跨浏览器或真实 GPU 性能已验收。

显示故障用 1920×1080 的桌面 Chrome、Playwright 响应拦截独立对照，未改服务源码进行实验；临时诊断图留在系统临时目录，不进入部署资产。最终页面构建、部件交互、响应尺寸与生产截图由本轮整体验收记录。
