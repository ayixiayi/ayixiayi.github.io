---
title: agentrc
slug: agentrc
subtitle: 像 .bashrc 一样，只补编码 Agent 缺的那一层。
summary: 编码 Agent 的个人配置层，像 .bashrc 一样只补 Amp、Claude Code 与 Codex 没有的部分：危险命令拦截、AI 审批与共享偏好。
tags:
  - TypeScript
  - Amp
  - Claude Code
stack:
  - TypeScript
  - Amp
  - Claude Code
  - Codex
repo: https://github.com/ayixiayi/agentrc
motif: orchestration
status: active
period: 2026 — 至今
order: 2
featured: true
milestoneDate: 2026-10-08
highlights:
  - 统一危险命令拦截规则，减少高风险终端操作失误
  - 在需要人工把关的步骤引入 AI 审批辅助
  - 跨 Amp、Claude Code 与 Codex 复用同一套个人偏好
---

## 问题

同时使用 Amp、Claude Code 与 Codex 时，每个编码 Agent 都有自己的配置入口和默认行为。安全边界、常用审批习惯与个人协作偏好分散在不同工具里，切换工具时往往要重复配置，也容易遗漏危险命令的防护。

## 方案

`agentrc` 不试图再包一层庞大的编排框架，而是像 `.bashrc` 一样作为轻量个人配置层，只补足现有编码 Agent 没有默认提供的三块能力：

- **危险命令拦截**：在执行破坏性或越界命令前先做拦截与校验。
- **AI 审批**：对边界模糊的操作给出风险判断，降低重复确认的噪音。
- **共享偏好**：将跨工具通用的个人约定收拢到同一处维护，供 Amp、Claude Code 与 Codex 共同读取。

## 设计原则

保持克制与可拆卸：模型和官方 CLI 迭代很快，个人配置层只保留长期稳定、与具体 Agent 解耦的规则与安全边界。
