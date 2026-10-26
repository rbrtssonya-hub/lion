# 小醒问候与普通聊天修复

核实日期：2026-10-27。项目 `codex/xiaoxing-reference-voice-2026-10-26`，代码基线 `4a5d740`，修改尚未提交时完成下列验证。

## 原因

`scripts/assistant/api.mjs` 原先对每条用户消息都运行醒狮资料检索，并拒绝没有资料ID的模型回答。“你好”不会命中资料，普通聊天因此落到本地“暂未收录”回答。当前浏览器中有两个不同工作树提供的开发服务：`5173` 返回 `mode=local, reason=unconfigured`，说明该服务没读取集成工作树里的本机忽略配置；包含新代码与配置的 `5174` 才是本次验收入口。旧服务另有小游戏工作，未停止或改写。

## 修复

`knowledge.js` 公开醒狮/网站主题识别。服务将普通问候与一般闲聊分配到独立的桌宠提示词，允许空来源并由DeepSeek回答；本地知识问题和醒狮/网站事实仍走原资料检索与可信来源校验。模型不可用时，“你好”有小醒本地回应，普通聊天提示暂时无法连接；醒狮问题保留资料兜底。API网关和模型提供方都按相同规则接受一般聊天的空来源。

## 实际验证

- `5173` HTTP `POST /api/xiaoxing/chat`，问题“你好”：`mode=local`、`reason=unconfigured`，仍为旧服务行为。
- `5174` 同一真实模型请求：`mode=online`、`sources=[]`，DeepSeek返回小醒风格问候。
- 在Chrome打开 `http://127.0.0.1:5174/#/state`，展开桌宠、输入“你好”、发送后，聊天框出现`data-mode=online`的模型回答，来源计数0；捕获到的页面错误为0。
- `scripts/assistant/api.mjs`、`src/features/assistant/knowledge.js`通过Node语法检查；任务diff通过`git diff --check`。
- 未运行自动化测试套件或生产构建。未验证最终EXE、公开静态托管或其他设备。

本地 `.env.xiaoxing.local` 由当前集成工作树加载并保持Git忽略；密钥值未读取、写入记录或提交。
