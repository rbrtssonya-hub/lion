# 当前醒狮：结blend.blend 完整数据接入（2026-10-20）

用户要求用指定的 `结blend.blend` 替换网页醒狮，并明确禁止擅自删改模型数据，特别是毛发。结构页和动作剧场都使用同一个新源资产；首页视频、神态图片、网页布局及剧场建筑保持原有行为。

## 源文件保护与导出

原文件为 136,543,222 B，SHA256 `dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770`。本地原字节副本为 `source/models/user-lion-2026-10-20.blend`，不调用 Blender 保存，导出前后核对原件和副本 SHA。此单文件超过普通 GitHub 文件上限，精确路径被 Git 忽略；资产清单将其标记为唯一 `localOnly` 源文件。GitHub 保存完整运行派生数据、脚本、清单和审计报告。

使用官方便携 Blender 5.1.2（`ec6e62d40fa9`），匹配源文件 5.1；不使用会提示数据丢失的本机旧版 5.0。便携工具位于 ignored `tmp/blender-portable/`，不更改用户安装。命令：

```powershell
& '<Blender 5.1.2>/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/export_full_lion.py -- --input '<用户指定的结blend.blend>'
```

旧 `export_lion_structure.py` 的抽发、减面、去重和修补流程不用于当前模型；仅复用修正 glTF Sheen Tint × 源 Sheen Weight 的独立函数，纠正导出器忽略权重的问题，不改源材质。

53 个网格、49 个辅助层级全部导出，共 102 个节点；不减面、不去重、不量化、不重新压缩贴图、不主动修复网格。显式阻止导出器自动 `Mesh.validate()` 清理，原有退化面也保留，导出总计与源 evaluated mesh 的 657,831 三角一致。旧运行 GLB 原字节归档在 `source/models/lion-structure-before-2026-10-20.glb`；旧报告、说明以 `lion-structure-model-before-2026-10-20.*` 归档。

运行资产由 `src/config/assetPaths.js` / `media.js` 集中配置：`lion-user-full.glb`、`lion-user-hair.json` 和 33 个 `lion-user-hair-NN.bin.gz`。毛发 gzip 无损压缩，不量化 Float32；每文件含全部中心点和半径，粒子组另含各发束根部 UV。清单记录压缩及还原 SHA256、数量、边界、源材质。浏览器兼容服务器自动 HTTP gzip 解压和普通二进制响应，两条路径都严格校验还原内容。

## 毛发与原始显示方式

原场景是 EEVEE，`hair_type=STRAND`、`hair_subdiv=0`。网页按此设置绘制细发丝，没有为性能抽发、减点或隐藏组。

| 来源 | 组数 | 可见发束 | 保存的控制/渲染点 |
| --- | ---: | ---: | ---: |
| CURVES | 3 | 175,421 | 877,105 |
| 粒子毛发 | 30 | 2,120,000 | 19,080,000 |
| 合计 | 33 | 2,295,421 | 19,957,105 |

三组 CURVES 各 99,854 / 35,567 / 40,000 根，每根原始 5 点全部保留。源缺省属性按 EEVEE 解释为半径 0.01、均匀 Catmull-Rom（tension 0.5）、端点重复和每源段 12 分段；5 原始点生成 49 显示点。源 STRAND 模式不按半径扩宽，但逻辑半径仍保存。

30 个粒子系统均有 1,000 根父引导发，子发倍率按各自源设置为 50 / 70 / 150。原场景 `use_parent_particles=false` 且有子发时仅显示全部子发，不额外重复显示父引导发；引导发保存在原件，逐组控制键 SHA 写入报告。导出按原 `render_step=3` 保留每根子发全部 9 个路径点、根部 UV 和 taper 半径，不将共享 settings 的不同发组去重。

源实现依据：[Curves 默认值](https://github.com/blender/blender/blob/v5.1.2/source/blender/blenkernel/intern/curves_geometry.cc)、[EEVEE 曲线插值](https://github.com/blender/blender/blob/v5.1.2/source/blender/draw/intern/shaders/draw_curves_interpolation_comp.glsl)、[STRAND 模式](https://github.com/blender/blender/blob/v5.1.2/source/blender/draw/intern/draw_hair.cc)、[粒子路径与子发](https://github.com/blender/blender/blob/v5.1.2/source/blender/blenkernel/intern/particle.cc)。

## 网页渲染与资源

`lionFullHair.js` 使用实例化线段，两章共享 CPU 几何、纹理和毛发，各自层级和材质参数独立；每个 WebGL context 仍持有自己的 GPU 缓冲。最后消费者释放资源，取消载入时回收请求及部分数据。结构毛发参与完整取景，网格 BVH 负责真实表面拾取；保留六部件聚焦、自动旋转及离页暂停。

网页使用 Three.js 灯光和材质渲染，不能宣称与 Blender 像素一致或具备完整纸扎内构。2026-10-20后续照明审核已修复两章环境构造漏传renderer造成的明暗异常，使用与源相同的AgX类别色调映射、曝光1和均衡主辅光；Three实现并不等同于Blender OCIO逐像素输出，详见[照明审核](lion-lighting-2026-10-20.md)。此修复不修改GLB、毛发数据或毛发着色器。两个 atlas 源灰度 Bump 被 glTF 错误导成 normalTexture；运行材质按源 Strength 0.07 × Distance 0.00065 将同一纹理作为高度使用，保留源纹理、网格及原件。Wave 节点程序细节不属于 glTF 原生表达，显示差异如实保留。

完整运行模型和毛发约 313 MB，比旧 LOD 大，源数据完整性优先。实际加载、绘制和电脑回归见本次验证记录，不沿用旧 55 万三角预算或旧性能数字。

## 审计与验证

独立核对可由 Blender 执行 `--background --factory-startup --python-exit-code 1 --python scripts/verify_full_lion_source.py -- --original <原始结blend.blend>`，默认只写 ignored tmp 中的 JSON 报告，不调用导出器或保存 `.blend`。

- `source/references/lion-structure-model.json`：导出设置、源网格/毛发计数、逐组 SHA、原件不变与材质权重。
- `source/references/lion-full-model-2026-10-20-validation.json`：本次实际验证汇总。
- `tests/assets/asset-integrity.test.mjs`：全部文件 SHA、毛发点/半径、UV、33组数量、网格和索引；本地原字节副本存在时必须核对 SHA。
- canvas 的 `fullHairStrands/Groups/Points` 是加载数量，`fullHairDrawn*` 和 `renderLines` 是本帧实际提交绘制数量，区分加载完成与实际绘制。
