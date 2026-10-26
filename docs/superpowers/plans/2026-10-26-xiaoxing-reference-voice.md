# 小醒参考音色接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用用户提供的 `小醒解说员音色.mp3` 为小醒固定讲解与动态回答生成语音。

**Architecture:** 按用户追加指定，从官方GitHub下载 GPT-SoVITS，并使用v2ProPlus在本机CUDA运行。固定讲解生成网页音频；动态回答经过现有 Node 服务的同源 `/api/xiaoxing/speech` 转发至本机 GPT-SoVITS api_v2 合成服务，复用既有播放器、停止与页面音量压低机制。

**Tech Stack:** React 19, Node HTTP/fetch, Python 3.12, GPT-SoVITS v2ProPlus, PyTorch 2.7.1 CUDA 12.8。网页不增加 npm 依赖，模型/虚拟环境不入库。

**Spec:** 用户2026-10-26指定音频与“使用参考音频生成语音的功能skill”；此前常驻语音、关闭聊天后继续讲解的已批准交互。

## Global Constraints

- 参考音频为用户本地文件，SHA256 `9c5a4f87f24095c4a4329d79417629c47279777351188a639deb7529464cda5f`，不把直接播放样音当成生成新内容。
- 音色选定后不静默换回系统女声；生成不可用时保留文字并明确声音暂不可用。
- 仅电脑；保留关闭聊天持续讲解、主动停止、离章/隐藏/卸载清理、页面音量恢复。
- DeepSeek真实API仍延期；模型和运行库位于工程外 `F:/AI-Tools/xiaoxing-tts`。
- 任务起点main基线为 `e2e637c`；使用既有干净隔离工作树的新分支，保留C盘未提交内容。

## Review Focus

- 停止或切章后，迟到的生成结果不能自行开声。
- 对话框关闭不应停止已启用的常驻讲解。
- 请求仅接受有限文本，限制来源、并发、响应大小与等待时间。
- 五个当前导览文案使用同一参考音色，固定音频匹配现行文案。
- 本地服务未运行时不回退为不符合角色的浏览器默认声音。

### Task 1: 本地skill与实际音频（root）

- [x] 安装官方GPT-SoVITS、独立Python/CUDA环境与v2ProPlus最小推理模型；Qwen路线已被用户替代。
- [x] 以用户参考音频生成新文本试听并验证解码/时长/响度；保留实际来源。
- [x] 读取现行chapterGuides生成五段固定讲解，更新profile、运行路径与资产清单。

### Task 2: 同源语音接口（backend worker）

- [x] 先编写真实HTTP检查：有效WAV返回、错误输入/来源拒绝、超时/断连取消、上游失败不返回假音频。
- [x] 添加 `createSpeechHandler`，POST `/api/xiaoxing/speech`、JSON `{text}`；转发 `XIAOXING_TTS_URL`（默认本机9880的`/tts`），成功返回audio/wav。
- [x] 注册Vite/独立Node/portable入口与显式运行时复制清单；补充环境示例，执行定向测试。

### Task 3: 统一播放器（frontend worker）

- [x] 先编写浏览器检查：生成后Audio播放、准备中停止与迟到结果抑制、关闭聊天持续、服务失败无系统音色回退。
- [x] `useNarration`固定导览走新音频、动态文字走同源接口；清理AbortController和对象URL。
- [x] `voiceProfile`映射entry/model/action/state/spread；准备与播放共用常驻停止操作。

### Task 4: 合成本地服务与交付（root）

- [x] 使用官方api_v2常驻加载模型，Node端固定参考音频路径和中文参数，不接收前端自选参考或模型；启动配置不嵌入模型。
- [x] 实际网页验证固定和动态同音色、停止/切章/后台、关闭聊天、资源清理；运行适用核心/构建/浏览器检查。
- [x] 同步工程记忆、审查diff、仅提交本任务文件并推送授权分支；报告真实语音效果与运行条件。

## 实际进度与恢复（2026-10-26）

官方代码 b4570b8 与官方 v2ProPlus 权重已安装。CPU/GPU 两环境可推理；全部五处固定讲解及新 sample 已由 CPU 实际生成并应用。用户认可的第一次试听另存 approved-audition.wav，approval.json 保留决定与 SHA。GPT 显卡服务已在9880运行。

核心125/125、构建通过；小醒生产13/13、新语音Chrome5/5通过。真实显卡→生产网页→Blob播放验证通过：21.7秒动态回答、点击至播放约5.4秒，收起聊天继续/停止有效，无页面错误。详见 source/references/xiaoxing-reference-voice-2026-10-26.md 和声音审查 capture.json。旧组合测试中的首页四展板断言已过时，未作为本次声音通过项。

已合并最新主线514f61e，功能提交9f235bb、合并提交a729b31均已推送音色分支与GitHub main；远端SHA核对一致。组合树126/126、构建、生产13/13、真实显卡语音、896条资产和149页记忆检查通过。不得把原C盘 App格式或 .superpowers/、F盘根目录正在进行的小游戏改动纳入本任务。DeepSeek 与 EXE 实物仍未启用/重打包。
