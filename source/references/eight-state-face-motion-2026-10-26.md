# 八态三秒五官分层动作验收

2026-10-26，用户认可惊态三秒动作后明确要求“其他七个也要按照这样来设计”。基于 `codex/lion-motion-breathing-2026-10-26@5f2005014802713950a919a84be1c6b4fa1637cb` 完成喜、怒、哀、乐、动、静、疑七态扩展。惊态保留原轮廓和动作参数。原工程目录中其它分支/未提交任务没有纳入；本轮未合并 main。

## 实际行为与范围

八态点击主狮头、提示按钮或使用Enter/Space，均启动各自左右眉、左右眼、狮口五个独立原生动画，同时打开原来的详细解读。每片 `duration=3000-delay`，统一在3秒结束；展开、停留、轻回收、再次回应、自然复位。重复点击重新播放；切态、对照、离章首帧、后台、减少动态与卸载取消，结束和失败回退使用完整原IMG。

| 神态 | 设计差异 |
| --- | --- |
| 喜 | 眉轻扬、双眼微收，嘴角小幅开合，较温和 |
| 怒 | 双眉内收下压、眼高收窄、下颌轻收，较紧绷 |
| 哀 | 垂眉敛目、轻收原闭口唇缝；不虚构张口或牙齿 |
| 乐 | 抬眉展目、下颌舒展，幅度较喜态更明显 |
| 动 | 眉上提，目光先顾盼后回应，狮口沿原朝向轻开 |
| 静 | 较慢凝目微收、小幅眉口变化，保持克制 |
| 惊 | 沿用已认可的眉先抬、眼再展开、口微张及原幅度 |
| 疑 | 一眉挑起、一眉微压，双眼试探后反向回望，口沿倾斜方向轻动 |

上述均为AI辅助视觉演绎，页面保留定性观察与待真实样本校核标注，未宣称是测量得到的狮艺动作。结构拆解、版面呼吸感、React Bits、液态变形不在本任务内。主视觉、文字、目录尺寸及章节墨迹转场沿用原版。

## 源文件和资产

`ExpressionLion.jsx` 提取原惊态的共享解码、播放和取消逻辑，独立 `face-profiles/{front,poses,surprise}.js` 提供每张1254原图的专属轮廓、枢轴、时序、峰值和回收变换，`ExpressionPage.faceRevision` 驱动全部八态。进入/切态的整图短动作仍由 `useExpressionReaction` 维护；主狮头点击先取消它，再播放五官，保留原可调点击放大和解读。`SurpriseLion.jsx` 保留兼容导出，惊态保留原专项选择器。

新增7张对应透明隐藏补绘，只有移动后露出的窗口使用补绘；所有移动部件及静态主体继续使用各自原图像素。原图8张原字节保留，无新npm依赖。原输出、完整提示词、尺寸和最终SHA见[素材源记录](../design/expression-eight/README.md)。评审资产留在source/reviews，无截图/设计稿混入public。

## 视觉复查和修订

逐图检查原图与真实Chrome渲染：1920×1080、1440×900，各态静止、900/1680/2250/2850ms，含首次峰值、回收、第二次回应和近复位。归档8张1920峰值、2张1440整页与两桌面完整矩阵/几何，额外中间帧为ignored临时输出。

- 喜：第一次生成底图的宽上牙弧在下颌下移后暴露；使用imagegen第二次仅修隐藏口腔，清掉补绘牙弧，保留原图窄中央上牙。
- 哀：压眉导致白毛根部露出细红金弧；增加一条窄原图前景遮挡固定眉根，眼侧下缘仍随部件运动。
- 共享软蒙版：原静态层羽化1.3px、底层硬裁切导致轮廓外透出页面形成细白缝。补绘改用外扩4px的白蒙版覆盖羽化边，原图静态层遮住其余扩展部分；乐态内口白线最终消除。
- 两组轮廓分别经独立复核；修订后的喜/乐牙线、哀眉根及倾斜态连接再次查看通过，未发现所检帧中的产品阻断。
- 原惊态生产几何与本次比较，1920和1440的主狮头、文字面板、左目录矩形逐项相同；捕获中16个神态/视口组合均无pageerror和横向溢出。

## 实跑验证

Windows / Node24.20.0 / Chrome156.0.8078.47，生产预览4196：

- 生产构建362模块通过；已有Three538.05kB包体提示保留。
- 新增20条专项曾完整通过，两桌面覆盖全部八态5部位原生computed矩阵、8种不同动作签名、3000ms结束、几何/原IMG复位；每态分别覆盖快速重播、减少动态、对照、切态、离章与补绘失败；全部八态提示按钮和键盘激活。
- 视觉修订后最终37/37生产回归全部通过（3.3分钟、exit0）：新增八态20、原惊态6、整图3、标题/文字3、点击反馈5。
- 自然播放不暂停、不改时间，真实RAF记录首次停留、第二次回应、末段及自动复位；最终154帧、3016.889ms、playing=false，证据SHA为 `f7b433007d7704cfcfac8b9b4f4c2765915b644a670700d6d4497e2d641db07d`。本机记录不当作实体GPU性能基准。
- 资产核心78/78，清单814项（新增19项、旧795项原记录未改）；150份运行资产与dist逐字节SHA一致，8张原图与HEAD原字节一致；工程记忆132页、0错误、4条既有历史来源提示。最终Git结果按交付前实际核对。
- 独立只读代码审查：配置各5部位、递增timing/delay、8张1254底图、取消/解码/重建边界均通过，未发现阻断。

初次八态测试在原惊态版本上正确失败，先确立通用rig行为契约。首轮绿色阶段发现assertOriginal立即检查既有220ms悬停CSS回收，测试调整为移开鼠标并等待transform恢复none；未降低部件运动、时长、图像或尺寸阈值。视觉修订属于上文3项真实问题，无改写历史清单或截图掩盖失败。

实际主要命令：

```powershell
npm run build
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:PLAYWRIGHT_PREVIEW_PORT='4196'
npx playwright test --config playwright.preview.config.js tests/e2e/expression-eight-face.spec.js tests/e2e/expression-surprise-face.spec.js tests/e2e/expression-reactions.spec.js tests/e2e/expression-motion.spec.js tests/e2e/expression-click-feedback.spec.js --workers=1 --output=tmp/eight-face-final-verified
node tmp/capture-eight-face.mjs
npm test
python wiki_memory/工具/memory.py index --project . --memory-dir wiki_memory --apply
python wiki_memory/工具/memory.py check --project . --memory-dir wiki_memory --require-ready
```

证据：[峰值与整页](../reviews/eight-face/2026-10-26/)、[两桌面实际矩阵与几何](../reviews/eight-face/2026-10-26/capture.json)、[真实自然播放](../reviews/eight-face/2026-10-26/joy-natural-playback.json)。Git交付按本记录所属提交及最终upstream核对。未重跑全仓E2E、其他浏览器或手机，未重新打包EXE。
