# 动作图鉴素材与接入边界

现行动作页为“左视频右简介＋四段长页＋讲解区唯一阶段目录”。用户于2026-10-15指出重复的小导航冗余，因此移除首屏底部的入场／探步／转身／收势导航及“向下读懂动作”提示，只保留下方讲解区的吸顶阶段目录。

保留的目录负责四段定位、当前阶段高亮、键盘操作与自然滚动联动；首屏编号、海报和简介仍同步当前阶段。四段配图、观察文案与正式视频待接入状态保持。2026-10-14批准的两个阶段导航属于此前方案，现已由此次要求替代。

## 参考画面

- 首屏参考归档：`source/design/action/action-hero-reference.png`，来自用户的“动作展示.png”。
- 四段参考归档：`source/design/action/action-detail-reference.png`，来自用户的“动作下滑界面新版.png”。
- 四张部署海报分别为 `source/public/assets/action/action-entry-poster.png`、`action-probe-poster.png`、`action-turn-poster.png`、`action-settle-poster.png`。
- 海报使用内置imagegen逐幅AI辅助提取/扩展为16:9，不是像素无损裁切，不是摄影或正式视频首帧；没有复制整页的标题、按钮、印章或背景到播放器。白红醒狮属于参考图的形象。
- 用户补充的“醒狮全身图.png”与现有 `media.poster`（`source/public/assets/poster/lion-full.png`）SHA256一致：`e58ee7dae46691e8d3f9ca55e746a90153532016b73c5e25dbd4bef0de8f6e27`。原文件未修改；红绒金彩形象作为海报加载异常的回退，不声称与参考图白红狮是同一素材。

提取提示词：仅提取参考图左侧第1/2/3/4矩形中的醒狮与祠堂场景，保留对应姿态、白红狮、鼓、柱子和暖光；移除外部UI/文字/金框；扩展场景至16:9以保留完整狮头、身体和脚。四张提示分别指定入场抬头、探步低姿、转身侧身、收势稳住。采用内置工具，未使用API/CLI或新增生成依赖。

## 视频接入

`src/features/action/actionClips.js` 是唯一片段目录；当前四条 `videoKey` 全为null。每条的id/name/lines/posterKey/videoKey/sourceNote用于首屏、四段讲解和唯一阶段目录。

获得真实四段文件后：核对动作内容/解码/画幅/音轨；原字节归档/部署并在asset-manifest登记；assetPaths增加对应视频键；将每条videoKey指向该键，更新sourceNote，并将海报替换成真实匹配首帧。应用从media解析基址，不猜测时长和动作时间点。

缺失时只展示参考海报，不创建空src的video，不请求首页或入场视频。测试夹具仅在Playwright拦截地址下将现有短视频字节作为“TEST MEDIA ONLY”注入真实ActionPage组件；夹具不进入运行资产或生产构建，不能代表四段正式视频验收。
