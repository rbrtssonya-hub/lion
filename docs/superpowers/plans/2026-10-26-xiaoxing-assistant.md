# 小醒桌宠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现以选定Q版醒狮服装少女为形象、可拖动、可讲解四章、具有独立面部动画并预留DeepSeek问答的桌宠。

**Architecture:** React维护桌宠状态、对话与拖动；对齐的PNG部件由可编辑SVG/分层包导出。可信知识同时用于本地兜底和服务端检索，Node同源接口隔离提供商密钥，Electron保留本地渲染器网络限制。

**Tech Stack:** React 19 / Vite / Node标准库 / CSS / SVG与PNG / Playwright。

**Spec:** `docs/superpowers/specs/2026-10-26-xiaoxing-assistant-design.md`

## Global Constraints

- 电脑端验收，保留当前章节和入场流程；保留原App格式修改、`.superpowers/`与其他任务内容。
- DeepSeek真实API配置由用户明确延期；服务默认本地模式，禁止打包密钥。
- 来源/AI辅助/结构示意边界准确；减少动态与资源回收完整。
- 声音须符合清亮亲切年轻女声的角色设定，避免任意系统声音回退。

## Review Focus

- 拖动取消、窗口缩小和键盘移动均不使角色不可达。
- 头像动效露底、叠层边缘与头脸漂移须检查实际像素。
- 跨章节答案与来源确实可达，首页隐藏展板不能只scroll到隐藏锚点。
- 断网、无配置、错误上游、超时与强制离线均返回可信本地内容。
- 朗读结束/切章/收起/隐藏时停止播放，避免BGM和解说混乱。

## Tasks

- [x] 素材：保存获选图与修复底图，独立眼/眉/嘴/头/身体，导出SVG与分层包、运行PNG，登记清单与media。
- [x] 知识：从四章源码建立条目、问题与可信来源，验证改述、未知和事实边界。
- [x] 界面：头像状态机、指针拖动与约束、非模态对话框、来源导航、章节上下文、文字与语音讲解。
- [x] 服务：同源API、DeepSeek兼容适配、网关与Electron包装、超时与本地兜底、HTTP测试。
- [x] 集成：挂载App、生产构建、桌面浏览器视觉/拖动/四章/动效/语音验证，修复实际发现。
- [x] 交付：同步wiki_memory、独立审查、差异核对、只暂存任务路径，提交推送并核对远端SHA。
