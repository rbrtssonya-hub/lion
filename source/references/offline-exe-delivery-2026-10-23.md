# 桌面离线 EXE 与 ZIP 交付

用户2026-10-23要求将现行网页、浏览器内核及运行依赖一起封装为EXE，以指定狮头PNG为图标，在桌面“南风有狮”输出压缩包及解压目录。源网页基线为E盘 `main@530387390c3cc3e18a08353a85054c0303d64431`，保留既有未跟踪 `model/`。

## 最终产物

输出根目录 `C:/Users/Administrator/Desktop/南风有狮/` 仅含两项：

- `南风有狮-离线版/`：8份文件，双击其中 `南风有狮.exe`。
- `南风有狮-离线版.zip`：同名顶层目录，8份文件与目录逐项大小/SHA256一致；.NET与Python分别流式解压读取确认，条目为UTF-8及标准正斜线。

| 产物 | 字节 | SHA256 |
| --- | ---: | --- |
| EXE | 664287300 | `593976b0d540cb0b2e48e2422e54c2cb6275c7b2341c5055b8d41f3508b2ff20` |
| ZIP | 664458734 | `83a2ab655a5437dad5579ebbffeb67d11800097a07fada45b48cff171b77c586` |

EXE是独立便携程序，网页与内核都封装其中；目录旁附使用说明、版本、清单、媒体转换记录和验收摘要。无需系统浏览器、Node、npm或.NET运行网页。面向Windows10/11 x64，本次实际环境为Windows11 build26200；没有其他电脑或Windows10实机结果。

## 构建与完整性

沿用锁定Electron44.9.1（实际Chromium152.0.7977.167、Node24.22.0）与builder26.15.3，构建工具只在ignored `tmp/portable-toolchain`。网页仍由现有React/Vite入口维护，应用package.json/lock、src及public原资产均未改。隔离构建346模块，399份受保护源码/配置/public/原dist文件构建前后SHA不变；buildId为 `3e9f09f1ed39e45e30c2`。

生产网页153文件全部保留。运行目录包括完整内核、语言包、软件图形库、许可证、网页和壳共230文件，229项SHA清单加清单自身；启动逐项物理校验，验收又对解包和真实HTTP逐文件核对。原始一段HEVC循环视频仅发布副本转H.264/AAC/CRF18，其余五段H.264字节保持；六段最终发布视频全帧解码并在内置窗口实际播放。

图标源 `source/public/assets/entry/nav-lion-head.png` SHA为 `26db0cacaa575601d367028f51550669d962c53dddb3f596474ee57a44783a07`。builder派生16/24/32/48/64/128/256尺寸ICO，内部EXE先编辑图标再生成运行清单；NSIS外层使用同ICO，窗口使用同PNG。独立解析两份PE资源，全部七档图像字节与派生ICO一致。原PNG不改。

## 实际验证

- `npm test`：78/78；预存书册旧投影断言先20过1失败，改为验证外投影隐藏且页沟/曲面CSS原样保留后单文件21/21。
- `node --test scripts/portable/bundled-server.test.mjs`：1/1，GET/HEAD/Range/Host/白名单/停服令牌。
- `node scripts/portable/build-bundled.mjs '<输出根目录>'`：实际成功，隔离生产构建、转码、六视频解码及保护快照通过。
- `verify-delivery.mjs`：最终12/12 PASS，2026-10-23北京时间12:30:48–12:32:13。只连接EXE自己窗口，子PATH仅System32，独立TEMP和profile；完整内核/网页/HTTP SHA、六段Range、自然动画→短片→循环、七书页、真实WebGL/完整毛发元数据、八态、四视频与切屏、原生离线阻断及正常退出/HTTP/CDP回收均通过。页面错误、意外HTTP失败与外部资源请求均0；七页实际提交254–965ms。
- 普通双击模式GUI复验GREEN：真实PID/可见窗口/前台句柄，2560×1440 RGB截图，768采样全部不透明、764颜色；正常关闭后main/外壳退出码0/0，所属子进程和HTTP回收，未开CDP。
- 神态稳定终态补验PASS：同EXE真实 `#/state` 的“疑”态，`data-motion=idle`、无ghost、狮头透明度1、七处文字显现1、有限动画结束、页面/HTTP错误0，正常退出及端口回收。正式验证器同步增加这一步截图等待；不将新增等待称为整套12项已再次重跑。
- 最终9张审查图（7网页图、普通GUI与图标）由Root及并行Agent实际查看，神态过渡截图已由稳定终态替换；清单695条原对象保留，追加9图与本轮JSON至705条。

完整结构化证据见[最终验证JSON](offline-exe-delivery-2026-10-23-validation.json)，图片在 [source/reviews/offline-exe/2026-10-23](../reviews/offline-exe/2026-10-23/)。

## 失败与恢复边界

完整验收前两轮在书册父页index等待分别5/15秒超时，画面已见目标页但仍turning；未把失败掩盖成通过。三次独立诊断与后续正式全流程均正常，弹簧约0.7秒收敛，未能确证前两次触发原因，也没有声称修复产品缺陷。独立expect等待与项目15秒配置已统一，滚动后双RAF同步；未修改书册引擎或页面。失败与诊断保存在ignored tmp，索引见JSON的priorRuns。

旧GUI脚本误选160×28透明辅助窗却返回GREEN，已作废其视觉结论。修后按EnumWindows/PID/真实尺寸选窗，原生AttachThreadInput切前台，验证实际像素，并向已核实窗口发WM_CLOSE；前台锁拒绝的中间失败也未用作最终结果。ZIP首轮.NET Framework默认反斜线条目未通过校验，保存在tmp，后续显式写UTF-8正斜线重建并由两种读取器验证。

本壳内部请求始终限同源；HDRI用内置或本地文件，远程HDRI请求受封装策略阻止。资料HTTPS外链需用户原生确认并联网。本轮未专项复测兼容模式快捷键重启、同TEMP双实例、实体扬声器、其他电脑性能或其他OS；前次2026-10-20覆盖不冒充本次结果。许可、出处与AI说明全部保留。

## 复现入口

见[打包说明](../../scripts/portable/README.md)。本轮构建快照位于ignored `tmp/bundled-exe/b7de05d1-6e82-4e23-8fbb-3171b9aaa1c1`，原始最终验收在 `tmp/offline-exe-acceptance-2026-10-23/delivery-2026-10-23T04-30-48-563Z-17ed4c00`。二进制和工具链不提交Git；源码、审查证据、说明与工程记忆按根AGENTS提交推送当前main，不纳入model/或其他分支。
