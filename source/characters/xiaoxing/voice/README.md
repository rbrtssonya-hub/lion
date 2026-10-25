# 小醒的声音素材

选用本机已安装的 **Microsoft Yaoyao，zh-CN，Female，Adult** 中文女声。语音引擎为 Windows `System.Speech.Synthesis`，通过 PowerShell 7.6.5 调用。音色略微提亮，保持清晰、亲切的展览讲解感：SSML 音高 `+10%`、语速 `-3%`、音量 `92`，避免尖细的夸张童声处理。实际听感可先试听 [sample.wav](sample.wav)。

四章正式讲解的 SSML 源文件保存在本目录；文本直接读取 `src/features/assistant/knowledge.js` 的 `chapterGuides`。运行 WAV 保存在 `source/public/assets/xiaoxing/voice/`，由浏览器播放，不依赖观众电脑是否安装此声音或能否联网。`profile.json` 记录声音身份、参数、准确文本、文件大小及 SHA-256。

## 再生成

在安装了所选声音的 Windows 和 PowerShell 7 中执行：

```powershell
pwsh -NoProfile -File scripts/xiaoxing/build-narration.ps1
node --test tests/assets/xiaoxing-voice.test.mjs
```

Windows PowerShell 5.1 的旧 `System.Speech` 枚举只显示 Desktop 声音，未必能调用 Yaoyao；此次使用 PowerShell 7 中实际枚举可见的原生 Yaoyao。脚本严格检查声音名称、中文区域和女性属性，不会自动换成其他声音。重新生成将更新本组已生成的 WAV、SSML 与 profile。

## 动态问答与交互

四章固定讲解使用内置录音。动态问答仅选用浏览器提供的中文女性声音家族，优先 Xiaoxiao、Xiaoyi、Yaoyao、Huihui，并将音高设为 `1.08`、语速设为 `0.98`。当前设备没有匹配声音时，仍能播放固定讲解，并通过按钮说明动态问答暂不能以匹配音色朗读。不会取浏览器任意默认男声或英语声音。

语音初始关闭，由观众点击开启。关闭面板、切换章节、页面进入后台、停用语音或组件卸载都会结束播放。过期的音频 Promise 和语音事件不能重新启动已停止的讲解。

讲解期间，页面中正在播放且未静音的视频或音频暂时降到用户设定音量的 18%，减少背景声遮住人声。后续开始播放的媒体也会降低。讲解结束或停止时恢复音量；若用户在讲解时调整音量，则以新设定为基准，保留用户的静音选择。未连接到页面 DOM 的讲解录音自身不会被降低。

## 已执行检查

`node --test tests/assets/xiaoxing-voice.test.mjs`：3/3 通过，覆盖中文女性音色筛选及优先顺序、拒绝任意默认声音、固定讲解的准确文本匹配、WAV 格式与有效非静音信号、原生声音元数据、源文本与 SHA-256。录音使用 PCM 16bit、22,050Hz、单声道；完整讲解时长约 30–35 秒，试听片段约 5 秒。波形与配置检查不等于人工听感已经确认。
