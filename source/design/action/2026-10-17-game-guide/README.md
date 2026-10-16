# 动作导览角色：原包归档与离线预渲染

核实日期：2026-10-17。工作区：`F:/数媒竞赛/信息可视化codex`，素材任务起点 `main@74add54ee0dbbc3fab20ea89e39ae6f14db9e4a2`。这是并行开发中的独立素材交付；UI、媒体配置、正式资产清单、wiki、提交与推送由主 Agent 合并处理。

角色来自用户 ZIP 的现有醒狮套装骨架动画，是游戏式导览装饰，不是真实醒狮动作样本，也不提供新的动作研究数据。未生成替代角色或修改骨架。

## 原始来源与归档

- 用户输入：`F:/数媒竞赛/adam_醒狮替换包_v2 (2)(1).zip`。
- 完整原字节归档：本目录 `adam-lion-v2-original.zip`，758846 bytes。
- ZIP SHA-256：`eb10f5e1e2c5b97ab038c5dbadce24809349af966bbe8ef6d32de36264efc44c`。
- ZIP 含 `adam.skel`、`adam.atlas`、`adam.png`、`adam.spine`、PNG 分件与用户原 metadata，没有完整导览 UI。
- 骨架实际读取版本 `3.6.53`，58 bones、54 slots、15 animations。原文件及全部分件保留于归档，不进入网页 public 目录。

| 原文件 | bytes | SHA-256 |
| --- | ---: | --- |
| adam.skel | 47944 | 827f077a6c9d63df85c4b4121d3cb29ed40fccfa63627e05ceca6cc4569411dd |
| adam.atlas | 3962 | 46d7629df10a0fc9cd6a90e6e6349c1bfbc001c4c23e9b2b464538d78c1a6130 |
| adam.png | 390748 | 3cded822ef80168bb0c7fde6cec15895351585fe007d7a8241d37027dcce4278 |
| adam.spine | 34211 | 7130bfc262e0b449aaa14bdf65a29a720da36b3a85a75707ccceaf47e120f22d |

## 内部工具与许可边界

本地工具执行固定提交的未修改构建：[spine-canvas.js](https://raw.githubusercontent.com/esterTion/spine-runtimes/8d79291441394b3a279d5d36f054d563dbc15e16/spine-ts/build/spine-canvas.js)。该 fork 提供读取此二进制所需的 `SkeletonBinary`。仅缓存到 Git 忽略的 `tmp/action-guide-renderer/spine-canvas.js`，工具读取并校验原字节；没有修改或随项目分发该 runtime，也没有新增 npm 依赖。

- runtime SHA-256：`c626474dc3af7840cde499cd07f38f6d104606954293994c7fcd85401000cd70`。
- [同提交许可原文](https://raw.githubusercontent.com/esterTion/spine-runtimes/8d79291441394b3a279d5d36f054d563dbc15e16/spine-ts/LICENSE)：Spine Runtimes Software License v2.5。
- LICENSE SHA-256：`d2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5`，原文随 runtime 留在同一内部缓存。
- 本任务按已确认边界，仅用于个人/内部离线渲染。许可对修改、衍生开发和分发另有约束；本工具不提供项目角色或 runtime 的公开再许可结论。
- 网页只消费派生 PNG，不能导入本脚本，不能将缓存 runtime、原骨架或源工程复制到 `source/public/`、`dist/` 或任何网页依赖中。
- 浏览器渲染时阻断全部网络请求，原图与骨架通过内存传入；下载缓存只发生于首次准备且只取固定来源。

## 运行素材与帧读取

| 文件（位于 source/public/assets/action-guide/） | frames | columns | rows | fps | seconds | cell | atlas |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| adam-idle.png | 20 | 8 | 3 | 24 | 0.8333333333333334 | 256×256 | 2048×768 |
| adam-move.png | 12 | 8 | 2 | 24 | 0.5 | 256×256 | 2048×512 |
| adam-poster.png | 1 | 1 | 1 | 静态 | — | 256×256 | 256×256 |

idle 源时长 `0.8333333134651184s`，mov 源时长 `0.5s`；以 `t = frame / 24` 采样，排除重复的末端闭环帧。图集按行排列，帧 `i` 的像素矩形为 `x = (i % 8) * 256`、`y = floor(i / 8) * 256`、`width = height = 256`。只循环 `0..frames-1`；末行剩余4格透明。CSS 按实际展示 cell 尺寸同步缩放整幅背景，并用上述行列计算位置；不能直接让 steps(frames) 跨整张多行图集移动。

两段动画使用同一个固定缩放和中心，不按帧重新裁切或居中。用两段动画120fps密集采样（含端点）的几何 union bounds 计算一次变换：`minX=-260.18820834755604, minY=-25.464299495528124, maxX=222.91348829270032, maxY=398.2423184612428`；`scale=0.471950319333656`。cell 256，预留14px几何边距，保留披风和双脚。动画固有姿态移动保留，不添加自动跟踪或人为归中。

渲染后每帧再次检查 alpha 边界。实际 idle 像素 union 为 `x40..219, y51..217`；mov 为 `x21..237, y35..225`。全部32帧边缘像素数为0；这些实测范围不是二次裁切参数。

角色 slot 采用明确保留名单（19个）：`cape, thigh_left, foot_left, thigh_right, foot_right, skirt, hip_lower, arm_left, neck_deco, body, shoulder_left, face, hip_mid, neck, eye, arm_right, shoulder_right, hand_right, hand_left`。每次应用动画后隐藏其余35个 slot，包括原包拼错的 `sowrd_left` 及其编号变体、sword、shield、point、ads、ad、floor 和 shadow；不改原 skel。

## 可复现命令

在工程根目录执行，使用已有 `playwright` 与已安装的 Chromium，不安装新 npm 包：

```powershell
# 首次准备，校验并原字节归档用户ZIP；--probe只在tmp生成测试图，不发布运行PNG。
node scripts/render-action-guide.mjs --probe --zip 'F:/数媒竞赛/adam_醒狮替换包_v2 (2)(1).zip'

# 正式生成：归档ZIP已在本工程内，后续无需用户原路径。
node scripts/render-action-guide.mjs

# 独立读回PNG检查；不加载Spine runtime，也不写文件。
node scripts/render-action-guide.mjs --verify
```

首次取 runtime/LICENSE 需要网络；缓存已就绪后的渲染离线执行。工具路径基于脚本自身定位，ZIP 解压采用 Windows PowerShell/.NET 标准库。脚本 SHA 校验固定原包与 runtime；若内容不符直接失败。删掉整个 `tmp/` 后可从本目录归档和固定下载源重建；本任务没有删除用户缓存。

## 证据与主 Agent 接入

- `render-metadata.json` 保存原 ZIP/runtime/许可证和四个原文件哈希、全部 slot/动画名、帧尺寸/帧时间/alpha测量、浏览器版本与输出 PNG 哈希。此文件属于设计/制作记录，不随网页部署。
- `manifest-suggestions.json` 包含3张运行PNG、完整ZIP和接触表的 `from/path/bytes/sha256` 共5项，可由主 Agent 按现有格式追加到正式 `source/asset-manifest.json`；本子任务没有改正式清单。
- 放大审查接触表：`source/reviews/action/2026-10-17-game-guide/adam-contact-sheet.png`，2560×1520，单帧以320×320显示，32帧全部可见。
- 实际渲染：Windows / Chromium `156.0.8078.4` / Canvas2D `triangleRendering=true`；32帧非空、透明cell边缘无触边，未用WebGL或Spine Editor。
- 验证独立解码派生PNG，检查图集尺寸、全部32帧透明边缘与帧内容变化、8个未用格全透明、poster与idle第0帧逐像素一致、归档及PNG哈希；`--verify` 不载入 runtime。
- 本轮已执行 `node scripts/render-action-guide.mjs --verify`，exit 0：idle 20/20 distinct、mov 12/12 distinct，全部32帧 `edgePixels=0`，8个未用格透明，poster逐像素相等；5项文件哈希一致。之后完整重渲染并与重渲染前5项SHA比较，全部一致，再次独立验证exit 0。`node --check scripts/render-action-guide.mjs` 和 `git diff --check` 通过。
- 同一环境重跑哈希用于验证可复现性；跨Chromium版本的PNG编码与抗锯齿可能变化，应重跑像素审查并记录新来源，不能自动改旧哈希掩盖素材变化。
- 验证范围是原资产读取与内部预渲染，不是 Spine Editor、游戏最终验收或动作导览 UI、最终网页构建/交互验收。最终页面动画节奏、状态切换、方向翻转、减少动态/失败回退由主 Agent 验证。
