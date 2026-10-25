# 十二项视觉批注与首页一屏展览验收

本轮在F盘权威工程、`codex/exhibit-screen-2026-10-25` 分支上，基于 `d82a5687d7e1b4208d22a6c59353e8053b16a3c5` 实施。Windows、Node v24.20.0、Chrome 156.0.8078.47；仅电脑网页。十二项需求逐项对应见[实施计划](../../docs/superpowers/plans/2026-10-25-exhibit-screen-review.md)。用户原有App底部格式修改与`.superpowers/`继续保留，不纳入任务提交。

## 当前行为

首页保留原入场与循环影像。向下滚轮或“探索更多”进入书页；左侧四个目的地切换史册、文化、狮种、资料四个一屏展板。继续向下不切换展板，向上返回主视觉；资料长栏保留自身鼠标与键盘阅读，外页不随其滚动。展板保留挂载，自动书页与图库仅在对应展板活动时播放。书页iframe也走同一滚轮意图入口，横向手势不触发上下导航。

书册标题收为44px高单行，七站导航并入168px说明底卡，正文18px。标题、完整纸面、底卡共用左右边界，现有引擎按实际容器宽度接收原0.9–1.45范围的scale，不增加iframe补偿变换。用户缩放偏好仍可缩小整列；题签与说明原独立宽度偏好保留在存储中，显示服从统一边界。

| 电脑窗口 | 实测可见纸面 | 当页正文 |
| --- | --- | --- |
| 1366×768 | 974.33×431.13px | 18px |
| 1440×900 | 1192.99×527.90px | 18px |
| 1920×1080 | 1559.83×690.21px | 18px |

文化区收紧标题和图文间距，删除无操作意义的近远轴，以真实换图按钮引导浏览。狮种简介和三项观察默认可读，图片进入有不同内容的形制对照。来源与八份摄影许可全部保留，文献/许可分成两个独立阅读栏。

结构标题、图鉴与操作卡共用原纸面材质及圆角；形制、工艺、纹样和模型说明直接呈现。剧场标题、解读、播放器与视图按钮统一圆角暗纸与金边。Logo固定左侧，保留其余导航文字的原连续过渡。神态提示使用浅纸底操作入口，当前朱红条延伸到左侧屏幕边缘并带轻阴影；神态列表也加浅纸底避免下方文字混入红色笔刷。公共`interaction-cue`只为真实操作提供轻微边缘呼吸，不使备注闪动；减少动态时停止呼吸，操作保留。

## 实际验证

- 核心/资产`npm test`：78/78；生产`npm run build`：354模块，通过。Three.js既有538.05kB体积提示保留。
- 生产主组合：38/38，3.0分钟，覆盖新四组验收、七页完整纸面、真实18层双面卷曲、早进入、iframe上下/横向滚轮、首页往返/resize/本地键盘、章识别、神态点击与整图动作、材质/设置事务。
- 生产动作与内容往返：15个不同案例分别通过（首轮14通过，纸面alpha字符串断言改为RGB与数值近似后1/1补验）。相机距离、真实模型投影、资料滚动与焦点/浏览器返回阈值保留。
- 神态列表增加浅纸底后的最终生产提示/Logo/活动红条与减少动态专项1/1通过；全部15张截图随后重拍。
- 结构开发回归：新面板3、原动作/目录/模型交互11、完整图鉴12、结构布局3分别通过。
- 文化/狮种/来源开发21项整组通过，另真实WebGL换图一次只前进一张1/1通过。
- 六份旧首页测试的有限兼容集合：25个不同案例分别通过；原长页/折叠/透明侧轨等预期按最新需求迁移，未视为全仓库E2E全量结果。
- 生产截图在`source/reviews/exhibit-screen/2026-10-25/`，含1366与1920七种画面及1440书页，共15张。浏览器版本、几何、横向溢出与页面错误记录于同目录`capture.json`。截图逐张查看，独立审查另检查文化/狮种/来源六张及神态/动作1920两张。
- `capture.json`为零页面错误/零横向溢出；资产清单原726条完整保留，15张PNG与元数据共新增16条至742。142份运行资产与dist逐项SHA一致。

可复跑的主要生产命令：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm test
npm run build
npx playwright test --config playwright.preview.config.js tests/e2e/home-exhibit-navigation.spec.js tests/e2e/book-screen.spec.js tests/e2e/exhibit-content.spec.js tests/e2e/exhibit-panels.spec.js tests/e2e/home-reading.spec.js tests/e2e/expression-reactions.spec.js tests/e2e/expression-click-feedback.spec.js tests/e2e/chapter-identity.spec.js --output=tmp/exhibit-production-delivery
npx playwright test --config playwright.preview.config.js tests/e2e/action-panel-readability.spec.js tests/e2e/content-comparison.spec.js --output=tmp/exhibit-compat-production
python wiki_memory/工具/memory.py check --project . --memory-dir wiki_memory --require-ready
```

## 审查发现与修复证据

初版一屏画册过小，1366仅约783px宽；增加940/1500px实际纸面下限后先失败，再合并导航底卡、按容器拟合引擎scale，三尺寸逐七页通过。狮种先后由截图发现图注重叠与最后观察被裁，补了真实相交和段落100%入屏失败断言后修复。

独立审查复现书页iframe上滑仅滚80px、BODY PageDown停在半屏、先缩小再放大丢失落点、跨章节返回首页被旧意图拉回、资料列键盘被全局拦截。现均有真实输入回归：统一iframe/外层入口、独立滚动意图、停用时清意图、局部阅读优先。横向iframe噪声也先复现错误返回810px，再加方向过滤通过。

最终独立交付审查另复现指针停在顶部导航时绕过首页滚轮，停在300/710px半屏；新增真实header输入回归先失败，再把同一输入面扩至含header的site-page。设置面板仍在输入面之外，局部资料阅读优先。审查者在生产环境复放向下300/向上100及header焦点PageDown/PageUp，实际落点均为810/0px，确认P2消除且无剩余交付阻塞。

一次书册初始化失败的trace同时包含并行源码Hot Refresh和测试注入的sandbox SecurityError；无书页网络失败证据。改为仅顶层注入后，早进入专项连续3次及最终生产均通过，未将受HMR污染的结果误记为产品初始化缺陷。首次生产截图脚本在剧场准备期间使用默认5秒等待而超时；现先等待真实ready，再等待实际转场idle，重拍完成。

首次生产组合因旧测试直接滚动隐藏展板而停止；入口已迁移为真实“探索更多＋侧栏”。旧来源折叠和透明侧轨断言也按用户新要求更新。六份兼容集合的首跑四项失败为旧装饰预期、测试fixture括号和设置guard处理，均保留记录并分别复验，未声称初跑全通过。

## 范围与交付

没有替换视频、模型或图像运行资产，没有新增依赖。新截图与元数据登记资产清单，运行资产与dist按SHA核对。没有重新打包旧离线EXE，也未做其他浏览器、手机专项或真实显卡性能基准。Git交付以本记录所属提交与最终upstream核对为准；不自动合并main。
