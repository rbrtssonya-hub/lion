---
type: moc
status: active
updated: 2026-10-26
topic: memory-entry
sources: []
---

# 工程记忆导航

模式：`standard`，由用户于 2026-10-26 明确指定。采用五页当前状态、六类日志和独立维护工具；当前配置以 `.memory.json` 为准。

新会话先读维护协议，再读项目概览、当前约束、当前待办；需要实现细节时定位系统架构和已知问题，不默认通读历史。按模块和关键字使用 `rg` 检索，导航不复写事实页。

日常开发直接遵循项目内协议，不调用 wiki-memory Skill；仅用户明确要求记忆管理时使用 Skill。

- [记忆维护协议](AGENTS.md)
- [工作日志 MOC](日志/MOC_工作日志.md)

维护命令在项目根执行：导航条目变化时运行 `python wiki_memory/工具/memory.py index --project . --apply`；有记忆变更时收尾运行 `python wiki_memory/工具/memory.py check --project .`。初始化或模式升级使用 `check --require-ready` 替代普通检查。完整频率和授权规则见协议；每轮修改的 Git 提交要求见根目录 `AGENTS.md`。

<!-- wiki-memory:auto:start -->

## 当前状态

- [[当前状态/已知问题.md|已知问题]] — active
- [[当前状态/当前待办.md|当前待办]] — active
- [[当前状态/当前约束.md|当前约束]] — active
- [[当前状态/系统架构.md|系统架构]] — active
- [[当前状态/项目概览.md|项目概览]] — active

<!-- wiki-memory:auto:end -->
