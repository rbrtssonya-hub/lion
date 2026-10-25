# 醒狮双小游戏独立试玩实施计划

> 执行：并行完成独立游戏逻辑，主执行者完成角色、共享舞台、交互壳与整体验收。用户已于 2026-10-26 要求完成两个独立小游戏，并选择“国潮手绘＋轻立体”IP 风格。

**目标：** 提供可直接打开的两款电脑端小游戏和原创醒狮 IP，供用户先看效果。

**架构：** 所有文件隔离在 `source/design/lion-mini-games/`，不进入 `src/`、`source/public/`、网站路由或资产配置。原生 HTML/CSS/Canvas/Web Audio，无新增依赖，经典脚本支持直接打开 HTML。

## 设计约定

- 原创角色工作名“阿南”：国潮手绘、清晰轮廓、轻立体明暗；朱红、米白、少量金色；保留圆眼、浓眉、额镜、宽口与狮被。角色图像为 AI 辅助原创设计。
- 两款游戏均有明确开始、过程、暂停、结束、重玩和返回；鼠标与键盘都可完成；窗口失焦暂停；声音由用户主动开关。
- 鼓点采青：看光圈跟鼓点，击中产生鼓面、角色和舞台反馈，约 25 秒一局。统计为互动命中结果。
- 梅花桩：显示下一落点与蓄力提示，按住空格/鼠标蓄力、松开起跳，完成五次落点；失误返回最近桩位。提供方向键细调蓄力区目标，不依赖精密三维模型。
- 游戏动作和节拍是创意演绎；不呈现为真实传统套路、正式赛事评分或真实表演数据。
- 舞台采用深朱红、暖金聚光、浅纸色文字；大号中文引导和明确按钮，优先 1366×768、1920×1080。

## 文件与接口

- `index.html` / `styles.css`：菜单、舞台、HUD、暂停与结算界面。
- `shared.js`：`window.LionArcade.art` 共用舞台绘制和角色图集；`sound(kind)` 提供鼓点等反馈。
- `rhythm.js` / `poles.js`：分别注册 `window.LionArcade.games.<id>.create({onComplete,onHUD,sound,art})`。
- 游戏实例：`update(dt)`、`draw(ctx,w,h)`、`keydown(code)`、`keyup(code)`、`pointerdown(point)`、`pointerup(point)`、`destroy()`。舞台逻辑尺寸 1400×760；`dt` 单位秒。
- `art.lion(ctx,x,footY,width,{pose,flip,tilt,stretchX,stretchY,alpha})`，pose 为 idle/crouch/jump/land。
- `art.backdrop(ctx,w,h,{mode,time,progress})`、`art.text(ctx,text,x,y,size,color,align)`、`art.roundRect(ctx,x,y,w,h,r,fill,stroke)`。
- HUD：`onHUD({phase,progress,primary,secondary,combo,hint})`。
- 结算：`onComplete({title,rank,score,subtitle,stats:[{label,value}]})`。
- `app.js`：单动画循环、输入映射、图像就绪、暂停/恢复、声音、结果、可读状态与销毁。
- `assets/`：原始生成的 IP 图片与动作图集，保留生成说明；`README.md`：独立启动和控制说明。

## 执行清单

- [x] 创作同一角色的单体立绘、四姿态透明图集，并检查醒狮特征和动作辨识度。
- [x] 完成节奏游戏：正常命中、早晚失误、连击、自然结算与12拍收青。
- [x] 完成踩桩游戏：蓄力、飞行、精准/普通落点、失误恢复、自然结算。
- [x] 完成独立菜单、共享舞台、音效、输入、暂停、重玩与结果。
- [x] 浏览器验收两个真实游玩流程，覆盖切回菜单、暂停后恢复、窗口切走、静音、文件直接打开和两个桌面尺寸。27项、14图通过。
- [x] 审查截图、控制台、语法、网站构建，更新工程记忆。核心/资产78/78、354模块构建通过；交付前审查diff并只提交本任务路径，Git结果以最终输出为准。

## 验收重点

输入持续按住时不能反复触发节奏命中；踩桩松键在暂停期间不应导致自动跳跃；菜单/重玩应释放旧游戏状态；缺失音频权限时视觉提示仍可玩；角色图就绪前给出明确加载状态，生成插画不应出现白底方块。
