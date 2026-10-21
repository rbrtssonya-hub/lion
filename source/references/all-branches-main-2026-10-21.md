# 两段首页视频与全部开发分支归并主线

## 最新授权与范围

用户2026-10-21明确要求：第一个视频用于首页入场、第二个视频用于后续循环；推送GitHub，合并**所有分支**到main，并将最新lion工程更新到F:/数媒竞赛/信息可视化codex。本次“所有分支”覆盖此前材质工作只推支线、不合main的阶段限制；不处理其他工作区的未提交内容，不删除支线或其他worktree、不强推、不创建PR。

唯一实施目录为上述F盘工程。初始main/upstream同为45f4cbdfe3a40816c332aba3b44c0b8b39c111c1，只有未跟踪.superpowers/；C盘旧worktree和E盘独立工程保持。网页源码、原素材、开发脚本均在原位置，不另复制一套入口。

## 视频文件与顺序

| 用途 | 用户原件 | 网页运行路径 | 字节数 | SHA-256 |
| --- | --- | --- | ---: | --- |
| 第一个，首次入场 | F:/数媒竞赛/醒狮素材/入场视频.mp4 | assets/intro/entry-intro.mp4 | 17701673 | e6f0ec2828ccc9f8d637d15ab3f648c0d6161a9c6a228bce206761cfd2a4eb4e |
| 第二个，后续循环 | F:/数媒竞赛/醒狮素材/循环视频.mp4 | assets/entry/home-lion-loop.mp4 | 33463217 | 93353de8e2da20d96e54654dea3735f6cc60c5cbe092cc3fb3dd658cbc0944f9 |

原视频支线b9eac7d早已通过9cb0097进入main；本次再次校验用户源、public、dist及origin/main中Git blob一致，保持正确原字节，不重编码或制造重复替换提交。HomePage/useEntryPlayback仍为自然结束、跳过或失败后进入循环，默认静音、显式重播及离页暂停不变。视频为2560×1440 HEVC/AAC，本机Chrome实播不代表所有设备解码兼容。

## 分支与冲突处理

fetch/ls-remote盘点GitHub9条开发分支（本地另有6条同名开发分支），其中8条已经是main祖先。只有codex/reading-paper-material-2026-10-20@516b10cbe56ec0852a2940c3f14adf5f3db46768尚未合入，包含1695339材质实现及516b10c远端审查记忆。使用普通保留历史的no-ff merge接入，不回写旧分支文件来替换新主线。

实际有5处冲突：useDeveloperSettings.js的导入及4份wiki当前状态。设置同时保留纸张migrateReadingPaper/readingPaperVersion、HDRI默认及范围、snapSettingsRange精确步进；没有二选一删除。wiki保留双方来源和有价值的历史结论，当前待办按此次整合重写，阶段限制明确标为历史。

产品变更仅材质支线6个文件：首页无框柔边题签、正文/神态暖灰宣纸、一次性旧默认逐字段迁移及公共材质草稿。主线完整模型、33组毛发、HDRI EXR/灯光与两个运行视频均保留；source/public、src/config、src/services、src/features/action、HomePage/useEntryPlayback及package/lock相对45f4cbd无改动。4份纯材质样式/定义与传入支线逐字节相同；设置面板只额外整合主线已有HDRI页。

原main资产清单516条逐字段保持，传入材质分支12张历史QA记录后共528条；124份public文件与当前dist逐字节一致。没有新增运行图、依赖或未授权人物照片。

## 独立审查与本轮验证

独立只读审查没有Critical/Important，唯一Minor是“自定义HDRI与旧纸张同时迁移”缺少直接断言。已扩充既有reading-paper浏览器迁移用例，预置开关false及1.35/47/-.4/.65四个非默认值，第一次迁移和刷新后同时核对纸张与HDRI保存；没有为测试修改产品行为。

- 合并前核心54/54。
- 组合树npm test：59/59、0失败/跳过，7850.6628ms。
- 提交前再次完整运行npm test：59/59、0失败/跳过，8351.7062ms；产品代码指纹与已验收构建保持一致。
- 组合树npm run build：328模块、3.70秒，成功；保留既有Three.js 538.04kB大块提示。
- 开发Chrome：18/18、0失败/跳过/flaky，461306.681ms。包括HDRI真实像素及完整毛发、结构/动作失败重试、视频实播、纸张迁移/端点、公共模块及窄面板。
- 生产Chrome：31/31、0失败/跳过/flaky，655864.6ms；除上述功能外覆盖8组宽窄/矮电脑尺寸、900px设置推开、标题居中、类型展开、神态对照及首次约12秒七页翻阅。
- 补入自定义HDRI断言后的迁移用例，开发另跑1/1通过（24746.279ms）；生产31项中已包含该最终版本。不能将开发首批18项描述为包含后来补充的断言。
- Chrome155.0.8059.85当前组合4张截图已逐张检查：首页1920与1024、神态1920及HDRI设置。1920×1080/2560×1440/1366×768/1024×768独立复核居中与无横向溢出，pageerror为空；截图是浏览器真实输出，不是生成效果图。临时截图留在ignored目录，不混入运行资产或冒充原支线QA。

完整命令、结果与边界汇总于[本轮验证记录](all-branches-main-2026-10-21-validation.json)。临时config、JSON报告、像素附件、截图及日志放ignored tmp/all-branches-main-2026-10-21/，不上传。配置使用已装Chrome、单worker、trace关闭；整例180秒预算用于原本多次加载的场景，各内部等待和产品超时不变。

## 发布与限制

组合实现已以705531db801ec8c2c45061f0391ede63ea959305创建普通双亲合并并推送main；双亲为45f4cbd及516b10c，未重写历史。随后fetch核对HEAD=origin/main=705531d，ahead/behind为0/0；全部17个本地/远端分支引用端点（含两处main，开发分支去重9条）均为main祖先，无未解决冲突。两段视频及124份public/dist一致性在推送后再次通过。分支名称、未提交输入及.superpowers保留，不纳入提交。

本轮工程记忆index/check为95页、0错误、4条既有历史源码迁移提示；git diff --check通过。本段及validation的最终交付记录另作纯文档普通提交推送，不改已验收的src/public/依赖；最终main完整HEAD以所属文档提交和交付回复的实际ls-remote核对为准。

此次只交付网页工程及dist本地生产构建，不重新打包EXE，不测手机、其他浏览器/硬件或正式托管，不把相关电脑回归写成全工程E2E全绿。
