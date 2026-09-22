# ayixiayi · 个人网站

项目、随笔与代码生成的风景。线上地址：<https://www.ayixiayi.com>。

## 本地开发

需要 **Node.js >= 22.12.0** 和 npm。在仓库根目录运行：

```sh
npm ci
npm run dev
```

开发服务器默认位于 `http://localhost:4321`。依赖版本由 `package-lock.json` 锁定；修改依赖时请同步维护锁文件。

## 架构与维护入口

这是 **Astro 7 静态网站**：构建产物在 `dist/`，部署到 GitHub Pages，不需要应用服务器或数据库。浏览器脚本只负责搜索、交互和生成艺术等功能。

| 位置                                             | 用途                                      |
| ------------------------------------------------ | ----------------------------------------- |
| `src/pages/`                                     | 首页、项目、博客、关于及静态数据端点      |
| `src/data/site.ts`                               | 站点资料、导航、项目列表的统一数据源      |
| `src/content/blog/`                              | Markdown 文章                             |
| `src/content.config.ts`                          | 文章元数据校验                            |
| `src/lib/posts.ts`                               | 已发布文章筛选、排序、链接和阅读时间      |
| `src/layouts/`、`src/components/`、`src/styles/` | 页面框架、交互组件和样式                  |
| `src/art/landscape.ts`                           | p5 程序风景引擎                           |
| `public/`                                        | 原样复制到站点的图片、管理入口等资源      |
| `astro.config.mjs`                               | 静态输出、站点 URL、尾斜杠和 sitemap 配置 |

更换域名时，同时检查 `astro.config.mjs` 的 `site` 和 `src/data/site.ts` 的 `site.url`，避免 canonical、RSS 和 sitemap 地址不一致。

### 内容与站点功能

- 搜索索引在构建时生成到 `/search-index.json`，包含已发布文章的标题、描述、标签、正文，以及项目资料；搜索在浏览器内执行。
- `/rss.xml` 提供已发布文章订阅，sitemap 由 Astro 集成生成。
- 文章页面从 Markdown 标题生成目录（TOC），并显示发布日期、标签和估算阅读时间。
- Instrument Serif、Manrope 和 IBM Plex Mono 通过 Fontsource 随构建产物自托管，不依赖 Google Fonts 在线加载；中文使用系统字体回退。
- 页面不加载不蒜子（Busuanzi）统计，不展示访问量。

## 发布文章

在 `src/content/blog/` 新建 `.md` 文件，例如 `my-note.md`：

```markdown
---
title: '一篇新记录'
description: '用于列表、搜索和 RSS 的简短介绍。'
pubDate: 2026-09-22
tags: ['随笔', '开发']
draft: true
---

## 从这里开始

正文使用 Markdown，图片可以放在 `public/images/uploads/`，通过
`/images/uploads/example.webp` 引用。
```

`title`、`description`、`pubDate` 必填，`tags` 可选，`draft` 默认为 `false`。准备公开时设为 `draft: false`，构建后对应地址为 `/blog/my-note/`。

`getPublishedPosts()` 是公共内容边界：草稿不生成文章路由，也不进入博客列表、搜索索引和 RSS。**草稿不是保密机制**：文件仍在 Git 仓库中；不要写入密钥或私人材料。发布日期用于排序，不是定时发布开关。

### 保留的 Decap 管理入口

原有 `/admin/` 及 `public/admin/config.yml` 保留，使用 Decap CMS 的 GitHub backend，目标仍为本仓库的 `main` 分支，上传图片目录为 `public/images/uploads/`。管理页面会加载外部 Decap 脚本，并依赖原有 OAuth 服务。

**本地构建和测试不代表 Decap 登录、OAuth 服务或写入权限已验证。** 如登录不可用，可直接编辑 Markdown；不要为静态站点临时添加认证后端或把令牌写入仓库。

## 生成艺术与默认海报

首页显示静态海报，点击「重新生成」后按需加载 p5。绘制完成后调用 `noLoop()`，不持续播放动画。当前种子写入首页 URL，如 `/?seed=1847`；相同种子在同一渲染环境下生成相同图像。种子范围为 1–999999，无效参数保留默认海报。无 JavaScript 时仍可阅读网站并看到海报。

图像使用冷灰山谷与小面积暖色宫殿。种子同时改变山谷位置、宽度、地平线和地形纹理，光线与水面跟随山谷。实现说明见 [docs/art.md](docs/art.md)。

改变默认画面或引擎后，请重新生成并检查 `public/images/landscape.webp`，使静态预览与默认生成结果一致。先启动开发服务器，再在另一个终端运行：

```sh
npm run art:poster
```

该命令使用 Playwright Chromium，访问**已经运行的** `http://127.0.0.1:4321/`，读取首页声明的默认种子，绘制并保存海报；不会自行启动服务器。默认种子定义在 `src/art/landscape.ts`。自定义服务器地址可作为可选参数传入：

```sh
npm run art:poster -- http://127.0.0.1:4321
```

## 检查与测试

首次运行浏览器测试或海报生成前安装 Chromium：

```sh
npx playwright install chromium
```

Linux 若缺少系统库，可使用 `npx playwright install --with-deps chromium`（安装系统依赖可能需要管理员权限）。常用命令：

| 命令              | 用途                                  |
| ----------------- | ------------------------------------- |
| `npm run lint`    | Prettier 格式检查，不改写文件         |
| `npm run check`   | Astro / TypeScript 诊断               |
| `npm run build`   | 生成静态站点到 `dist/`                |
| `npm test`        | Playwright 桌面及移动端 Chromium 测试 |
| `npm run preview` | 本地预览已构建产物                    |
| `npm run format`  | 格式化仓库；提交前检查改动范围        |

推荐验证顺序：

```sh
npm run lint
npm run check
npm run build
npm test
```

`npm test` **不自动构建**；它通过 `npm run preview` 在 `http://127.0.0.1:4322` 服务已有 `dist/`。修改代码后先重新构建，避免测试旧产物。本地若已有该端口的服务会被复用，应确认它来自当前构建；CI 不复用现有服务。失败截图和 trace 位于 `test-results/`。

## GitHub Pages 工作流

`.github/workflows/deploy.yml` 在向 `main` 推送、向 `main` 提交 PR 或手动触发时运行：`npm ci` → 格式检查 → 类型检查 → 构建 → 安装 Chromium → 浏览器测试。

只有 **`main` 分支的非 PR 运行**会在全部检查通过后上传 `dist/` 并部署到原有 GitHub Pages 目标。PR（包括 fork PR）只做验证，不获得 Pages 写入或 OIDC 权限。全局权限仅为 `contents: read`，部署 job 单独获得 `pages: write` 和 `id-token: write`。失败时保留 Playwright 测试产物供排查。

仓库的 Pages Source 应继续使用 **GitHub Actions**。工作流源文件和本地检查不能证明远端部署或管理后台认证成功，需分别查看实际 Actions 运行和线上结果。
