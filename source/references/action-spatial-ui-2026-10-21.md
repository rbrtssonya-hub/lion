# 四面观狮空间UI重构（2026-10-21）

本轮在 E:/数字媒体竞赛/张钧儒/lion，codex/huangzhi10.21，从7930d1c实施。用户目标来自本轮goal-objective.md；建筑、舞台、四屏几何和完整醒狮/毛发/HDRI/视频原资源保持，未跟踪model/不纳入任务。仅普通电脑360°浏览，不包含头显/WebXR或手机验收。

## 模块与数据流

- `src/features/action/SpatialUI.jsx`：React维护介绍、四份动作解读及四屏播放按钮；事件边界隔离pointer/wheel/touch，保留原紧凑四动作选择、进度、声音及平面降级。
- `src/features/action/spatial-ui.css`：红金半透明雕花牌匾及动作页顶部HUD轻弧底板；不变更其他章节导航。
- `src/services/actionTheaterSpatialUI.js`：将固定世界平面经同一相机投影为CSS matrix3d，DOM不换父级，位置不随相机平移；视锥/法线/距离与结构遮挡控制显隐、焦点和命中。介绍固定(-5.4,2.7,0)，四份信息牌按各屏朝向分置侧廊；仅±18°单轴朝向修正。280ms退场/380ms入场；当前信息牌优先，相邻播放按钮重叠时退让。遮挡静态缓存，转动时至多120ms更新，不对全量发丝逐三角求交。
- `src/services/actionTheaterActiveScreen.js`：真实屏中心/内法线、相机世界朝向、视锥与投影覆盖率联合评分；移动/阻尼/按住拖动时不提交，500ms稳定及12°优势后才切换。手动立即提交并锁定，下一次实际拖动释放；纯模型自转、程序聚焦和滚轮缩放不抢手动选择。
- `src/services/actionTheaterFloorGuide.js`：真实深度测试的地面CanvasTexture平面，位于4.7m舞台以外；中央罗盘平铺，左右采用底边离地0.036m、20°浅倾角，以免低视角将文字压成5–8px；1920实际字高约27.6px，首次真正曝光/帮助入口/相机操作唤回，5秒闲置后700ms淡出，保留13%罗盘；相机停稳后先淡出再调整方位。
- `src/services/actionTheaterScene.js`：单RAF组合上述服务，保持原OrbitControls、VideoTexture及资源所有权。主屏识别不读取狮子旋转；暂停自转可独立控制，重试后与React状态同步。
- `useTheaterPlayback.js`：保持原四video及唯一音轨，增加明确resume入口，使切至被浏览器阻止的另一巨幕时仍可在原始点击栈恢复，不重建或重置视频。

## 四屏资源对应

|序号|世界方向|动作|既有媒体键|
|---|---|---|---|
|01|−Z|探青采青|actionTanqingVideo|
|02|+X|抖毛|actionDoumaoVideo|
|03|+Z|狮子吐球|actionTuqiuVideo|
|04|−X|踩梅花桩|actionMeihuazhuangVideo|

路径仍由actionClips→media→assetPaths解析；未增加视频状态副本，也未增加运行资产或依赖。素材说明沿用用户提供的动作演示，不能视为真实比赛评分样本。

## 验证与恢复

最终npm test **70/70**；生产构建**334模块**通过（1.76秒），保留已有Three538.05kB块提示。开发相关19/19（5.7分钟）及新增真实边界1/1（21.8秒）通过；生产相关24/24（5.4分钟）通过。最后将紧凑播放控制移回左下以露出中央罗盘，再次构建后**空间/构图8/8（1.9分钟）**通过，均0skip/flaky/unexpected。不能将这些相关子集称为全工程E2E。

124个public部署资产与dist逐字节一致。原528条二进制记录保持，追加4张本轮真实生产截图至532条；历史QA被旧测试默认写入后已经恢复原HEAD字节，后续输出重定向tmp，最终资产检查70/70通过。96页记忆0错误，4条既有历史源提示保留。

实际覆盖：四向锚点/360°回看、原4个video与暂停进度保持、按住拖动不切屏及500ms稳态、43°/47°边界往返不闪烁、90°正确切屏、空间按钮/进度/滚轮不带相机、画布缩放、自转独立、引导5秒闲置/恢复及罗盘不被控制条遮住、媒体授权/声音/全屏/重载/离页释放。实际墙体遮挡及CSS投影同一性另由4项模块测试验证。新增空间交互检查的pageerror为空。

完整数据：[验证JSON](action-spatial-ui-2026-10-21-validation.json)。

## 最终截图

均为真实生产页面1920×1080，已逐张查看；不是效果图背景。

- [正面](../reviews/action-theater/2026-10-21-spatial/front.png)
- [右面](../reviews/action-theater/2026-10-21-spatial/right.png)
- [背面](../reviews/action-theater/2026-10-21-spatial/back.png)
- [左面](../reviews/action-theater/2026-10-21-spatial/left.png)

## 验收边界与交付

所验1920目标未发现剩余已确认功能缺陷。900/1366电脑补充检查覆盖舞台完整、牌匾避开狮头与控制可用；不外推到任意窄窗文字排布或所有显卡。世界DOM使用保守整牌结构遮挡，不宣称与全量毛发逐像素深度合成；墙、立柱、台面遮挡与背面/视锥门禁已实现。没有头显、手机、其他浏览器/GPU长期性能、公开部署或EXE更新。

任务代码8文件，其中5个新模块/样式，清单见上方及JSON；测试新增3文件。日常提交只包含本轮代码、测试、报告、4图清单与记忆；保留未跟踪model/及历史资产。按根AGENTS普通推送当前codex/huangzhi10.21，新建同名upstream，不合并main；精确commit与push结果见最终回复及Git远端。
