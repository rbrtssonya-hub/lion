# 四章精简改版：本地实施与验收

日期：2026-10-26。工作区：`F:/数媒竞赛/信息可视化codex`。分支：`codex/nfys-structure-review-2026-10-26`。实施基线：`ce85484`，保留原 App 排版 dirty 与 `.superpowers/`。用户已批准[范围说明](../../docs/superpowers/specs/2026-10-26-four-chapter-local-redesign.md)，并要求直接实施、后续不逐阶段确认；只本地提交，不合并或推送 main/GitHub。

## 已实现

- 顶栏序／造／舞／传；合法路由与顶栏章节分开，`state`保留并归属舞。旧`intro/structure`、`#state`、历史前后退可用。
- 序章保留原入场和七页翻书；侧轨为书册与三个主章入口。资料与许可改为原生 dialog，两列局部阅读，Esc关闭后恢复入口焦点。
- 造章保留完整外观模型及六组部位，新增观形／形制／工艺页签。形制复用现有单狮／对照；工艺只呈现广州成品实景与有来源的扎、扑、画、装。隐藏模型时停止绘制，返回保留选择和 canvas。
- 舞章首屏可进入八态；默认原循环保持，主动顺序观赏才按四片真实 ended 推进，末幕暂停并可去传章。八态保留诗性文案、观察与对照，新增返回戏台，原部位往返保留。
- 传章为原创原生 SVG 案例分布图，岭南、香港、新加坡、旧金山、埃德蒙顿五地、八幅原照片；保留图注、作者、许可、照片故障回退和键盘操作。
- 新增传章底板设置；高度自动适配视口，未暴露无效高度控制。资料搬入 dialog 后仍消费原材质设置。

## 内容与资产边界

没有新增固定点睛规则、内部机关图、鼓型对应、完整采青套路、演员内部视角、人物模块或未经核实年份。阿南两小游戏仍在独立设计目录，不接主站。没有新增依赖、字体或运行媒体；旧 EXE 没有重打包。

地图是当前收录案例的空间索引，不是传播路线或全球覆盖统计。原生 SVG 海岸线由代码绘制，无国界、航路或迁移先后；照片年份标注为拍摄年。资料和照片许可来自原 `home-culture.js`／`home-heritage.js`／史册来源，未在本轮另做外部史实核查。

原资产清单779条逐条保留；只追加18张生产截图、capture.json、assets.json共20条，清单799条。清单内121份运行资产与源 SHA、大小一致，且与生产 dist 逐字节一致。详见[资产核对](../reviews/four-chapter-journey/2026-10-26/assets.json)。

## 实际验证

环境：本机 Windows、PowerShell、系统 Chrome 通道；开发5173、生产4186。结果适用于本分支工作树，不代表 GitHub/main 或旧 EXE。

| 命令／范围 | 实际结果 |
| --- | --- |
| `npm test` | 最终89/89通过，约5.14秒 |
| `npm run build` | 最终361模块，约2.32秒；保留既有500kB chunk提示 |
| Chrome开发：四章／地图／造章／舞章专项 | 各模块先红后绿；地图4/4、造章2/2、舞章5/5；原结构与播放器、对照等适用范围亦通过 |
| Chrome生产第一组 | four-chapter、model-journey、spread-journey、action-journey、content-comparison、structure-interaction、settings-modules共30/30，3.3分钟 |
| Chrome生产追加 | action-journey、action-player、four-chapter共20/20，2.5分钟 |
| 最终源代码和样式下Chrome生产受影响回归 | action-journey＋four-chapter共10/10，1.1分钟 |
| `node scripts/review-four-chapter-journey.mjs` | 18张正式截图、0 pageerror、3尺寸无横向溢出、顶部导航均在视口；已人工逐张审查 |

上述生产命令均设置 `$env:PLAYWRIGHT_CHANNEL='chrome'`、`$env:PLAYWRIGHT_PREVIEW_PORT='4186'`，使用 `--config=playwright.preview.config.js`；输出分别在 `tmp/four-chapter-production`、`tmp/four-chapter-production-final`、`tmp/four-chapter-final-affected`。没有把分批、重复或部分重叠用例相加声称一次全仓通过。

## 审查与修正

独立审查未发现 Critical，提出的两个 Important 已修复：

1. 资料迁到 dialog 后旧祖先选择器失配。实际背景色／透明度回归先红后绿；修复了区域、卡片材质及卡片排版。
2. 顺序媒体 ended 与后台 pause 交错时可能卡住。控制器记录待消费结束，前台有播放意图时只消费一次；停止、切幕、离页取消，显式暂停要等用户继续。实际控制器VM边界测试先2失败后5通过，再补暂停先后顺序的1失败，最终6/6；浏览器新5项及最终生产10项通过。VM控制了事件时序，不冒称真实操作系统切页撞中该毫秒级时序。

两项 Minor 也处理：传章隐藏不生效的高度控制；迁移 helper 按造章 tabpanel／资料 dialog 检查边界。截图审查同时收紧了资料排版和侧轨字距。

## 截图与限制

[截图记录](../reviews/four-chapter-journey/2026-10-26/capture.json)包含1366×768、1440×900、1920×1080的书册、观形、戏台、八态与传章；另有1440形制、工艺和资料截图。源文件均留在 `source/reviews/four-chapter-journey/2026-10-26/`，不进入部署资产。

本轮未跑全仓历史E2E，部分旧四展板／顶栏state用例仍需按已改变的信息架构继续迁移；本轮已迁移共享形制／资料helper、对照和播放器离页相关用例。未验证其他浏览器／电脑、手机、真实显卡性能或新版离线EXE。预览服务只在本机，不是远程部署。

本地查看：`http://127.0.0.1:4186/`，传章 `/#/spread`，造章 `/#/model`。服务不在时在本工程运行 `npm run build` 后 `npm run preview -- --host 127.0.0.1 --port 4186 --strictPort`。
