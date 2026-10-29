# 醒狮八态 V7 主站集成

2026-10-28 用户明确授权将独立V7替换主站八态，保留主站顶部导航、电脑窗口自适应，并把巡游等参数接入现设置。独立版设计已在前序逐项批准；本次沿用，不增加方案审核门槛。

## 已确认架构与任务

- [x] 保留主站React19.1/Three0.160/Vite7及原SiteHeader和#/state；ExpressionPage作为宿主壳，新增native expression-depth feature，无iframe/第二入口。
- [x] 局部scroll viewport+稳定overlay，Lenis eventsTarget仅根容器，原相机轨迹/36站距、3秒五官和点击后解读保留；组件卸载回收播放器/WAAPI/监听/纹理。
- [x] 复用24份主图/补绘/单字，新增音频/字谱/Q图标/本地隔离字体按media+manifest登记。
- [x] 设置沿现有存储/保存/取消事务，新增移镜6秒、解读12秒、图/文100%、图标40px、视差100%、滚轮100%；旧数据自动补默认。
- [x] 模块CSS作用域和命名容器查询，适配电脑1280/1366/1440/1920与700可用宽；原概要/详情字号、底板材质及点击参数继续有实际效果。
- [x] 迁移旧三栏UI测试到V7真实契约；保留跨章节返回、助手来源锚点、主站设置事务，不伪造旧DOM。
- [x] 单元/资产、构建、真实8态全巡游、真实五官截图、settings动态消费、responsive、跨章回收；主站最终构建复核。旧模型返回接口保留，但现atlas旧入口不可达，不冒充浏览器已验证。
- [x] wiki memory/index/check、按任务路径审查暂存、commit/push当前main并fetch核对，不纳入他人任务。

## 执行边界

开始基线main@dc9729a，spread两文件未提交属于并行任务；执行期间其作者提交edafc07，继续按当前代码验收，不回退。用户指定本checkout主网页且持续授权提交推送，本任务在该当前checkout按显式路径提交，不另起会造成用户看不到结果的副本。不得强推。

实现分工：root宿主/scroll/tour/协调/交付；scene worker场景适配及核心e2e；settings worker配置UI/参数与全巡游e2e；asset worker来源和媒体/小组件/旁白；CSS worker作用域/窗口适配；test migration worker旧契约归档与跨章测试。各人明确文件ownership并保留他人改动。

## 当前证据与待收尾

6项新正式生产回归先通过（8态/截图/cleanup/逆滚+settings），默认8态全巡游及fallback已3/3通过。CSS专项5档布局通过，RED捕获旧字号被容器上限钳住，已修源等待最终build；材质旧控件同步接入。npm test发现新审查PNG需登记manifest，以及助手知识来源锚点缺失（已在host壳保留真实expressionObservation锚点）。所有最终结论写source/references/expression-depth-integration-2026-10-28.md，旧独立版验证不冒充主站结果。


## 2026-10-29恢复验收

中断后的3个巡游/后备用例已补跑3/3通过，新核心累计15项完成；原宿主7项通过。来源和边界详见source/references/expression-depth-integration-2026-10-29.md，最终提交前核对资源清单/记忆。

交付暂存审计：共享工作区其他任务新增素材影响全仓资产检查，因此只暂存本任务72条资产变更与指定文件；不包含造章/邮票/入场素材等并行变更。最终main推送以Git命令结果为准。
