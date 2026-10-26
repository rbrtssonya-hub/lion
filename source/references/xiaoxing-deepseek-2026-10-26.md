# 小醒 DeepSeek 问答接入记录

## 用户决定与配置

用户先决定暂缓真实模型配置，完成方案后再提供 API；随后已在本机 `.env.xiaoxing.local` 填入 DeepSeek 密钥并通知继续。密钥只用 Node 进程读取，值不复制到聊天、项目文档、网页构建或 Git。该文件被 Git 忽略，仓库仅保留不含凭据的 `.env.xiaoxing.example`。

本机使用 `https://api.deepseek.com`、`deepseek-flash` 和 `XIAOXING_OFFLINE=0`。服务端在向模型发问前先从本地讲解资料检索；模型回答需返回本轮资料 ID，Node 再过滤并生成可信来源。密钥缺失、服务报错或来源无效仍走本地讲解。角色语音合成仍由独立 GPT-SoVITS 本地服务处理。

本次发现并修正章节许可列表缺少 `spread` 的问题，使问答接口接受与 UI 一致的讲解章节键。没有改动桌宠前端架构、语音管线或旧 EXE。

## 实际核验

- 配置检查仅打印 `DeepSeekKeyPresent=True`、`Offline=0`、`Model=deepseek-flash`，未读取或显示密钥内容；`.env.xiaoxing.local` 状态为 Git 忽略。
- 重启后的本地 Node 服务 `127.0.0.1:8788` 收到真实 DeepSeek HTTP 请求，问题“醒狮八态有哪些？”返回 `mode: online`、简洁讲解及本地资料来源。
- Chrome 生产预览 `127.0.0.1:42836/#/state` 真实提交“喜和乐有什么不同？”，HTTP 200；网页显示在线回答及“舞 · 八态观察”“舞 · 样本与视觉说明”两个本地来源，最终浏览器记录 `pageErrors: []`。
- 这是在线模型与页面通路的手动冒烟核验。本次小改后未重跑自动化测试套件或生产构建；未重打包 EXE，也未在 EXE 中验证联网。

## 官方接口依据

DeepSeek 官方 [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 和[接入指南](https://api-docs.deepseek.com/quick_start/agent_integrations/)记载 OpenAI 兼容的 Chat Completions 接口及当前示例模型。实现地址与模型名可由服务端环境配置；实际可用额度、密钥状态和模型权限以用户账户为准。
