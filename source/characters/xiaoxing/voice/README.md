# 小醒的声音素材

小醒现使用用户于 2026-10-26 提供的《小醒解说员音色.mp3》作为声音参考，通过本机 **GPT-SoVITS v2ProPlus** 为新文本合成语音。用户听取生成试听后回复“可以用这个音色”。当时认可的准确文件单独保存为 [approved-audition.wav](approved-audition.wav)，决定、文本和文件 SHA-256 保存在 [approval.json](approval.json)；它与后来批量生成的 [sample.wav](sample.wav) 分开留存。

这是以预训练模型和参考音频进行的 zero-shot 推理，**没有训练专用声线模型**。参考 MP3 保留用户原始字节；[reference.wav](reference.wav) 是其开头 0–7.2 秒的单声道 WAV，没有变调。参考转写为空，固定随机种子为 `42`。现用生成器为 [build-gpt-narration.mjs](../../../../scripts/xiaoxing/build-gpt-narration.mjs)，不再使用历史 `System.Speech` 录音脚本生成现用素材。

## 现用素材与来源

[profile.json](profile.json) 保存原始 MP3、参考片段、已认可试听、模型源码和权重 revision，以及每段生成音频的原文、实际朗读文本、时长、字节数和 SHA-256。网页仍显示原有 `AI` 表述；送入语音模型时将独立单词 `AI` 读作“人工智能”，差异记在 `spokenText`。

| 讲解位置 | 所属章节 | 网页运行文件 | 时长 |
| --- | --- | --- | ---: |
| `entry` | 序／入境 | `source/public/assets/xiaoxing/voice/entry.wav` | 42.70 秒 |
| `model` | 造／观形 | `source/public/assets/xiaoxing/voice/model.wav` | 40.68 秒 |
| `action` | 舞／动作 | `source/public/assets/xiaoxing/voice/action.wav` | 40.30 秒 |
| `state` | 舞／神态 | `source/public/assets/xiaoxing/voice/state.wav` | 66.52 秒 |
| `spread` | 传／狮行远方 | `source/public/assets/xiaoxing/voice/spread.wav` | 31.60 秒 |

以上是四章中的五处讲解位置。2026-10-26 初版五段讲解与 `sample.wav` 由本机 CPU 版 GPT-SoVITS v2ProPlus 生成。2026-10-28 神态页接入纵深 V7 后，只用同一获批参考音色和现有 CUDA 环境重生成 `state.wav`，同步滚轮纵深、左目录、三秒五官后当前态解读、自动巡游及默认十二秒阅读等现行操作；其余四段、sample、参考与认可试听原字节保持。新段共 4,257,324 字节，66.52 秒，准确文本、SHA 与单章生成时间见 `profile.json` 的 state 记录。所有固定讲解格式均为 **WAV / PCM 16-bit / 32,000 Hz / 单声道**。固定 WAV 可离线播放，不需要观众电脑安装 Python、模型或系统中文声音。参考、认可试听、profile 与历史 SSML 属于创作源资料，只有五段网页讲解进入部署资产。

## 动态回答与播放交互

动态回答由网页向同源 `POST /api/xiaoxing/speech` 发送文字，Node 服务再用固定参考音频调用本机 GPT-SoVITS。动态合成需要本地模型服务运行；服务不可用时保留文字并说明声音暂不可用，不用系统女声替代选定音色。DeepSeek 问答 API 仍未启用，本地资料问答和语音合成分别运行。

语音初始关闭，由观众主动开启。桌宠旁常驻喇叭可播放或停止当前讲解，也可在“正在准备声音”时取消；收起聊天框后继续讲解。切换章节、页面进入后台、停用语音或组件卸载会停止网页播放并丢弃迟到结果，回收 Audio、请求与对象 URL。长回答只朗读前 1,200 字，按钮会说明范围。

停止网页播放不保证立即中断官方引擎正在执行的 CPU/GPU 推理。Node 继续接收已放弃请求的上游结果，在结果返回或等待超时前保留单任务占用，期间拒绝新的动态合成，避免正常等待期间反复点按堆积任务。等待超时只限制 Node 等待时长，不代表底层模型已停止。

讲解实际开始播放时，页面 DOM 中正在播放且未静音的音视频暂降到用户音量的 18%；结束或停止后恢复。用户期间更改音量或静音时保留其选择。准备语音期间不会提前压低背景声音。

## 重建与检查

两套 Python 环境、模型目录和启动步骤见 [小醒问答与语音接入](../../../../docs/XIAOXING_AI.md)。先启动 GPT-SoVITS 和独立 Node 服务，再在工程根目录运行：

```powershell
npm run assistant:narration
npm run assistant:narration -- --apply
# 只更新一章时保留其他四章与 sample 的录音及原档案记录：
npm run assistant:narration -- --chapter state --apply
node scripts/xiaoxing/register-assets.mjs
node --test tests/assets/xiaoxing-voice.test.mjs tests/assets/xiaoxing-speech.test.mjs
```

默认从 `http://127.0.0.1:8787/api/xiaoxing/speech` 获取音频；其他地址通过进程环境变量 `XIAOXING_NARRATION_API_URL` 指定。第一次命令把完整候选批次放在 ignored 的 `tmp/xiaoxing-reference-voice/`；全部成功并核对后，`--apply` 才替换网页音频与 profile。生成器会核对已认可试听和当前参考片段的哈希，不能静默更换参考文件。

`--chapter state` 只请求并应用选定一段，更新 profile 中该章的文本与真实 WAV 哈希；其他记录及 sample 保持原值。单章模式使用前也核对现有 profile 的参考哈希和引擎，不能用旧录音或改写 metadata 冒充新文本。2026-10-28 实际单章命令已成功，Node→现有 GPT-SoVITS CUDA 接口返回真实 WAV；没有改用系统声线或 Qwen。

本轮真实 GPU 合成和 Chrome 播放证据见 [参考音色接入记录](../../../references/xiaoxing-reference-voice-2026-10-26.md)。旧 SSML、`build-narration.ps1` 及此前系统声音选型仅为历史资料。现有旧 EXE 尚未重新打包。
