# 仅结构图鉴移入主线与E盘切回main

用户明确要求只把结构右栏提交 `6e9df36` 并入 main，动作 `ce97297` 和 `38ba574` 不合，并将 `E:/数字媒体竞赛/张钧儒/lion` 切回 main。本轮从实际主线 `a3898e5` 接续；不合结构分支的父链，不改 C/F 盘其他工作区，不强推、不删除支线、不重打 EXE，用户原未跟踪 `model/` 保留。

结构已定点移植并保留远端08d3afc音量更新。初轮a389组合25/25之后，最新08d3组合核心66/66、331模块构建通过，增量浏览器12项11通过/1失败；严格策略单例再跑仍超时，但相同策略的独立原生拦截与真实点击恢复审查通过。自动化观察缺口原因未定位，完整保留，不称12/12。结构整合与适用验证已完成；Git以实际rebase后提交和普通push远端核对，不提前声称成功。

## 远端并发接续与最终复验

普通push拒绝后fetch确认origin/main新增`08d3afc963f9cc6a3f9c3adbae6826bb26e3e102`。该提交已进入主线，属于低音量有声/安全播放，不是用户排除的ce97297/38ba574空间UI。保留默认25%有声、首页声音开关/显式恢复、首次播放音量及layout离页防串音，`useTheaterPlayback`、音频测试、[声音来源](video-audio-2026-10-21.md)和音频日志不回退。

未推结构提交440bebb正常rebase到08d3，产品自动合入；6个wiki冲突以08d3原稿为底保留音量和主线历史再叠加结构。初轮baseRevision:a3898e5与报告保留，最新证据单列在[验证JSON](structure-atlas-main-2026-10-21-validation.json)的remoteConcurrentUpdate/finalRevalidation：

- 最新`npm test`66/66，4230.6087ms，0失败/跳过；构建331模块成功，CSS `index-22z5b474.css`、模型块`ModelPage-BsEFLCEJ.js`，既有Three大包提示保留。
- 最新音频/结构/播放增量12项实际11通过、1失败，201512.816ms。继承的`video-audio.spec.js`严格策略用例CDP表达式持续返回false，在标准配置下单例复跑仍超时（61122.812ms）。两次失败原样记录，原因未定位；未改音频产品或该测试，不称产品或harness已确诊，也不称12/12。
- 独立新Chrome使用相同`document-user-activation-required`及CDP `userGesture:false`观察：加载屏消失后activation=false，intro暂停、不静音、volume=.25，明确恢复按钮可见；真实点击后activation=true、不静音、playing、currentTime>.1、volume=.25、0 pageerror，全部断言通过。原生记录在`tmp/structure-strict-diagnostic.json`，before/after与方法持久汇入验证JSON。这证明独立原生审查通过，未消除原spec的自动化观察缺口。
- 所有本任务结构与所选播放增量实际通过，未回退远端音频；最终35个保护路径（原29及6音频）全部与08d3一致，49个被排除动作新增文件仍不存在，15个结构src/字图相同，560条清单、130public/dist及用户model SHA再次核对一致。原124public按Git clean内容比较、登记二进制严格SHA的边界继续保持。

本任务范围是只移结构并保全新main，不扩大为修复远端音频测试。保留上述已知自动化观察缺口，后续若单独追查需记录加载/策略/CDP观测过程；本轮不因此擅改声音代码或测试。Git仍由根代理最终标记6wiki、继续rebase、index/check/review后正常push核对；不预编新哈希或远端成功。

## 初轮移植与冲突处理

E盘已安全切到 `main@a3898e5`，随后执行 `cherry-pick --no-commit 6e9df36`。产品代码无文本冲突；9个冲突文件为 `docs/DEVELOPMENT.md`、`source/README.md`、`source/asset-manifest.json`、五页当前状态和日志MOC。

9处冲突已按主线为底解决。记忆以 `git show a3898e5:<path>` 为底，完整保留主线历史，只叠加结构移植及本次授权。日志MOC恢复主线版本供收尾统一索引收录原结构历史日志和新整合日志；未从支线整页覆盖而引入动作空间UI新增来源或有效状态。开发说明和清单按相同原则合并。

移植范围是 `6e9df36` 相对其父的结构补丁：浅宣纸图鉴、六张真实 ImageGen 书法 PNG、原模型/相机选择联动、前后翻阅、完整原资料展开、左侧工具、独立材质版本迁移、结构局部窄窗CSS和相关测试/资料。动作页/服务保持主线原版本，不新增 `actionTheaterSpatialUI.js`，也不将动作提交的8条参考/截图记录加入清单。

## 初轮原资源与验收基线

| 基线/目标 | 清单记录 | public文件 | 说明 |
| --- | --- | --- | --- |
| main `a3898e5` | 530 | 124 | 原清单对象和Git内容保全的权威基线；登记二进制另做SHA核验 |
| 动作提交 `ce97297` | 538 | 124 | 比main多8条动作设计参考与审查图，本轮不选 |
| 原结构支线 `6e9df36` | 566 | 130 | 包含父动作背景的历史树，不整体复制 |
| 仅移结构后的实际结果 | 558 | 130 | main530+结构28；main124+六PNG |
| 加本次主线两张QA后的最终结果 | 560 | 130 | 另增main-1920/main-900，未带动作8条参考/QA |

已实际核实原main530条记录对象全部保留；结构提交仅新增28条：六运行PNG、六生成原图、一参考图、十五审查图，本次再增两张主线QA至560。130份public与dist原字节一致；原124份public的Git内容与`a3898e5`一致，文本比较经过Git clean/换行规范化，未将其夸称为所有工作树文本原始字节不变。登记二进制的SHA严格一致。

独立审查确认29个动作/公共保护路径保持主线原版本，动作两提交新增的49个文件在index和工作树均未出现；15个结构src/字图与`6e9df36`相同。原结构资料、全部模型/毛发/HDRI/首页及动作视频/依赖均保留。用户根`model/醒狮_保留UV_三角转四边_优化.blend`仍未跟踪，139309821字节、SHA256 `2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2`不变。

## 历史证据与初轮验证

[原结构说明](structure-atlas-2026-10-21.md)、[原结构验证](structure-atlas-2026-10-21-validation.json)和原UI日志保留为 `ce97297` 背景下制作六字/实现图鉴的历史证据。其67项核心、31个分阶段浏览器案例、566条清单、332模块等数字不等于本次 main 组合验证结果；原件与提示词不重新生成，也不重写历史报告以制造已验结论。

初轮a3898e5加结构补丁在Windows/Node24.16.0/npm12.0.1、Chrome156.0.8078.47/ANGLE NVIDIA RTX5070Ti D3D11，生产预览`http://127.0.0.1:4191`、单worker实际完成：

- `npm test`66/66，4370.3734ms，0失败/跳过。
- `npm run build`330模块成功，CSS为`index-22z5b474.css`、模型块`ModelPage-Ct0rHS69.js`；既有Three.js大于500kB提示保留。
- 生产Chrome25/25单轮通过，282086.062ms，0失败/跳过/flaky，无重试：12个完整图鉴、2个GPU按需绘制/投影、5个未改main动作、2个全量毛发、1个设置生命周期、2个神态往返、1个旧宣纸迁移。
- 主线两张真实QA均已查看：[1920](../reviews/model/2026-10-21-structure-atlas-main/main-1920.png)、[900](../reviews/model/2026-10-21-structure-atlas-main/main-900.png)。归档并登记后另跑定向资产10/10，4156.4811ms。
- 清单/主线Git内容/登记二进制/结构一致性/不带动作新增文件及public/dist核对均完成，详情由[本次验证JSON](structure-atlas-main-2026-10-21-validation.json)保存，不以原分支报告代替。

初轮66/330/25与记忆检查98页/0错误保留为当时证据；上列29保护路径以a389为基准，不用于回退08d3合法音频。最终组合证据与明确的严格策略自动化缺口见前节，不将原报告或独立审查改写成12/12自动化全绿。根代理统一index/check/review、继续rebase后正常push origin/main并实核远端，不强推。范围仍限本机电脑；不包含全工程E2E、其他设备/浏览器、手机、托管或EXE，没有F盘同步或合入ce/38空间UI父链。

最终提交前已实际刷新工程记忆索引并通过ready检查：99页、0错误，保留4条既有历史来源提示（三处旧EntryNavTools.jsx、一处旧lion-overall.glb）。Git交付结果以最终提交、main分支及origin/main远端实核为准。
