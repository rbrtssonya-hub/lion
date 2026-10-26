# 小醒问答接入

小醒优先检索工程内的四章讲解资料，使用资料原有的结构示意、AI辅助创作和定性观察表述。当前用户选择稍后配置 DeepSeek API；未配置时返回真实的本地讲解，不显示为模型生成。

## 开发与生产预览

`npm run dev` 与 `npm run preview` 均在 Node 端提供 `POST /api/xiaoxing/chat`。纯静态托管 `dist` 时需要将这个路径反向代理到下述独立服务；静态文件本身不提供服务端 API。

将根 `.env.xiaoxing.example` 复制为 `.env.xiaoxing.local`，在本机填写 `XIAOXING_AI_BASE_URL`、`XIAOXING_AI_MODEL`、`XIAOXING_AI_API_KEY`，然后重启 Node 服务。该文件须保持未提交状态。配置不使用 `VITE_` 前缀，不进入浏览器构建和 EXE；响应也不返回密钥、上游错误正文或配置值。

按 2026-10-26 查阅的 [DeepSeek Chat Completions 官方文档](https://api-docs.deepseek.com/api/create-chat-completion/)，接口采用 `POST /chat/completions`，支持 `response_format: {"type":"json_object"}`。当前文档列出的模型包括 `deepseek-flash` 与 `deepseek-v4-pro`，示例使用前者；启用 API 时应核对账户实际可用模型。模型名保持可配置，不依赖历史别名。DeepSeek 请求使用非思考模式以适合短篇展览讲解。

## 独立问答服务

使用工程规定版本的 Node 运行：

```powershell
node scripts/assistant/server.mjs
```

默认仅监听 `127.0.0.1:8787`。部署服务器可通过 `XIAOXING_HOST=0.0.0.0` 监听，并在反向代理提供 HTTPS。将实际网页地址填入 `XIAOXING_ALLOWED_ORIGINS`，多个地址逗号分隔，不使用通配符；同域反向代理也需配置实际 HTTPS 来源。可选 `XIAOXING_ACCESS_TOKEN` 适用于服务端到服务端访问，应放在调用方服务环境中。

接口请求为 `{ "question": "讲解本页", "chapter": "model", "history": [] }`，讲解位置接受 `entry/model/action/state/spread`。响应为 `{ "answer": "...", "sources": [{ "id": "...", "label": "...", "chapter": "model" }], "mode": "local或online", "reason": "本地回退原因，可省略" }`。问题最多1000字，请求最多16KB；单进程按IP每分钟20次，公开部署还应在网关配置配额和访问控制。默认不持久化对话、问题或模型回复。

检索不到资料时直接返回未收录说明。检索到资料且模型已配置时，服务只将命中资料和最多6条、每条500字的历史发送给模型。模型返回 JSON 的资料ID，服务仅接受本轮检索到的ID并重新生成可信来源对象；模型任意返回的URL不会成为来源链接。输出JSON损坏、无有效来源、被截断、上游失败或默认15秒超时均返回本地答案。来源约束能过滤不受支持的引用；真实模型的事实准确性仍需配置后人工验收。

## 用户选定音色与本地 GPT-SoVITS

2026-10-26 用户提供《小醒解说员音色.mp3》，听过真实生成试听后确认“可以用这个音色”。固定讲解已替换为 GPT-SoVITS v2ProPlus 合成的五段 WAV，覆盖四章中的 `entry/model/action/state/spread` 五处位置；动态问答也通过同一参考音频合成。认可试听、参考原件、片段及逐文件哈希见 `source/characters/xiaoxing/voice/`。DeepSeek 仍按用户计划延期，语音合成与问答模型分别配置。

本机已从[官方 GitHub](https://github.com/RVC-Boss/GPT-SoVITS)下载程序到 `F:/AI-Tools/GPT-SoVITS`，不是 Codex 内置插件。模型、Python 和缓存保存在工程外，不随网站或 Git 提交。使用预训练模型和 7.2 秒参考音频直接推理，没有训练专用模型，也没有通过变调替代音色。

本机 `.env.xiaoxing.local` 的有效配置如下，路径因机器而异；不要把本地配置加入版本管理：

```dotenv
XIAOXING_GPT_SOVITS_ROOT=F:/AI-Tools/GPT-SoVITS
XIAOXING_TTS_PYTHON=F:/AI-Tools/xiaoxing-tts/.venv/Scripts/python.exe
XIAOXING_TTS_CONFIG=scripts/xiaoxing/gpt-sovits-v2proplus.yaml
XIAOXING_TTS_PORT=9880
XIAOXING_TTS_URL=http://127.0.0.1:9880/tts
XIAOXING_OFFLINE=1
```

在工程根目录打开两个终端，分别运行：

```powershell
npm run assistant:voice
npm run dev
```

第一个终端常驻加载模型，监听本机 `127.0.0.1:9880`；第二个终端启动带问答与语音接口的网页。生产预览用 `npm run build` 后 `npm run preview`。批量重建固定讲解时另开 `node scripts/assistant/server.mjs`，再运行 `npm run assistant:narration -- --apply`，具体见声音素材 README。关闭语音服务后，五段固定讲解仍可播放，新的动态回答保留文字并显示声音暂不可用。

当前 CUDA 环境为 Python 3.12.14、torch/torchaudio 2.7.1+cu128，已在 RTX 5060 Laptop 8GB 实测。CPU 环境位于 `F:/AI-Tools/xiaoxing-tts/.venv-cpu`，切换 Python 路径和 `gpt-sovits-v2proplus-cpu.yaml` 即可；固定音频实际由 CPU 环境生成。重装时先安装对应 PyTorch，再安装 `scripts/xiaoxing/gpt-sovits-requirements.txt`，模型、G2PW、语言检测与 NLTK 资源清单见[本轮来源和环境记录](../source/references/xiaoxing-reference-voice-2026-10-26.md)。当前清单是推理依赖，不包含训练、WebUI 和伴奏分离工具。

同源 `POST /api/xiaoxing/speech` 仅接受 `{ "text": "需要朗读的文字" }`，最长 1,200 字、请求最多 16KB。参考、模型及上游地址由服务端固定；服务限制来源、每分钟请求数、单任务并发、最大 20MB WAV 与默认 120 秒等待时间。网页先显示准备状态，真实开始播放后才压低页面声音；收起聊天仍继续，常驻喇叭可停止准备或播放。切章、页面后台及卸载会清理声音和迟到结果。服务失败不改用系统女声。

官方引擎不会因网页断开立即取消正在执行的模型任务。Node 会接收并丢弃已取消请求的结果，在结果返回或等待超时前保留占用，避免正常等待期间反复点按堆积任务；超时不代表 GPU 推理已中断。

## EXE

新的打包脚本会将问答处理器和本地资料明确列入 Electron 应用包。渲染器保持 `sandbox/contextIsolation` 和仅本地网络规则，通过同源 `/api/xiaoxing/chat` 请求本地 Node 服务。Node 服务再访问环境变量指定的固定 HTTPS 问答网关，保持网页图片、视频、模型均本地加载。

公开分发 EXE 时只配置自己的 `XIAOXING_GATEWAY_URL`，值为完整的 `https://你的服务/api/xiaoxing/chat`。提供方密钥保存在网关服务器；需要服务间授权时，启动端可配置 `XIAOXING_GATEWAY_TOKEN`。不将正式提供方密钥分发给观众。开发机可以临时使用进程环境中的提供方配置进行联调，但构建脚本不会复制该配置。

`--offline` 或服务环境 `XIAOXING_OFFLINE=1` 强制本地问答，并在任何网关/模型请求之前生效。离线模式也继续拒绝外部资料出口。网关未配置、网络不可用、服务故障时仍保留本地资料和预设问题。单独的旧 EXE 不会随源码改变，实际交付需要重新打包。

打包源码已加入语音处理器和独立于 `app.asar` 的参考 WAV，供外部 Python 读取。此次没有重新生成 EXE；模型服务也没有捆绑进 EXE。新 EXE 的固定语音可随网页资产离线播放，动态合成仍需本机 GPT-SoVITS 服务，须在正式打包后补验。

## 验证边界

`node --test tests/assets/xiaoxing-server.test.mjs` 使用真实本地 HTTP 服务和模拟上游验证请求契约、来源过滤、故障/离线回退、请求限额及跨来源拒绝；它不等于真实 DeepSeek 联调。真正配置密钥后还需在开发、生产预览和最终 EXE 中分别验证模型回答、网络中断、来源跳转和关闭清理。当前阶段不发送付费模型请求、不部署外部服务。

本次实际显卡推理及 Chrome 生产播放结果保存在 `source/reviews/xiaoxing/2026-10-26/voice/capture.json`：固定讲解与真实动态回答均播放、收起聊天后继续、停止有效，无页面异常。动态回答生成 21.7 秒 WAV，暖机后该次点击至播放约 5.9 秒；此单次测量不代表所有文本耗时。模拟服务浏览器用例另外覆盖取消、失败与资源回收，不代替真实音色验收。
