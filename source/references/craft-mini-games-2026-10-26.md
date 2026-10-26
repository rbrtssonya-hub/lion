# 工艺展板双小游戏入口

2026-10-26，用户根据“造 → 工艺”截图要求将鼓点采青和梅花桩两个入口放入该界面，替代此前“先独立看效果”的接入范围。以 F盘当前 `main@514f61e` 为基线，在 `codex/craft-mini-game-entry-2026-10-26` 实现；复用游戏支线 `a9422f6` 的原始设计与角色，不将旧主网站代码合入。

## 现用入口和行为

`CraftSection.jsx` 在右栏工艺末注下增加“小试狮艺”及两个并排红金入口。短桌面保留17px正文，通过压缩标题、工序和垂直间距让照片、资料、末注及入口一屏显示；1920×1080、1440×900、1366×768实际通过。

入口懒加载 `MiniGameDialog.jsx`：原生dialog内直接进入对应Canvas游戏，关闭或Escape返回工艺入口焦点；暂停、结算、错误时舞台inert，操作按钮获得焦点。ModelPage明确传递工艺active，离页签或离章即卸载弹层。主体为React，游戏工厂只维护Canvas状态。

两玩法保留25秒18拍/12次命中收青、45秒五落点。WebAudio由用户开启，跟随全站静音与音量，暂停停止音源，退出或重玩释放旧上下文；监听、RAF及图像请求均清理。

## 素材与边界

独立原稿保留在 `source/design/lion-mini-games/`。AI辅助原创角色“阿南”不重绘；网站只部署 `source/public/assets/lion-games/lion-poses.png`，经 `media.lionGamePoses` 使用，与原稿及dist逐字节一致。原始图集/立绘/完整提示词见该目录 `ip-brief.md`。

动作是四姿态插画与实时位移/缩放，节拍和成绩为创意互动演绎。没有改变照片来源、原有模型、八态、小醒和主导航；独立原稿不是第二个部署入口。

## 实际验证

- Windows / Node24.20.0 / Chrome，基线514f61e加本任务工作区。
- `npm test`：124/124，含新增11项纯游戏、图集取消与音频生命周期检查。8张任务图片登记后资产清单897项。
- `npm run build`：382模块成功；游戏32.44kB脚本与5.08kB样式单独懒加载。保留既有大chunk提示。
- 开发：`PLAYWRIGHT_CHANNEL=chrome CRAFT_GAMES_REVIEW_DIR=tmp/craft-mini-games-dev npx playwright test tests/e2e/craft-mini-games.spec.js --output=test-results/craft-mini-games-final-dev`，9/9（26.4秒）。
- 生产：`PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_PREVIEW_PORT=4196 npx playwright test --config playwright.preview.config.js tests/e2e/craft-mini-games.spec.js tests/e2e/model-journey.spec.js --output=test-results/craft-mini-games-preview`，11/11（33.8秒）。
- 覆盖真实键鼠、开局自动聚焦、Tab循环及失焦取消按键、暂停松键、退出焦点、切页签/Hash卸载、素材503重试、加载中取消、三个桌面尺寸和原图许可。旧结构测试还验证原模型选中、隐藏暂停和短窗口可滚动。
- 独立审查真实发现的Canvas失焦按键残留已用先红后绿的第9项E2E修复；联调发现的StrictMode旧close事件、试敲提示覆盖、焦点逃逸、短窗入口屏外也已覆盖修复。初次资产登记脚本语法错误导致快照缺项，修正登记后124项全通过。

生产截图在 `source/reviews/craft-mini-games/2026-10-26/`：三张工艺入口、鼓点舞台、梅花桩舞台，共5图。未执行全站E2E、手机、其他浏览器、正式站点部署或EXE打包。
