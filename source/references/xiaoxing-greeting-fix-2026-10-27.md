# 小醒问候与普通聊天修复

核实日期：2026-10-27。项目 `codex/xiaoxing-reference-voice-2026-10-26`，代码基线 `4a5d740`，修改尚未提交时完成下列验证。

## 原因

`scripts/assistant/api.mjs` 原先对每条用户消息都运行醒狮资料检索，并拒绝没有资料ID的模型回答。“你好”不会命中资料，普通聊天因此落到本地“暂未收录”回答。最初主工作树的 `5173` 返回 `mode=local, reason=unconfigured`，因为DeepSeek忽略配置只存在于集成工作树，代码改动本身也尚未同步到主线。此后先将修复提交合入main，再把服务端所需的DeepSeek变量复制到主工作树的忽略文件并重启Vite。

## 修复

`knowledge.js` 公开醒狮/网站主题识别。服务将普通问候与一般闲聊分配到独立的桌宠提示词，允许空来源并由DeepSeek回答；本地知识问题和醒狮/网站事实仍走原资料检索与可信来源校验。模型不可用时，“你好”有小醒本地回应，普通聊天提示暂时无法连接；醒狮问题保留资料兜底。API网关和模型提供方都按相同规则接受一般聊天的空来源。

## 实际验证

- 配置复制和服务重启前，`5173` HTTP `POST /api/xiaoxing/chat` 对“你好”返回`mode=local`、`reason=unconfigured`。
- 重启主工作树服务并加载忽略配置后，`5173`的“你好”与醒狮八态问题均返回`mode=online`；问候来源数0，醒狮回答来源数2。
- Chrome打开 `http://127.0.0.1:5173/#/state`，展开桌宠并发送“你好”，聊天框显示`data-mode=online`，来源计数0，页面错误0。集成工作树的`5174`也曾完成同样的真实模型及UI验证。
- `scripts/assistant/api.mjs`、`src/features/assistant/knowledge.js`通过Node语法检查；任务diff通过`git diff --check`。
- 未运行自动化测试套件或生产构建。未验证最终EXE、公开静态托管或其他设备。

主工作树和集成工作树各有一份Git忽略的 `.env.xiaoxing.local`。仅复制服务端需要的DeepSeek配置键值到主工作树；密钥未显示在终端、未写入审查记录，也未暂存或提交。`git check-ignore`确认配置文件被忽略且不受跟踪。
