# 醒狮红绒明暗均衡：官方资料、对照实验与实现边界

日期：2026-10-22（本轮调查从 2026-10-21 延续）。工作区基线为 `main@5b2a30769a006d626f78680369689b237c6bb858`；以下实验发生在该基线上叠加本轮工作区，不能用历史构建或其他分支的测试替代最终验收。

长期证据入口为 [本轮验证记录](lion-fur-balance-2026-10-22-validation.json)，正式对照入口为[图版](../reviews/lion-fur-balance/2026-10-22/comparison.html)。文中的 `tmp/` 是可复查的本机实验输出，不作为可长期取得的交付资产。下文区分未采用的中间实验与最终生产验证；Git 实际提交、推送结果以本任务最终回复为准。

## 用户目标与比较范围

用户指出最新网页已有部分质感提升，但红绒存在大块深红近黑与亮粉分界，白毛部分显得平白，Blender 观感更均衡；要求查询 Three.js、Blender 官方资料，随后授权实际修复并提供前后对照。用户另给《醒狮_网页还原Blender_原因分析与AI提示词_202610.md》作为排查线索，其中未审计当前网页的候选原因需逐项核实，不能直接当作已确认缺陷。

验收重点是正常近全身观看距离下的大尺度明暗与细碎绒毛层次，同时保留原造型、配色、纹样、材质分区、完整发丝数据与现有动画。网页背景舞狮照片不是当前三维模型的材质还原基准。

## 已核实的原件与材质

使用 Blender 5.1.2 对 `source/models/user-lion-2026-10-20.blend` 做后台只读检查，没有保存源文件。原件 SHA256 为 `dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770`。官方源码稀疏检出到 `tmp/blender-shader-reference/`，revision 为 `ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832`，与本机 Blender 5.1.2 的构建 hash 相同。

| 项目 | 原件与现行导出资产的实际证据 | 对诊断的含义 |
| --- | --- | --- |
| 主要红绒 | `Velvet_Scarlet_Uniform_Base`、`Head_Scarlet_Velvet_Base` 只有 Principled BSDF 与 Output 两节点，没有颜色图、法线图或 Alpha 贴图；线性基础色约 `[0.21, 0.0027, 0.006]`，Metallic=0、Roughness=.88、Specular IOR Level=.14、Sheen Weight=.22、Coat=0、Alpha=1 | 这些区域不能直接归咎“颜色贴图缺失”“法线图接错”或“透明贴片阈值”。不代表其他彩绘/织锦材质没有转换限制。 |
| 白毛示例 | `Fiber_Warm_Ivory` 同样无贴图，线性基础色约 `[1,.9735,.9073]`、Roughness=.72、Sheen=.20；`Head_Ivory_Fringe_Base` 约 `[.74,.72,.68]`、Roughness=.86、Sheen=.23 | 源材质本就非常浅，必须检查照明、覆盖与内部层次，不能把统一变灰当作修复。 |
| GLB 材质 | 当前 `lion-user-full.glb` 包含 23 个材质、12 张嵌入图；上述红绒的金属度、粗糙度、基础色、Specular 与 Sheen 扩展都存在，Alpha 模式为 OPAQUE | “导出把全部红绒变成金属”或“Sheen 全部丢失”不符合当前资产。 |
| Specular 数值换算 | Blender `.14` 导成 glTF `specularFactor=.28`；同版本导出器明确执行 `×2` 换算 | 不能仅凭两端面板数字不同认定网页擅自把高光翻倍。 |
| atlas 程序织纹 | 源 `Lion_Atlas_PBR_Refined` 包含 Wave→Math→Bump；现行网页只对已知错误导成 normalTexture 的灰度高度图作 Bump 解释适配 | 程序细节并不完整等价，但不涉及无贴图红绒的主要明暗分界；本轮未烘焙或重做该部分。 |

Three.js 使用项目锁定的 `0.160.0`。其 GLTFLoader 支持 Sheen 并选用物理材质，颜色贴图按 sRGB、粗糙度/金属度等数据贴图按非颜色数据处理；工程发丝克隆对应源材质，没有统一改写为一套颜色或粗糙度。[Three.js r160 加载器源码](https://github.com/mrdoob/three.js/blob/r160/examples/jsm/loaders/GLTFLoader.js)、[Three.js 颜色管理说明](https://threejs.org/manual/pages/color-management.html)。

## 从完整着色链排除的误判

### 朝相机法线并非本轮发现的错误

仅比较一个 `cross(T,V)` 公式不足以确认两端法线相同。本轮继续追踪同构建版本的完整链：`draw_curves_lib.glsl` 构造 `curve_N`；曲线顶点着色器写入 `interp.N`，并传入 binormal、radius 与 time_width；`init_globals_curves` 再计算圆柱截面的最终 `g_data.N/Ni`。STRAND 的 azimuthal offset 固定为零，所以 time_width/radius 为零，最终仍为归一化的 `interp.N`。Principled 未连接 Normal 时的 `world_normals_get` 只是返回 `g_data.N`，没有自动混合发根表面法线。[曲线形状与法线](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/intern/shaders/draw_curves_lib.glsl)、[曲线顶点路径](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_geom_curves_vert.glsl)、[最终全局法线初始化](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_surf_lib.glsl)、[默认 Normal 入口](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/gpu/shaders/material/gpu_shader_material_implicit_defaults.glsl)。

Blender 非根评估点采用后向切线，网页在线性折点采用中心差分。对真实 LINEAR 发丝 buffer、匹配的近全身侧面相机进行 CPU 核查，每组等距抽取 1,000 根发丝，各组最终法线角差 p99 约 .002–.019°；短发丝近乎直线。该采样不能证明所有点完全相同，但不足以支持其造成整片明暗反差；实际法线 A/B 也未带来主要改善。最终方案没有更换原发丝法线。

官方同 hash 着色目录的全路径检索未发现普通 Principled 的 hair 专用 diffuse/IBL 衰减分支。`g_data.is_strand` 被 Geometry、Hair Info 等节点读取，不会自动改变这里的 Principled 闭包。不能因此给源材质套用 Principled Hair BSDF 的解释。[Principled GPU 实现](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/gpu/shaders/material/gpu_shader_material_principled.glsl)、[闭包与照明路径](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_closure_lib.glsl)。

### 其他未被采用的候选

| 候选 | 本轮结果与处理 |
| --- | --- |
| 只加减辅助灯或环境强度 | 实际 A/B 可改变亮度和饱和度，但白毛 `soft-fill` 主要为约 +.098EV 的变化，近邻相对层次没有增加；未作为根本修复。 |
| Blender OCIO 显示变换 | 导出并试验了更准确的显示转换。近全身侧面红毛 RGB8 平均绝对差由 27.18 降至约 25.40，但红毛大分界与微细层次仍明显，饱和度中值约 .96，高于参考 .871；白毛色差反略增。未接入产品。 |
| EEVEE Sheen 拟合与层次顺序 | 官方 EEVEE 与 Three.js Charlie Sheen 的实现确有差异，但实际适配 A/B 无主要收益。未把实验着色器接入产品。 |
| 更改 Specular/粗反射 | 存在不同积分与预过滤实现，但本轮独立试验不足以支持采用材质高光覆盖；最终仍使用现行 Three.js PMREM 的镜面项。 |
| Fast GI 或屏幕空间反弹补光 | 原件 `use_raytracing=false`。虽保存的 `use_fast_gi=true`，同版本 C++ 以 raytracing 开关限制该路径，不能把参考均衡归因于已启用 Fast GI。 |
| 简单把截图“黑/白”当成数值剪裁 | 初轮固定发丝 mask 下，红毛 R<30 占比本来为零；视觉上近黑、平白不等于全部数值被剪成 0/255。记录分区分布与层次，不虚称修复了不存在的统一剪裁。 |

以上“未采用”指没有接入最终网页渲染路径；实验脚本或隔离比较模块若保留，属于研究与复查工具，不表示用户正在使用该候选效果。最终 diff 与验证记录应对此再核对。

## 已采用的改变：醒狮环境漫反射使用 L1 与去振铃约束

同版本 EEVEE 的 `LightProbeSample.volume_irradiance` 使用 L1 球谐，即常量加三个方向系数；Diffuse 的 perceived roughness 为 1，最终由相应的 Lambert 卷积求环境响应。Three.js r160 原路径则从 PMREM 的最粗级别取得环境漫反射，两者不是同一种近似。[EEVEE 环境照明求值](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_lightprobe_eval_lib.glsl)、[Diffuse 求值](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_bxdf_diffuse_lib.glsl)、[球谐 Lambert 卷积](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_spherical_harmonics_lib.glsl)、[Three.js r160 原环境采样](https://github.com/mrdoob/three.js/blob/r160/src/renderers/shaders/ShaderChunk/envmap_physical_pars_fragment.glsl.js)。

本轮实现由 `src/services/lionDiffuseProbe.js` 投影实际已解码的 EXR/HDR 线性像素，按经纬图 texel 立体角积分 L1，并随现有环境水平旋转更新方向系数。适配 Three.js 的九槽接口时只保留前四项，其余 L2 项为零，不能误称采用完整 L2 来还原源 L1。DWAB 的小负振铃仅在漫反射积分中夹取为零，不修改源 EXR 字节或镜面 PMREM 像素。

最终实现还包含 EEVEE 世界探针实际使用的去振铃约束：官方 `eevee_lightprobe_volume_world_comp.glsl` 在写入世界探针前调用 `spherical_harmonics_dering`，同版本 SH 库按各颜色通道的 L0 平均能量与 L1 方向能量限制求公共缩放量，并加 `.05` 对比余量，避免负瓣和不真实的强反差。网页以独立数学表达实现同一能量上界，L0 不动，仅对三个方向系数使用统一 RGB 因子；当前 forest 实测因子约 `.693242`。这不是人为调灰或更换源基础色。[官方世界探针写入](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_lightprobe_volume_world_comp.glsl#L38)、[同版本去振铃能量约束](https://github.com/blender/blender/blob/ec6e62d40fa9e9d1bea33ad5d00148c99a4f0832/source/blender/draw/engines/eevee/shaders/eevee_spherical_harmonics_lib.glsl#L719)。

没有该约束的 raw L1 曾使结构背面暗部恶化，属于未采用的中间实验。仅证明“换成 L1 有部分改善”不足以决定最终方案；最终交付是经过六视图复核的 **L1 + dering**，不能把下方早期 raw L1 的指标误写成最终结果。

`lionHdriEnvironment.js` 将投影结果与解码 CPU 数据一起复用；`lionLightingSettings.js` 为各场景持有稳定系数数组，并仅给完整醒狮的网格及发丝材质安装环境漫反射替换。房间、鼓与视频沿用原路径。原始基础色、粗糙度、金属度、Sheen、几何、发丝法线、镜面 PMREM 与 AgX 保留。模型侧既有环境系数 .65 和默认辅助灯 .35 不因本轮重设；设置仍保留环境强度、旋转、曝光与自定义 HDRI 功能，以及用户显式保存的参数。

这是一项有对照支持的环境漫反射近似修正，不是对 EEVEE 全渲染器的复刻。没有通过统一调灰、加饱和度、减少毛发或烘焙新配色来抵消差异。

## 匹配投影的实验与独立指标

`scripts/render_lion_material_reference.py` 由网页捕获完整模型世界矩阵、相机世界矩阵与投影矩阵，在原件载入后的内存场景中建立匹配相机，保留原生粒子与 Curves，使用同一真实 `forest.exr`。参考为 EEVEE、AgX/Look None、EV0、Gamma1、64 次采样、透明背景、无额外源灯；原件不保存。近全身侧面为 1905×990，投影矩阵最大误差约 `1.19e-7`，源到 clip 变换最大误差约 `1.19e-6`。这些数字证明取景变换匹配，不证明光照、采样或材质积分完全等价。

本机参考位于 `tmp/lion-fur-blender/close-{side,back}-forest.png`；独立原基线使用 `tmp/lion-fur-sheen/before-theater-{side,back}-canvas.png`。早期 raw L1 实验位于 `tmp/lion-fur-l1/`，其中 `sh-l1` 保留 .65 环境系数与 .35 辅助灯，`sh-l1-unit` 改为无辅助灯/环境系数 1；两者均不是最终交付版本。最终 Vite 原生网页捕获与独立分析位于 `tmp/lion-fur-final-dering/`。

分析脚本 `scripts/analyze_lion_fur_comparison.py` 读取未缩放的原生 PNG：以网页 shader 红/白发丝 mask 作为固定投影空间选区，再与参考 alpha=255 求交，排除背景与半覆盖边缘。侧面共同有效红毛 227,577 像素、白毛 104,504 像素；背面红毛 145,528、白毛 185,987。没有独立生成 Blender 材质分类 mask，因此这是共享投影选区，不能冒称两渲染器逐像素材质分割已经一致。ROI 固定为 `lower_red=(500,480,850,440)`、`upper_red=(550,220,900,330)`，下表为完整分类选区的结果。

### 中间 raw L1 实验：部分收益不足以直接采用

| 对照指标 | 原网页 | L1（保留原灯光参数） | Blender 参考 |
| --- | ---: | ---: | ---: |
| 侧面红毛与参考的 RGB8 平均绝对差 | 27.18 | 23.07 | 参照端 |
| 侧面白毛与参考的 RGB8 平均绝对差 | 11.33 | 10.38 | 参照端 |
| 背面红毛与参考的 RGB8 平均绝对差 | 24.98 | 21.37 | 参照端 |
| 背面白毛与参考的 RGB8 平均绝对差 | 6.30 | 4.59 | 参照端 |
| 侧面红毛 97px 平滑场明暗 CV | .409 | .285 | .294 |
| 背面红毛 97px 平滑场明暗 CV | .387 | .244 | .193 |
| 侧面红毛 9px 平滑场明暗 CV | .662 | .443 | .847 |
| 侧面红毛近邻 log2 亮度差均值 | .0695 | .0531 | .2193 |

33/97px 的分类内平滑场用于观察宽泛的明暗色带，9px 与近邻差用于补充观察细碎层次；两者要结合原图判断，不能只奖励“更高对比”或“更平”。L1 的宏观结果更靠近参考，支持其确实减弱大色带；微细红毛仍明显落后，部分指标进一步变平，不能把这项收益写成毛发细节已经与 EEVEE 相同。

`sh-l1-unit` 并非更好的最终默认：侧面红毛/白毛 RGB8 平均绝对差约 25.93/15.18，背面约 24.31/10.28；白毛更亮，红毛饱和度更低。它的参数数字更接近参考 world 强度，不等于视觉更接近。因此最终保留既有 .65/.35，而不是为了同名参数强行统一。

独立汇总位于 `tmp/lion-fur-l1/independent-reference-summary.json`；六个 `independent-{before,sh-l1,sh-l1-unit}-{side,back}-reference.json` 包含 RGB、饱和度、色相、p5–p95、同 ROI、mask 覆盖与曝光拟合残差。微细差也可能受采样噪声和覆盖影响，不能把高频差分单独当作真实质感分数。

分析工具额外用合成数据验证：同图输入保持完全一致；统一线性曝光乘数 .35 不增加归一化近邻或 9/33/97px 指标；红色变灰会出现饱和度审查提示；尺寸不匹配明确拒绝；透明背景可接受，只排除被测分类内非不透明像素。最初探针对浮点结果使用精确 `==` 导致一次失败，改为合理容差后通过，没有为结果修改图像或放宽产品指标。

### 最终 L1 + dering：两页六视图的独立复核

最终捕获的 `audit.json` 有 `finishedAt`，包含原基线/最终版本共 12 个案例，错误数组为空；六组原生 before/after 发丝 mask 的 IoU 均为 1。独立审查逐张查看了结构与动作的默认、侧面、背面共 12 张原图，并运行不占用 GPU 的图像分析。最终动作侧面/背面与上述 Blender 参考的相机、投影、模型矩阵逐项差为零，输出尺寸保持 1905×990。

| 页面/视图 | 红毛显示亮度低于20占比：前→后 | 白毛显示亮度中位数：前→后 |
| --- | ---: | ---: |
| 结构默认 | 15.47% → .88% | 188.63 → 188.29 |
| 结构侧面 | 21.50% → 6.59% | 188.35 → 184.58 |
| 结构背面 | 66.56% → 49.54% | 142.64 → 160.64 |
| 动作默认 | 28.18% → 7.82% | 187.07 → 191.29 |
| 动作侧面 | 25.01% → 6.72% | 189.15 → 191.14 |
| 动作背面 | 16.55% → 2.49% | 193.35 → 198.35 |

上表“显示亮度”是对 sRGB 8 位输出作加权所得的显示 luma，不是场景线性物理亮度，也不把饱和深红一律认定为数值剪裁。结构背面仍偏暗，但红毛中位数从 15.95 提至 20.13，白毛也从 142.64 提至 160.64，证明确实修复 raw L1 的新增暗面恶化，不能扩大为背面所有暗色均已消失。

| 与 Blender 的固定投影选区对比 | 原网页 | 最终 L1 + dering | Blender 参考 |
| --- | ---: | ---: | ---: |
| 侧面红毛 RGB8 平均绝对差 | 27.18 | 21.20 | 参照端 |
| 侧面白毛 RGB8 平均绝对差 | 11.33 | 7.65 | 参照端 |
| 背面红毛 RGB8 平均绝对差 | 24.98 | 19.56 | 参照端 |
| 背面白毛 RGB8 平均绝对差 | 6.30 | 2.96 | 参照端 |
| 侧面红毛 97px 宏观 CV | .409 | .243 | .294 |
| 背面红毛 97px 宏观 CV | .387 | .206 | .193 |
| 侧面红毛近邻 log2 亮度差均值 | .0695 | .0387 | .2193 |
| 背面红毛近邻 log2 亮度差均值 | .0547 | .0295 | .2219 |
| 侧面白毛近邻 log2 亮度差均值 | .0290 | .0170 | .0323 |
| 背面白毛近邻 log2 亮度差均值 | .0168 | .0075 | .0181 |

最终大色带和分区色差确有改善，但红、白细毛的近邻起伏均未达到 EEVEE，部分细节还更平；尾巴、胡须仍有较平的块面。这是当前实际保留的质量边界，不能仅凭宏观数字变好宣布材质、蓬松感或微细采样已完全还原。目视没有发现新增的几何、文字布局或场景对象丢失。动作默认审查近景在前后都裁到头顶，属于本次固定取景的覆盖限制；完整近全身侧面用于核对核心诉求。

完整独立结果在 `tmp/lion-fur-final-dering/independent-review-summary.json`，另有六个前后比较与四个 Blender 参考比较 JSON；长期验证入口已保存对应结果。正式图版包含原图、最终图、分类 mask、匹配 Blender 参考及排版对照，不用重新生成的 AI 图代替真实画面。

## 仍保留的差异与禁止扩大的结论

- Blender 原生 STRAND 的时间/亚像素采样、发丝遮挡与 Three.js 单帧线段绘制不完全相同。当前实验尚未把每一项剩余差异归因定量，采样解释仍属于候选。
- 白毛某些源区域本身也很平浅。应以匹配参考检查内部层次，不能凭网页深色背景下的感受断言所有白色都是过曝。
- atlas 程序织纹的完整烘焙、毛发自阴影与完整 EEVEE BRDF/OCIO 迁移不属于本轮已实现交付。
- 图像数字只证明固定电脑窗口和静止视图；交互保护由下方适用生产回归覆盖，不能把静止对照直接扩大为所有动画帧、浏览器或设备。
- 本轮保留完整的 33 组、2,295,421 根发丝与 19,957,105 源点及现有动画路径，未修改 GLB、发丝或 HDRI 运行资产；实际 draw 数据、资产 SHA 与 diff 证据见长期验证记录。

## 最终生产验证与 Git 交付

以下结果已实际运行并核对日志，均针对 `5b2a307` 基线叠加本轮最终工作区。测试通过证明对应覆盖范围，不消除上文仍存在的细毛质量差异。

| 检查 | 最终记录 |
| --- | --- |
| 核心/资产测试 | `npm test` 78/78 通过，0 fail、0 skip，4279.4317ms；日志 `tmp/lion-fur-final-dering/core-tests.log`。包含最终去振铃数学检查与审查图登记后的资产检查。 |
| 构建 | `npm run build` 336 模块、1.76s 通过；保留既有 Three 分块约538.05kB超过500kB的警告，没有为此升级依赖。 |
| 最终原生截图 | 两页各三视图、前后共12案例通过，错误数组为空；12张原图均已目视，分类和参考误差见上节。正式图版目录 `source/reviews/lion-fur-balance/2026-10-22/` 共10文件，图版7图解码、3个切换按钮、0页面错误、无横向溢出，原生图副本SHA一致。 |
| 电脑浏览器回归 | Chrome生产预览4187，`playwright.preview.config.js` 下实际执行 `hdri-settings`、`view-scene-settings`、`action-theater`、`structure-interaction` 四组，共18/18通过，0失败/跳过/不稳定，235004.938ms。日志 `tmp/lion-fur-final-dering/e2e-production.json`；这不是全工程E2E，也不覆盖其他浏览器、机器或EXE。 |
| 性能与资源 | 固定场景/绘图缓冲下的捕获数据与实际 draw 统计保存在长期验证记录的 `finalNativeCapture`；没有把算法复杂度或静止帧当作真实设备帧率提升证明。 |
| 部署与资产保护 | 133个公共部署资产与dist逐字节一致；清单保留原569条记录，新增9条至578。模型、全部发丝和HDRI原资产保持，正式审查图与运行资产分离。 |
| 工程记忆 | 实际运行 `index --apply` 与 `check --require-ready`：101页、0错误、4条既有历史来源警告；不把历史警告写成本轮新断链。 |
| commit 与 push | 本文关联本任务最终提交；`main` 的 upstream 为 `origin/main`。只提交明确任务路径，保留无关 `model/`。实际提交hash、推送成功与否及交付后状态以最终回复和Git实核为准，此处不预写尚未发生的成功。 |
