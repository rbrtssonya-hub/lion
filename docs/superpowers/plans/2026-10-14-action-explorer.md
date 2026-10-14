# 动作首屏与四段联动实施记录

用户已批准的方案是本任务的规格；工作基线 `b1fbbcf`，分支 `codex/lion-next-2026-10-14`。只改动作页，不修改首页视频、全局导航和神态页，不合并 main。

## 交付要求

- 首屏左侧约70%的16:9媒体、右侧醒狮元素/编号/两句简介，初始入场01/04。
- 第二屏标题“动作怎么读”，四段左媒体/右简介；入场、探步、转身、收势。
- 两个heritage时间轴共用selectedId；首屏只切内容，下方吸顶时间轴定位段落且不改Hash；自然滚动高亮联动，程序滚动不闪中途节点。
- 片段原位播放并放大1.04/240ms；全页同时一段播放，隐藏/离页/滚出视口暂停；真进度、音量、全屏、重试和缺失回退。
- 正式视频尚未提供，videoKey保持null；四幅AI辅助提取示意图不可当作真实首帧。用户全身图与已有media.poster哈希一致，复用作为异常回退，不复制原文件。
- 公共路径由assetPaths/media维护，新增资产登记manifest及来源。只桌面验收。

## 实施任务

1. 先写动作页集成测试并在旧页观察失败；整理素材。
2. 实现actionClips、ActionTimeline、ActionVideo和ActionPage，移除动作旧三栏分支，隔离action.css。
3. 缺失素材在实际网页验收；通过独立的测试夹具给真实组件注入明确测试媒体，测试实际HTMLVideoElement，不将测试入口/视频部署。
4. 浏览器回归/桌面截图、独立代码审查、工程记忆与新分支commit/push。

## 检查重点

快速切视频时迟到play promise、离页资源清理；平滑滚动选中锁与取消；视频/海报加载错误；所有小桌面及设置推开时1.04放大不越界；两条时间轴和当前文案不可漂移。

执行命令：npm test、npm run build、PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --grep-invert 手机、对应test:e2e:preview、memory index/check --require-ready、git diff --check。
