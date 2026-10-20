# 全部分支归并主线

## 授权与实施位置

2026-10-20用户明确“全部分支合并到主线”，覆盖此前仅推送支线的边界。唯一工程F:/数媒竞赛/信息可视化codex，初始本地main70ac3b6、内容支线4017f3f；fetch发现远端main已新增d9c88f2（仅工程记录）。工作树仅原有未跟踪.superpowers，暂存为空；C盘两个worktree保留，不把它们的未提交内容当成分支提交。

## 分支盘点

GitHub9条分支包含main和8条开发分支；本地5条开发分支均有同名远端且端点一致。

| 开发分支 | 端点 | 初始是否已在origin/main |
| --- | --- | --- |
| codex/content-responsive-2026-10-20 | 4017f3f | 否，2个独立提交 |
| codex/home-chapters-2026-10-13 | 8b2b7f5 | 是 |
| codex/home-lion-types-inheritors-2026-10-19 | 2aefef9 | 是 |
| codex/huangzhi10.15 | 8df6ee0 | 是 |
| codex/lion-next-2026-10-14 | d77b816 | 是 |
| codex/navigation-image-icons | c45502c | 是 |
| codex/navigation-stable-background | 8748cc7 | 是 |
| codex/replace-home-videos-2026-10-19 | b9eac7d | 是 |

采用merge-base祖先检查而非比较分支日期：已包含者不重放旧文件，避免恢复已删除人物或旧导航。main先ff-only同步d9c88f2，再no-ff/no-commit合并4017f3f；只有wiki_memory/当前状态/项目概览.md两段新增记录冲突，保留双方sources、内容说明及E盘历史记录，不ours/theirs整页覆盖。远端同步日志和两个MOC条目均保留。

## 验证与交付状态

- 集成候选核心测试51/51、0失败/跳过；生产构建321模块、1.96秒通过，保留既有Three.js534.77kB警告。
- 生产Chrome专项24/24、0失败（2.8分钟），覆盖类型/神态对照、结构往返、尺寸矩阵、公共设置及动作空间回归。使用独立tmp输出、关闭trace避免前轮磁盘写满；动作旧测试截图重定向tmp，没有覆盖历史QA。
- 实际src、tests、scripts、运行资产、配置、package/lock/Vite及454条资产清单均与4017f3f一致；89份public文件与新dist逐字节相等。两侧项目概览记录和远端同步日志均保留，索引无未解决冲突。
- 独立只读合并审查：0 Critical、0 Important，2 Minor为收尾阶段尚未刷新日志MOC/暂存新文档，按协议index和显式暂存处理；审查未冒充主agent的新测试或推送结果。

全部分支保留，只普通推送main；提交前再次fetch确认远端main仍d9c88f2、8条支线端点未变，推送后对照实际远端main SHA及全部分支祖先集合。最终SHA取本记录所属合并提交，双亲须为d9c88f2与4017f3f；不强推、不删除分支。工程记忆index→require-ready通过（87页、0错误、4条既有历史来源提醒），工作区和暂存diff检查通过；详见[机器可读验证](all-branches-main-2026-10-20-validation.json)。本轮不新增设计/EXE/运行素材，未重测所有272项；旧内容任务完整批次见content-responsive-2026-10-20-validation.json，不冒充本轮新测试。
