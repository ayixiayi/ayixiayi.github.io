---
title: OpenMem
slug: openmem
subtitle: 一次部署约定，换个会话还能找回来。
summary: AI 编程 Agent 的长期记忆 MCP 服务器：按项目隔离、跨会话延续，默认完全离线运行。部分代码源自 CaviraOSS/OpenMemory，在此致谢。
tags:
  - TypeScript
  - MCP
  - AI Agent
stack:
  - TypeScript
  - MCP
  - SQLite
repo: https://github.com/ayixiayi/OpenMem
motif: memory
status: active
period: 2026 — 至今
order: 1
featured: true
milestoneDate: 2026-10-07
credits: 部分代码源自 CaviraOSS/OpenMemory，在此致谢。
highlights:
  - 按项目名称隔离存储，切换空项目不会串扰已有记忆
  - 基于本地 SQLite 与内置合成嵌入，默认完全离线运行
  - 通过 MCP 工具同时保存结构化事实与决策理由
sources:
  - label: 实测使用的 OpenMem 源码
    url: https://github.com/ayixiayi/OpenMem/tree/7751f4103e7251573e8f2db8ea5862bb0ca66059
  - label: 本站的部署配置
    url: https://github.com/ayixiayi/ayixiayi.github.io/blob/8c73c896bfe4d06547bc974c6e1e641dfc617d3f/.github/workflows/deploy.yml
---

## 实测：OpenMem 跨会话示例

用本站的 GitHub Pages 发布目录做一次跨会话项目记忆实测：本站构建后有两个目录。`dist/` 装的是正式网站，`dist-test/` 里还有 Playwright 测试文章。如果下一次会话要改部署流程，Agent 怎么知道该上传哪个目录，以及为什么？

## 第一次会话 · 记下发布约定

调用 `openmemory_store`，在项目 `ayixiayi.github.io` 下同时保存一条事实和一条决策。事实记录目录，决策解释原因。

> GitHub Pages 只发布 dist/。dist-test/ 含有 Playwright 测试文章，不能作为发布目录。

<details>
<summary>查看这次写入的 MCP 参数</summary>

```json
{
  "type": "both",
  "project": "ayixiayi.github.io",
  "observation_type": "decision",
  "content": "GitHub Pages 只发布 dist/。dist-test/ 含有 Playwright 测试文章，不能作为发布目录。",
  "facts": [
    {
      "subject": "pages",
      "predicate": "publish_dir",
      "object": "dist/"
    }
  ]
}
```

</details>

## 第二次会话 · 读回目录和理由

关闭第一个 MCP 进程，重新启动 OpenMem，沿用同一份 SQLite 数据库。新会话调用 `openmemory_wakeup` 时只传项目名，返回了下面两段内容。

```text
## Current Facts (1)
- pages · publish_dir: dist/

## Essential Context (1 memories)
[DECISION]
- GitHub Pages 只发布 dist/。dist-test/ 含有 Playwright 测试文章，不能作为发布目录。
```

把项目名换成另一个空项目后，这两条记录都没有出现。两次会话都使用本地 SQLite 和内置的合成嵌入。

## 致谢与边界

OpenMem 部分代码源自 [CaviraOSS/OpenMemory](https://github.com/CaviraOSS/OpenMemory)，在此致谢。项目聚焦按项目隔离、跨会话延续的本地离线记忆，不依赖外部云端向量服务。
