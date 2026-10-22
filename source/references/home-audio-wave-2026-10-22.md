# 首页声波动效与最新GitHub同步

## 用户要求与范围

用户于2026-10-22明确要求播放声音时白色波浪线能像声波一样运动，并把最新GitHub lion更新到 `F:/数媒竞赛/信息可视化codex`。在原 `codex/home-audio-line-2026-10-22@3ed2999` 支线上续改，保留无底色/无文字白线、静音直线、25%音量和既有自动播放/真实手势恢复。

Agent选择CSS几何形变作为播放指示，不进行真实振幅/节拍分析，不新增WebAudio、计时器、应用层RAF、依赖或运行图片。只对line变体的enabled状态循环1.1s；静音和等待手势时移除动画，减少动态时保留静态有声波浪。后台/离页继续复用原视频状态与按钮卸载。动作标准声音按钮不变。

## Git整合与保留内容

开始时跟踪文件及暂存区干净，仅已有 `.superpowers/` 未跟踪；F盘当前支线本地/远端同为3ed2999。fetch发现远端main新增 `cb89450fefe0cd81355ca43ea7e78eaf0d893d04` 动作导航实时背景修复，与当前支线各有1个独立提交。普通merge将最新main接入当前支线，产品路径自动合并；五份当前状态页的冲突逐节保留双方来源和模块事实，待办按当前续改重新归纳，不整页选ours/theirs。

`action-theater.css`、`actionTheaterScene.js` 和新导航背景回归保持cb89450原样。原媒体、完整模型/毛发、灯光、其他章节和依赖未因动效改写，不操作E/C工作区、EXE或main分支引用；只普通提交和推送当前支线，不强推、不删除分支、不创建PR。提交及远端SHA据最终Git实核，不预记成功。

收尾发现并发工作新增 `src/App.jsx` 的SiteBgm挂载、`src/features/audio/SiteBgm.jsx`、`src/services/siteBgmEngine.js`；这些修改不属于本任务，保留原地但未暂存/提交。下列构建及浏览器通过数针对此前已验证的动效+上游组合，不代表该未提交背景音乐工作已经验收。逐帧JSON通过精确路径 `.gitattributes -text` 保留LF原字节，避免Windows换行转换破坏其清单哈希。

## 实际验证

- 先补真实几何测试，静态基线预期失败：220ms采样只有1种路径，要求大于2。实现后同项通过，另核实静音计算几何高度小于0.01、无活动动画，而不只检查DOM属性。
- `npm test` 79/79（5887.0951ms）；`npm run build` 341模块、2.48s。保留既有Three约538kB块提示。
- Chrome开发5235相关13/13（3.1分钟）、生产4243相关13/13（3.1分钟）通过；最终审查补充静音几何断言后生产动效专项再验1/1（12.8秒总运行）。本轮测试包含动效、原白线五种电脑尺寸/设置push、原生策略、迟到play确认、intro自然结束/循环、静音/重播、首页动作往返、最新动作导航实时背景/顶栏高度/全屏/设置推开。
- 测试通过真实RAF采样渲染后的CSS路径；正式生产证据在220.8ms内采到52个不同路径，证明连续形变。静音与减少动态的路径采样稳定、活动动画数0；模拟document.hidden与visibilitychange验证应用后台分支，未将其称为真实OS Alt+Tab验收。离页保留旧路径节点验证已断开且动画数0。
- 核实141份public/dist原字节一致。合并后630份既有清单记录保留，追加4个审查文件至634；没有新增运行资产。
- 独立只读审查0 Critical/0 Important；两个Minor已处理：补静音实际几何断言，当前架构/来源补记动效阶段，原静态记录保留为历史。
- 证据登记后再跑核心79/79（5041.8834ms）；记忆index后require-ready检查106页、0错误、4条既有历史来源缺失提示；工作区diff空白检查通过。收尾fetch仍为main@cb89450，无新上游提交，未将本地引用当作远端实核结果。
- 实际命令为 `npx playwright test --config tmp/home-audio-line-2026-10-22/playwright.dev.config.mjs` 及对应preview配置，指定 `home-audio-wave`、`home-audio-line`、`home-audio-line-policy`、`video-audio`、`home-video-replacement`、`action-theater-integrated`、`action-navigation-backdrop` 七个spec。普通允许分支使用测试专属autoplay许可，严格分支独立启动原生拒绝策略Chrome并trace off/CDP无手势观察，产品不包含测试flag。

## 审查证据

[首页实际截图](../reviews/home-audio-wave/2026-10-22/home-animated-wave.png)、[形变帧A](../reviews/home-audio-wave/2026-10-22/wave-phase-a.png)、[形变帧B](../reviews/home-audio-wave/2026-10-22/wave-phase-b.png)、[真实逐帧路径](../reviews/home-audio-wave/2026-10-22/actual-wave-frames.json)。整屏和阶段截图已查看；静态图片只代表时刻，连续性由逐帧数据和运行断言证明。临时配置/截图输出保留在ignored tmp，不推送。

仅电脑Chrome156本机相关子集验收，不代表全工程E2E、其他浏览器/硬件、手机、物理扬声器响度或EXE已验收。CSS路径插值不支持的浏览器仍保留SVG静态图形，不承诺该范围的动态兼容。
