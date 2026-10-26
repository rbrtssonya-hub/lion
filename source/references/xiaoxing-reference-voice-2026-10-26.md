# 小醒用户参考音色接入记录

用户提供 `F:/数媒竞赛/音频/小醒解说员音色.mp3`，追加要求下载 GitHub GPT-SoVITS 并继续接入。真实生成试听后，用户于 2026-10-26 回复“可以用这个音色”。此前 Qwen3-TTS skill 已安装，但路线被用户改为 GPT-SoVITS，现用音频没有使用 Qwen 或系统语音生成。

## 原件、参考与认可试听

- `source/characters/xiaoxing/voice/reference.mp3` 原字节复制，487326 字节，SHA-256 `9c5a4f87f24095c4a4329d79417629c47279777351188a639deb7529464cda5f`。
- `reference.wav` 为开头 0–7.2 秒，在自然停顿处结束，32kHz 单声道 PCM16；未变调。SHA-256 `895ba3a3b045422e385bff4177988fe1ad1729257fd0ae770b161e8f2526c0c0`。
- `approved-audition.wav` 是用户听后认可的准确文件，文本为“你好呀，我是小醒。让我陪你一起走进醒狮的世界吧。”，SHA-256 `21e51142e783526f129b6a0abfcae514475f16791eae92cd877f74def0a09c2e`。认可决定保存在 `approval.json`。
- 批量生成的 `sample.wav` 与首次认可试听分别保存，不能把后来重生成文件冒充原试听。文本、实际朗读文本、时长、字节和 SHA 在 `profile.json`。

## 实际安装与恢复

官方源码 [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) 安装到工程外 `F:/AI-Tools/GPT-SoVITS`，revision `b4570b876f5c086819ba84e3215472733c6a7b70`。这是独立本地推理程序。本轮用 v2ProPlus 预训练模型进行 zero-shot 推理，没有微调专用模型；参考转写为空、seed42、speed1。

Python3.12.14 的两个环境分别为 `F:/AI-Tools/xiaoxing-tts/.venv` 和 `.venv-cpu`。CUDA 环境使用 torch/torchaudio `2.7.1+cu128`，CPU 环境使用 `2.7.1+cpu`；GPU 实测 NVIDIA GeForce RTX 5060 Laptop 8151MiB。推理清单在 `scripts/xiaoxing/gpt-sovits-requirements.txt`，固定 numpy1.26.4、librosa0.10.2、transformers4.51.3，matplotlib<3.11；显式包含 python-multipart。没有安装完整训练和 Gradio 栈。

模型来自[官方分发仓库](https://huggingface.co/lj1995/GPT-SoVITS/tree/main)，revision `8f8857563c040d542de108a2c18b0425abd6c9c5`，安装到 `GPT_SoVITS/pretrained_models/`：

```text
chinese-hubert-base/config.json
chinese-hubert-base/preprocessor_config.json
chinese-hubert-base/pytorch_model.bin
chinese-roberta-wwm-ext-large/config.json
chinese-roberta-wwm-ext-large/pytorch_model.bin
chinese-roberta-wwm-ext-large/tokenizer.json
s1v3.ckpt
v2Pro/s2Gv2ProPlus.pth
sv/pretrained_eres2netv2w24s4ep4.ckpt
```

上述9文件共1303247442字节，外部下载记录在 `F:/AI-Tools/xiaoxing-tts/gpt-sovits-model-provenance.json`。还需 `GPT_SoVITS/text/G2PWModel/` 完整模型及词典、`GPT_SoVITS/pretrained_models/fast_langdetect/lid.176.bin`，后者131266198字节、SHA-256 `7e69ec5451bc261cc7844e49e4792a85d7f09c06789ec800fc4a44aec362764e`。[GPT-SoVITS 分发资源镜像](https://huggingface.co/XXXXRT/GPT-SoVITS-Pretrained/tree/main)也提供 G2PW 和语言模型。中文推理仍会调用语言切分，`all_zh` 不代表无需语言检测文件。

Windows jieba-fast 使用官方分发包中的 Python3.12 wheel（已列入依赖清单）。NLTK `cmudict`、`averaged_perceptron_tagger`、`averaged_perceptron_tagger_eng` 已放 `runtime/nltk_data/`；FFmpeg 放引擎 `runtime/ffmpeg.exe`。所有 Python、模型、缓存和工具均未纳入工程提交。

GPU、CPU 配置分别为 `gpt-sovits-v2proplus.yaml`、`gpt-sovits-v2proplus-cpu.yaml`。`.env.xiaoxing.local` 配置外部路径；`npm run assistant:voice` 把配置解析成绝对路径，以引擎目录为 cwd 启动 api_v2，默认监听127.0.0.1:9880。用法见 `docs/XIAOXING_AI.md`。

## 已生成与实现

固定讲解按现行 `knowledge.js#chapterGuides` 生成：entry42.70秒、model40.68秒、action40.30秒、state46.98秒、spread31.60秒。它们是“序／造／舞／传”四章的五处讲解上下文，state 属舞章子页。五段和新 sample 实际由 CPU 服务生成；全部候选完成验证才 `--apply`，网页 WAV 均32kHz、单声道、PCM16。独立单词 AI 朗读为“人工智能”，`spokenText` 记录差异。

固定讲解直接读取本地 WAV；动态回答通过同源 `POST /api/xiaoxing/speech`，Node 固定参考、中文参数与 seed42，限制来源、输入、并发、响应和等待。前端由真实 onplaying 驱动状态及音量压低；准备、停止、失败、切章、后台、卸载均回收请求、Audio 和 Blob URL。收起聊天不停止已启用的语音。声音不可用时保留文字，不切换系统音色。

停止网页声音不保证引擎立即中断推理；后端在结果返回或等待超时前保留占用并丢弃结果。超时只约束 Node 等待，不能据此声称取消 GPU 执行。DeepSeek API 仍延期，EXE 仅更新打包源码，没有重打包或新版实测。

## 本轮验证

环境为 Windows、Node24.20.0、Chrome、隔离分支 `codex/xiaoxing-reference-voice-2026-10-26`，起始基线 `e2e637c` 加本轮工作区；合并最新主线后的验证见工程日志。

- `npm test`：125/125 通过；真实 HTTP 检查覆盖输入、来源、超时、断连占用、有效 WAV、大小限制与便携源码复制。
- `npm run build`：成功，仅既有大 chunk 提示。
- `npx playwright test tests/e2e/xiaoxing.spec.js --config scripts/xiaoxing/playwright.config.mjs --output tmp/xiaoxing-reference-voice/production-focused`：13/13 通过（独立42829生产预览）。旧标题和首页来源断言已按现行实现校正。
- `npx playwright test --config scripts/xiaoxing/playwright-voice.config.mjs`：5/5 通过（42833，Chrome 真实解码 WAV，模型使用夹具；检查取消、失败、回收、五处固定音频及长文本）。
- **真实显卡与生产浏览器链路**：42835生产页面、不使用路由模拟。本地问答实际调用 GPT 显卡服务，返回200 audio/wav、1388844字节、21.7秒；暖机后该次点击至Blob播放5412ms。固定和动态均收起聊天后继续、常驻停止有效、无pageerror。WAV、JSON及两张1920截图在 `source/reviews/xiaoxing/2026-10-26/voice/`，两图已查看。

验收脚本最初通过 DevTools 读取二进制响应得到空 buffer，改为导出 Chrome 正在播放的实际 Blob 后完成原断言；产品没有因此修改。GPU另经Node直接请求验证返回200、有效RIFF。旧组合配置首跑含四章重构前的首页四展板用例，失败未计作本次声音通过项；未声称全仓 E2E 全部通过。
