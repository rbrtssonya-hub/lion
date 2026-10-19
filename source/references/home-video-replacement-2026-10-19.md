# 首页入场与后续循环视频替换

用户要求第一个视频用于入场，第二个用于后续循环，并追加本次提交到独立分支、不合并main。实现基线为F盘main 1903cf0，新分支codex/replace-home-videos-2026-10-19，C盘旧worktree不改。

| 用途 | 用户源文件 | 网页路径 | 实际字节 | SHA256 |
| --- | --- | --- | ---: | --- |
| 首次入场 | F:/数媒竞赛/醒狮素材/入场视频.mp4 | assets/intro/entry-intro.mp4 | 17701673 | e6f0ec2828ccc9f8d637d15ab3f648c0d6161a9c6a228bce206761cfd2a4eb4e |
| 后续循环 | F:/数媒竞赛/醒狮素材/循环视频.mp4 | assets/entry/home-lion-loop.mp4 | 33463217 | 93353de8e2da20d96e54654dea3735f6cc60c5cbe092cc3fb3dd658cbc0944f9 |

两文件按原字节复制，无裁切、无重新编码、不改音轨和用户原件。当前media/assetPaths键及播放逻辑不变：首次入场结束后切换loop；跳过、手动重播、会话内不自动重复、离页暂停仍由原useEntryPlayback/VideoStage维护。保留默认静音。不是动作页四段视频接入，不改变动作页的待接入标记。

旧运行视频先逐字节归档并核对哈希，再覆盖网页版本：

- source/video/intro/entry-intro-before-2026-10-19.mp4：4925718bytes，ccce0a6ac43996d2521ceb795494351903e758a283b004bd490c0c593fb468cb。
- source/video/entry/home-lion-loop-before-2026-10-19.mp4：8059565bytes，b525b4f755fd464997f3792a5b06630c6b7fc09c9f77a5c68e4a0fa86d33ba1c。

两条旧清单只迁移path到归档，保留from/bytes/hash，其他既有资产不变；追加两条新运行记录。归档不部署。

## 实际解码与范围

源文件通过本机已安装Chrome真实解码：两者2560×1440、16:9，MP4 sample entry为hvc1（HEVC）及mp4a（AAC）；入场7.407007秒、循环14.000998秒，均实际推进播放、解出视频帧及音轨字节。浏览器页面沿用静音设置，并不默认播放声音。此证据不能推断所有电脑/浏览器都支持HEVC，不宣称已转H.264；跨设备兼容版本需另行授权制作。

网页实际自然结束、循环回绕、跳过/重播/会话和开发生产回归各8/8通过；资产40/40、257模块生产构建成功，实际命令与范围见[本轮工程日志](../../wiki_memory/日志/UI修改/2026-10-19-首页入场与循环视频替换.md)。未把元数据读取或合成ended事件当成自然播放验收。

生产真实播放截图：[入场](../reviews/home/2026-10-19-video-replacement/entry-1920.png)、[循环](../reviews/home/2026-10-19-video-replacement/loop-1920.png)。两张只归档审查，不部署为页面背景。
