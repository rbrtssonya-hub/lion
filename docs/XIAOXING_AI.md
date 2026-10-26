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

接口请求为 `{ "question": "讲解本页", "chapter": "model", "history": [] }`，章节仅接受 `entry/model/action/state`。响应为 `{ "answer": "...", "sources": [{ "id": "...", "label": "...", "chapter": "model" }], "mode": "local或online", "reason": "本地回退原因，可省略" }`。问题最多1000字，请求最多16KB；单进程按IP每分钟20次，公开部署还应在网关配置配额和访问控制。默认不持久化对话、问题或模型回复。

检索不到资料时直接返回未收录说明。检索到资料且模型已配置时，服务只将命中资料和最多6条、每条500字的历史发送给模型。模型返回 JSON 的资料ID，服务仅接受本轮检索到的ID并重新生成可信来源对象；模型任意返回的URL不会成为来源链接。输出JSON损坏、无有效来源、被截断、上游失败或默认15秒超时均返回本地答案。来源约束能过滤不受支持的引用；真实模型的事实准确性仍需配置后人工验收。

## EXE

新的打包脚本会将问答处理器和本地资料明确列入 Electron 应用包。渲染器保持 `sandbox/contextIsolation` 和仅本地网络规则，通过同源 `/api/xiaoxing/chat` 请求本地 Node 服务。Node 服务再访问环境变量指定的固定 HTTPS 问答网关，保持网页图片、视频、模型均本地加载。

公开分发 EXE 时只配置自己的 `XIAOXING_GATEWAY_URL`，值为完整的 `https://你的服务/api/xiaoxing/chat`。提供方密钥保存在网关服务器；需要服务间授权时，启动端可配置 `XIAOXING_GATEWAY_TOKEN`。不将正式提供方密钥分发给观众。开发机可以临时使用进程环境中的提供方配置进行联调，但构建脚本不会复制该配置。

`--offline` 或服务环境 `XIAOXING_OFFLINE=1` 强制本地问答，并在任何网关/模型请求之前生效。离线模式也继续拒绝外部资料出口。网关未配置、网络不可用、服务故障时仍保留本地资料和预设问题。单独的旧 EXE 不会随源码改变，实际交付需要重新打包。

## 验证边界

`node --test tests/assets/xiaoxing-server.test.mjs` 使用真实本地 HTTP 服务和模拟上游验证请求契约、来源过滤、故障/离线回退、请求限额及跨来源拒绝；它不等于真实 DeepSeek 联调。真正配置密钥后还需在开发、生产预览和最终 EXE 中分别验证模型回答、网络中断、来源跳转和关闭清理。当前阶段不发送付费模型请求、不部署外部服务。
