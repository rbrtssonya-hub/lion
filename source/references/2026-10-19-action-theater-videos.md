# 沉浸式动作页视频来源与接入核查

2026-10-19，用户明确指定素材目录 `D:/04_EdgeDownload/醒狮动作 (3)`。实际四段视频位于其下一级 `醒狮动作/`。部署副本保留原始 MP4 字节；D 盘源文件未修改。此记录取代本轮接入前“四段视频未提供”的素材状态，不改写先前离线 Blender 工程验收时的历史结论。

运行界面统一标记 **用户提供 · 动作演示素材**。四片画面均为风格化的红白醒狮与传统舞台；当前目录和媒体元数据没有可核实的创作方式说明，不能仅凭观感声称为现场实拍或已确认的 AI 生成。

## 视频与四屏对应

| 原文件名 | 动作 ID / 部署文件名 | 显示面 | 字节数 | SHA256 |
| --- | --- | --- | ---: | --- |
| 探青采青.mp4 | `tanqing.mp4` | `Screen_Tanqing` | 7,593,974 | `a458df1d7948870c8836deb9d9fb3f77e3e86fe685ccdfe4beaf7cfe7bf18143` |
| 抖毛.mp4 | `doumao.mp4` | `Screen_Doumao` | 6,159,115 | `aeeafd7520e55dbfe2b7101cf43d9f395b089741e801fa91e8bc4acc5d43b21a` |
| 狮子吐球.mp4 | `tuqiu.mp4` | `Screen_Tuqiu` | 6,519,176 | `464c2d9f91710cd2cd714a22584639ab6c131511ba63587007f4c39f84808650` |
| 踩梅花桩.mp4 | `meihuazhuang.mp4` | `Screen_Meihuazhuang` | 7,929,073 | `43d0663802f39c889cd5f1a37d2db60027f2996f1d5be60870889f25d177e866` |

四段部署文件均在 `source/public/assets/action/videos/`。全部为 2560 × 1440、16:9、24 FPS、8.000 秒，视频 H.264 High / yuv420p，音频 AAC LC / 32 kHz / 双声道。仅当前主屏允许发声；同一片段应保留播放位置，避免转向边界反复从头开始。播放器的浏览器验收另由网页任务记录，本文件中的解码通过不能代替浏览器播放验收。

## 内容核查

已分别查看按每两秒一帧提取的四帧接触表，并执行每段完整视频及音频解码。文件名与下列可见内容对应：

- **探青采青**：低姿靠近装有生菜与红包的矮盘，狮头试探后抬起，嘴部叼着绿色菜叶。
- **抖毛**：无球、菜盘或高桩道具，狮头左右摇转，身体及毛饰随之摆动。
- **狮子吐球**：口中出现红金色球体；球落地后，狮头低伏并向球体互动。
- **踩梅花桩**：红金色高桩围绕狮身，片段出现跨桩、落步与身体重心调整。

这些是对所给演示片段的观察，不据此认定真实表演者、流派、竞技难度或评分数据。正式简介限于上述可见内容。

## 视频同源海报

海报从各自 MP4 第 0.5 秒真实解码抽帧，使用 Lanczos 等比缩至 1280 × 720，JPEG `q:v 2`。没有 AI 生成、补画、道具合成、字幕或裁切。四张最终海报均已逐张查看，用于视频加载或不可播放时的对应画面；不能将静止海报显示视为视频已播放。

| 文件名 | 字节数 | SHA256 |
| --- | ---: | --- |
| `tanqing-poster.jpg` | 239,641 | `97797623d1ce2730ae2d1b18a5e1f977dc0d34f4644982049a4b0307918feacc` |
| `doumao-poster.jpg` | 236,762 | `9c606f8cf62c87d070a4cdb5cff6feed13056ca6f32763b60d961f205da60c44` |
| `tuqiu-poster.jpg` | 193,477 | `f86322ea17d60f8d01ecd863438affa6636559c2b188ce89bdd4d7bd31c45baa` |
| `meihuazhuang-poster.jpg` | 260,139 | `eac12867209074d3ad265e02fbbdacd5c848ecdaf9365e95a486938ce935755b` |

海报与视频同目录。结构化记录 [2026-10-19-action-theater-videos.json](2026-10-19-action-theater-videos.json) 保存逐文件原路径、部署路径、字节数、SHA256、原始 ffprobe 数据、完整解码退出码，以及每张海报所引用的视频 SHA256。临时四帧接触表保存在忽略目录 `tmp/action-video-audit/`，不进入网页部署资源。

## 实际验证与复核命令

执行工具为 `D:/SoftWare/FFmpeg-n8.0-latest-win64-gpl-shared-8.0/bin/ffprobe.EXE` 和同目录 `ffmpeg.EXE`。四段部署副本均与源文件 SHA256 一致；四段完整音视频解码退出码均为 0；四张海报抽帧退出码均为 0。

下列 PowerShell 示例仅用已核实的实际视频路径；修改 `$clipId` 可逐段复核：

```powershell
$clipId = 'tanqing'
$clipPath = Join-Path 'source/public/assets/action/videos' ($clipId + '.mp4')
& 'D:/SoftWare/FFmpeg-n8.0-latest-win64-gpl-shared-8.0/bin/ffprobe.EXE' -v error -show_streams -show_format -of json $clipPath
& 'D:/SoftWare/FFmpeg-n8.0-latest-win64-gpl-shared-8.0/bin/ffmpeg.EXE' -hide_banner -loglevel error -i $clipPath -f null NUL
Get-FileHash -LiteralPath $clipPath -Algorithm SHA256
```

抽帧实际参数为 `-ss 0.5 -i <原视频> -frames:v 1 -vf scale=1280:720:flags=lanczos -q:v 2 <对应海报>`。源文件先按已核实 SHA256 校验再复制；遇到既有部署 MP4 哈希不一致时拒绝覆盖，防止误替换其他素材。
