# 视角阈值与右下角音量控件

## 需求与边界

2026-10-22用户指定动作最远观看距离3–9m、最近观看距离3–6m、俯视下限0–20°、仰视上限60–90°；要求参考本地Verminoble右下角声音UI，增加“音量”文字、下方简约横滑杆，并补充启声后波浪在固定位置持续向右流动。

E盘main@a379ea0接续，工作树仅原未跟踪model/。开始fetch确认main与origin/main一致；另一远程支线新增2a1f90d只含F盘同步文档，没有产品代码，无需为本任务合并。交付前再次核对upstream，保留其他支线与工作区。

## 实现与设计

- `src/config/viewSettings.js`公开四个指定范围，默认3/9m、1/90°，保留合法初始8.6m取景。旧保存值按新范围限幅；最近/最远交叉时按最后编辑项联动并遵守0.1/0.5m步长。`resolveSettings`、表单、导出与场景共用归一化结果；前轮动作视角仅取消退出/保存继续编辑保留。
- `SoundControl.jsx`使用112×60px透明控件：上方“音量”和小波浪按钮，下方1px细轨道、5px滑块与百分数值。首页贴合首屏右下角，动作沿用正常窗口固定/矮窄窗口随内容布局。640×360等短窗为声音预留独立右侧区域，避免与CTA/中英文叠压。
- 只读参考 `C:/Users/Administrator/Desktop/Verminoble/src/features/experience/SourceSoundControl.tsx` 与 `src/features/experience/r3f/r3f-runtime.css:124–196`：使用其长SVG几何、裁剪窗口、3s cubic-bezier(.19,1,.22,1)波浪滑至尾直线、0.7s交错双描线和0.5s悬停透明度。参考工程没有持续周期动画；本轮额外以完整75.4单位周期和重复波形在1.4s内持续向右流动，窗口保持原地。静音/等待手势/暂停不流动，减少动态禁用动画与过渡。未修改参考工程，未导入其媒体、字体或legacy引擎。
- 默认音量继续25%。独立会话key `nanfeng-lion:media-volume:v1` 和 `:last-nonzero:v1`，原media-audio静音偏好key兼容。非零滑杆值启声、0静音，按钮静音保留音量，零后按钮恢复最近非零值；跨入场/循环/重播/动作切屏/路由/刷新同步。纯非零音量调整不重播、不重载、不换元素。
- 音量外层统一data-sound-control，防止自动手势解锁误抢输入；实际媒体volume在输入栈同步，保留有声被浏览器拒绝后静音继续、真实手势启声、主屏独占和离页/后台停止机制。

## 验证与恢复

Windows PowerShell、Node24.16.0/npm12.0.1/Python3.14.2；生产4196，单worker、trace关闭。用户5173不动，自建preview由本任务回收。

- 最终核心78/78，4472.5142ms；最终构建341模块，1.81s，既有538.05kB Three包提示保留。
- 视角/事务生产20/20（2.0分钟）：action-view-editing、settings-transaction、view-scene-settings、settings-view-source四spec。新增1项四控件范围/旧值/联动/保存刷新；原真实相机限幅和前轮仅取消退出完整复核。
- 声音/布局最终49/49（2.7分钟），命令为 `PLAYWRIGHT_PREVIEW_PORT=4196 npx playwright test --config tmp/action-view-preview.config.mjs` 加home-audio-wave、home-audio-line、home-audio-line-policy、media-volume、video-audio、action-player、home-desktop-layout、chapters-desktop-layout八spec，排除手机。临时配置继承preview、testDir指向原测试目录并关闭trace；含11项新版声音/音量专项，实际采样持续右行/回绕、静音平线、鼠标键盘与原生媒体行为。
- 首轮声音/布局46/49（3.3分钟），修正了动作解读框与新60px控件重叠、动作通用SVG/hover样式覆盖控件；正向播放器夹具显式允许自动播放，严格原生阻止测试仍独立运行；减少动态夹具改为实际无过渡且兼容全局!important 0.01ms。一次launchOptions放describe的收集错误未执行任何案例，已移到该播放器spec顶层。
- 交叉审查补获≤1100非紧凑动作解读框可能同时top+bottom拉伸，新增底距限定到>1100容器；最终定向2/2（20.8秒）复核，新增900×700/1100×800按内容高度检查。初次定向1/2只因夹具把CSSOM已解析的auto期待成字符串，改为保留实际高度几何断言后通过，无产品回退。生产共69个不同案例分批通过，追加2项针对最终CSS范围修正复测。
- 独立实际原生Chrome审查：25→26不新增play，零值/刷新后恢复26%，动作继承且仅主屏有声；后台toggle不会恢复隐藏媒体。严格document-user-activation-required、CDP userGesture:false初始未激活/静音推进/awaiting-gesture，实际滑杆从0→1%与按钮恢复均成功且推进，0页面错误。
- 原生QA首轮确认640短窗文字与新控件叠压，已留独立右区并重采；截图脚本首轮init漏top-window guard导致sandbox Storage错误，修夹具后0pageerror，不为夹具改产品。最终9张生产图已逐张查看，附capture.json，原651条资产清单逐字段保持，新增10条至661；141份运行文件与dist SHA256一致。
- 两位Agent交叉静态审查通过，未发现剩余代码问题；当前不声称全仓库E2E、其他浏览器/设备或真实音频振幅分析通过。

完整阶段结果和范围见[验证JSON](view-volume-2026-10-22-validation.json)。工程记忆已同步，实际index --apply/check --require-ready通过：111页、0错误、4条既有历史来源提示。任务4196已停止，原5173保留。最终diff核对后按根AGENTS提交推送任务路径；最终revision及push以所属提交和实际upstream核对。
