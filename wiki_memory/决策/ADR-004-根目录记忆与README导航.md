---
type: decision
status: active
updated: 2026-10-09
topic: standard-project-memory
supersedes: "[[决策/ADR-003-standard工程记忆.md]]"
sources:
  - "用户指令：2026-10-09 wiki_memory应直接位于工程根目录；有AGENTS.md与README.md即可"
  - "用户指令：2026-10-09 只取消入口.md，保留中文专题名称"
  - "AGENTS.md"
  - "README.md"
  - "docs/DEVELOPMENT.md"
  - "package.json"
  - "wiki_memory/.memory.json"
  - "wiki_memory/README.md"
  - "wiki_memory/AGENTS.md"
---

# ADR-004 · 根目录记忆与 README 导航

## 背景与授权

用户指出此前standard实践将记忆放在 `docs/` 下，并同时维护协议与独立导航文件，不符合期望；进一步明确只取消 `入口.md`，保留中文专题名称。本次显式授权同时整改lion实践与Skill框架。

## 已采用选择与理由

- 用户选择根 `wiki_memory/`，工程记忆与应用、文档目录分离；从原 `docs/wiki_memory/` 整体迁移现存材料，保全历史和工具，不重新init覆盖。
- `wiki_memory/README.md` 是唯一记忆导航，`AGENTS.md` 保留维护协议。根项目指令、开发说明、资源说明、npm维护脚本共同指向同一位置；不再维护独立 `入口.md`。
- 用户仍选 `standard`，五页分别维护目标/入口/工作区、架构/数据流/运行、约束、当前工作/下一步/恢复、问题/复现/验证缺口。中文专题名与已有ADR/知识保持，不把空标题当实战完成。
- Agent在本次授权范围中核实源码和工作区，区分本地未提交实现、原迁移历史测试与本次验证；配置升级schema2，导航README。工具3.0.0的索引与ready验收只做结构检测，仍需人工语义复核。

## 代价与适用范围

位置改变需要修正当前文档与命令引用。历史日志保留当时目录选择和测试结果，内部引用移到现存目标；ADR-003保留原选择正文并标superseded。网页架构、source分类与媒体字节不在本次变更范围。

本选择适用于lion当前工程记忆；不授权提交、推送、部署或扩展网站功能，也不把mySkills仓库的提交规则推广到lion。

以上是当时布局整改本身的授权范围。2026-10-09 用户后续另行明确 lion 的持续提交与 GitHub 推送约定，见 [[决策/ADR-005-完整对话修改提交与推送.md|ADR-005]]；根 `AGENTS.md` 已接入该新约定，布局选择继续有效。

## 实施与验证线索

当前配置为standard/schema2/README导航。检查根文档与 `memory:*` 命令、独立工具版本及五页证据，再运行统一索引、check与ready验收；实际结果记录于本次整改日志。后续从README恢复，已提交HEAD仍须与本地迁移分开核实。
