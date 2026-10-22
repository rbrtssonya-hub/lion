# 首页白色线条声音开关

## 授权、基线与最终实现

2026-10-22，用户批准参考图并要求继续执行：移除首页声音提示框及左上角旧声音按钮，右下角只显示白色线条，有声为波浪、静音为直线，音量保持25%。不将整张参考图用作网页资产。

实施唯一位置为 `F:/数媒竞赛/信息可视化codex`，从 `main@53aca57` 建立 `codex/home-audio-line-2026-10-22`。任务期间 `origin/main` 新增 `d2e82ae` 和 `9346040`，包含共享声音控制、原生自动播放恢复、神态书法/动效和结构目录。先用显式路径stash保全初版实验，再将任务支线快进到 `9346040`；没有修改其他工作区、回退上游或强制推送。初版播放器替代方案没有重叠接入，最终复用上游控制器和共享偏好。

- `SoundControl.jsx` 增加可选 `variant="line"`，仍为真实button，保留无障碍名称、pressed状态及原事件协议。线条为轻量内联SVG，不加载图片、不采样音频。
- `sound-control.css` 仅为线条变体去除底色、边框、阴影、背景模糊和文本。白线静态显示，不引入动画循环；键盘操作时保留细白焦点轮廓。
- `HomePage.jsx` 将首页开关放入hero右下角，随首页首屏自然滚走，不覆盖下方书册；宽屏、窄电脑窗口和设置推开时相对hero定位。
- `VideoStage`、共享音频偏好、动作播放器和现有标准声音按钮保持 `9346040` 原样。声音默认尝试25%播放；浏览器原生阻止时视频静音推进、无声音提示框，真实手势恢复声音。手动静音跨入场/循环/重播及页面往返保留。真实网络错误和准备超时仍显示重试/继续，不隐藏故障。

## 验证

先写失败测试，再实现；初版及接续上游后均实际观察到旧按钮不满足线条class的预期失败。初版检查和截图不替代最终上游组合验收。

最终基线为 `9346040` 加本任务：

- `npm test`：79/79；`npm run build`：341模块，通过；保留既有Three块超过500kB的提示。
- Chrome开发版5235相关回归13/13，通过。覆盖5种电脑尺寸、设置push、透明/白线、键盘与减少动态、快速切换、自然intro→loop、重播/跳过、后台/离页、首页/动作无双声、失败重试、25秒准备超时、迟到play确认、原生严格策略下三种首次手势及动作主屏发声。
- 生产4243相同组合13/13，通过；标准 `playwright.preview.config.js`、Chrome通道、4244端口的新增严格策略3/3，通过，确认不依赖临时配置的trace off。测试基于Windows、Node24.20.0、npm11.19.0、Chrome156.0.8078.47。
- 141份public/dist原字节一致；本任务未改任何运行媒体或模型。623份上游清单原记录保持，追加4张已查看的实际生产截图至627份。截图不进入public或dist。
- 正式截图：[1920有声](../reviews/home-audio-line/2026-10-22/audible-1920.png)、[白线近景](../reviews/home-audio-line/2026-10-22/audible-detail.png)、[900静音](../reviews/home-audio-line/2026-10-22/muted-900.png)、[1366设置推开](../reviews/home-audio-line/2026-10-22/pushed-settings-1366.png)。已查看整屏有声与静音图，无默认焦点框、提示框、药丸或额外文字。
- Git提交、普通支线推送及远端HEAD以所属提交和最终实际检查为准；不将未执行推送预记为成功。
- 截图登记后再跑 `npm test`：79/79（5087.8783ms）；`npm run memory:index` 后 `npm run memory:check -- --require-ready`：104页、0错误、4条已有历史源文件缺失提示；`git diff --check`通过。两轮索引/验证均不改运行资产。
- 严格策略通过CDP `userGesture:false` 验证未激活状态，文件内关闭trace，避免Playwright快照赋予用户激活；这不绕过或修改产品浏览器策略。
- 独立只读审查未发现产品回归；提出的新严格策略spec需文件内关闭trace已采纳。白线是声音状态开关，不是实时音量/缓冲测量仪。

浏览器命令使用临时配置 `tmp/home-audio-line-2026-10-22/playwright.dev.config.mjs` / `playwright.preview.config.mjs`，仅普通允许分支配置 `--autoplay-policy=no-user-gesture-required`；严格分支自己启动原生拒绝策略Chrome，不能复用允许上下文。实际13项来自 `home-audio-line.spec.js`、`home-audio-line-policy.spec.js`、`video-audio.spec.js`、`home-video-replacement.spec.js`、`action-theater-integrated.spec.js`，另选 `app.spec.js` 首页失败与 `startup-loading.spec.js` 当前首页首帧超时。标准配置另跑新增policy文件三项。临时配置、结果和追踪不提交。

## 边界与恢复

不改运行媒体、模型、全量毛发、灯光/HDRI、依赖、书页引擎、EXE或主线引用。不宣称未交互时可绕过所有浏览器的有声自动播放限制，不代表物理扬声器/其他设备/全工程E2E已验证。仅普通提交并推送当前支线，不自动合main或创建PR。

接续上游时Git自动maintenance因F盘空间不足生成失败临时pack；已核对无Git进程，仅将本次产生的 `tmp_pack_MU2Okz`（600,309,760字节）可恢复移至 `C:/Users/ALLEN/AppData/Local/Temp/lion-audio-recovery-2026-10-22/`，未删除工程或素材。用户随后释放空间，实际复核F盘剩余98,543,697,920字节。失败/中间测试保留tmp或C盘同名临时目录，不纳入部署和提交；旧实验stash保留，不自动pop覆盖新基线。
