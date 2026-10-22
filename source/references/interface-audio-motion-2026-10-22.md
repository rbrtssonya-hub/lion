# 默认播放、神态书法动效与结构目录

本轮基线 `5b2a30769a006d626f78680369689b237c6bb858`，工作位置为 C 盘 e919/lion，交付分支 `codex/expression-structure-audio-2026-10-22`。只实现用户本轮四项界面要求；保留原有完整醒狮、毛发、视频、HDRI、视角与参数折叠设置。

## 播放与声音

首页入场、循环与动作当前主屏先按既有 25% 音量请求有声播放。若浏览器原生拒绝有声自动播放，立即静音继续画面，右下角显示声音入口，首个真实主指针或键盘操作直接在手势调用栈恢复声音。中央不再出现阻断观看的自动播放提示。用户主动静音优先，通过 `nanfeng-lion:media-audio:v1` 在同标签页会话中跨章、重播及刷新保留；关闭标签页后新会话默认开启。

`SoundControl` 统一首页与动作开关，`useMediaAudioPreference` 保存用户意图。实际浏览器许可、用户静音意图与播放资格分别维护。后台暂停、layout 阶段离页暂停、仅动作当前主屏发声、迟到 play Promise 的失效保护继续有效。

普通网页无法保证任何新浏览器首次访问均有声自动播放，以上使用静音继续与真实手势恢复处理浏览器限制。依据：[Chrome Autoplay policy](https://developer.chrome.com/blog/autoplay/)、[MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)。本轮没有更改用户浏览器配置。

## 八态书法与连续切换

按用户指定，使用内置 `image_gen.imagegen` 分别生成八张朱砂毛笔字“喜、怒、哀、乐、动、静、惊、疑”，以结构“神”字 PNG 为风格参考。八张均为 1254×1254 RGBA，保留生成时的透明 alpha，未做图像后处理。原始生成图和网页图逐字节一致；全部逐图检查字形、笔触、比例和留白。

- 创作源与完整逐图提示词：[expression-calligraphy/2026-10-22](../design/expression-calligraphy/2026-10-22/prompts.json)。
- 只读像素与 SHA 验证：[validation.json](../design/expression-calligraphy/2026-10-22/validation.json)。
- 网页路径：`source/public/assets/expression/calligraphy/`，集中在 `assetPaths.js` 注册，再由 `media.js` 解析。

点击狮头时，同一标题节点由大字以 580ms 缩小平移至详情题签，原说明短暂淡出，详情分层进入。反向操作从动画中当前矩形续接，不从旧端点重新跳转。标题缩小时延后详情标题进入，避免中途压字。临时文字快照去 ID、`inert`、`aria-hidden`，图片旁保留屏幕阅读文字；切态、对照、离页、减少动态偏好变化时均取消动画并释放快照。选中当前简介态不创建无效快照。

## 结构侧边目录

纸页面板新增六部件侧目录，编号、短名与朱砂选中态对应当前部件；与真实模型热点、前后翻阅、复原共用既有 `selectedId/selectHotspot`。支持方向键、Home/End 及循环选择，当前项具有 `aria-current`，单一 Tab 入口。目录和正文分别滚动；ResizeObserver 在低高度或设置推开后显露当前项，卸载时断开。极窄自定义纸页目录转顶部 3×2，保留既有正文字号、六张结构书法和全部资料。

## 实际验证与边界

开发版：结构目录与原图鉴 15/15；神态与既有内容集 22/22 后追加快照透明度断言 1/1，随后微调说明进入时机，最终新专项 3/3；动作播放器 11/11、原生严格策略 2/2、有声获准首页 1/1，动作按钮颜色修正后原生严格动作 1/1。

严格自动播放测试原先受 Playwright trace 快照注入 `userGesture:true` 干扰。本轮禁用该 spec 的 trace，以独立干净 Chrome、`document-user-activation-required` 以及 `Runtime.evaluate(userGesture:false)` 观测，实际确认未激活、原生 NotAllowedError、静音时间推进和真实手势恢复。该修复补上上一轮保留的严格策略测试观察缺口。

最终生产整合 15/15 通过（144.407秒）。随后交叉审查复现“已启声但确认Promise未决时点击关闭却再次恢复”的优先级竞态，新增针对性回归先失败，再只修正首页开关先处理已开启状态；开发新例1/1、重建340模块及最新生产音频完整4/4（47.551秒）通过。15项组合图形/目录代码不再变动；最终4项复核修后的声音流程，不将两轮写成同一次19项运行。

源码跟踪的核心与资产测试71/71（4473.302ms），0失败/跳过；不计入预存未跟踪fur实验测试。资产清单612条，原569对象保持，新增16份书法图和27张审查图；141份public/dist文件全部原字节一致，预存五项fur文件SHA均保持。生产7张截图由root逐张查看，八字、神态11图、结构6图和音频3图分别完成审查。生产动画观察 `errors=[]`，字宽180→145ms时85.145→最终55.984px，旧字副本0。

完整结果另见 [validation JSON](interface-audio-motion-2026-10-22-validation.json)。审查截图分别位于 `source/reviews/audio-control/2026-10-22/`、`expression-motion/2026-10-22/`、`structure-directory/2026-10-22/`，生产截图在 `source/reviews/interface-production/2026-10-22/`。仅本机电脑 Chrome 及适用子集验收，未做全工程 E2E、手机、异机、其他浏览器或 EXE 验收；浏览器媒体状态不等于物理扬声器响度测量。

预存未跟踪 `model/` 及五项 fur 实验文件保留并排除本轮提交；依赖安装、dist 与临时测试输出不提交。Git交付以所属提交及最终远端 HEAD 核对为准。
