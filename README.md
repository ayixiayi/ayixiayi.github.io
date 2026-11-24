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

| 位置                                             | 用途                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| `src/pages/`                                     | 首页、项目案例、博客、画册、关于及数据端点     |
| `src/data/`                                      | 站点资料、`now.json` 近况与 `plates.json` 图录 |
| `src/content/blog/`、`src/content/projects/`     | Markdown 文章与项目案例                        |
| `src/content.config.ts`                          | 文章与项目元数据校验                           |
| `src/lib/posts.ts`、`src/lib/projects.ts`        | 文章/项目筛选、排序、链接、年表与阅读时间      |
| `src/layouts/`、`src/components/`、`src/styles/` | 页面框架、交互组件（含题跋/评论）和样式        |
| `src/art/landscape.ts`                           | 零依赖原生 Canvas 2D 程序风景引擎              |
| `scripts/subset-cjk-font.py`                     | 构建期中文字体子集化脚本（`fontTools`）        |
| `workers/comments/`                              | 自托管 Cloudflare Workers + D1 免登录评论后端  |
| `public/`                                        | 原样复制到站点的图片、Sveltia CMS 后台等       |
| `astro.config.mjs`                               | 静态输出、站点 URL、预取与 sitemap 配置        |

更换域名时，同时检查 `astro.config.mjs` 的 `site` 和 `src/data/site.ts` 的 `site.url`，避免 canonical、RSS 和 sitemap 地址不一致。

### 内容与站点功能

- **板块结构**：主导航分为 `I 项目`（含 `/projects/<slug>/` 案例详情页）、`II 博客`、`III 画册`（`/plates/` 精选 6 幅种子构图）与 `IV 关于`（含跨文章与项目里程碑的「年表」）；首页末尾附「近况（Now）」展板。
- 搜索索引在构建时生成到 `/search-index.json`，剥离 Markdown 语法后索引已发布文章、项目案例正文与画册图录；搜索在浏览器内执行。
- `/rss.xml` 提供带 `atom:link` 与文章 `<category>` 标签的 RSS 2.0 订阅，sitemap 由 Astro 集成生成。
- 文章页面自动将正文中的 `#` 标题降级以保证全页唯一 `<h1>`，生成目录（TOC）、文末「题跋」与点击按需加载的原生评论区（免登录，支持 Cloudflare Workers + D1 后端，部署说明见 `workers/comments/README.md`）。
- Instrument Serif、Noto Serif SC、Manrope 和 IBM Plex Mono 均随构建产物自托管。构建期通过 `scripts/subset-cjk-font.py`（依赖 `fontTools` + `brotli`）将全站用到的汉字合并为单个 `noto-serif-sc-subset.woff2`，显著减少 CSS 体积与网络请求。
- 每篇文章在构建时生成一张 1200 × 630 的分享卡片 `/og/<文章>.png`（画作裁切 + 标题 + 日期），由 Satori 与 resvg 渲染。
- 首页与关于页的年级（大一 … 大四 / Freshman … Senior）由 `src/data/site.ts` 中的入学年份在构建时算出，每年 9 月 1 日（北京时间）由工作流定时重新构建一次。
- 首页画作使用零依赖原生 Canvas 2D 引擎（支持 `?seed=1..999999` 复现），展签支持复制链接或下载图像；运行 `npm run art:poster` 可批量更新默认海报、OG 裁切图及 `public/images/plates/seed-*.webp`。

## 发布文章

在 `src/content/blog/` 新建 `.md` 文件，例如 `my-note.md`：

```markdown
---
title: '一篇新记录'
description: '用于列表、搜索和 RSS 的简短介绍。'
pubDate: 2026-09-22
slug: my-note
tags: ['随笔', '开发']
draft: true
---

## 从这里开始

正文使用 Markdown，图片可以放在 `public/images/uploads/`，通过
`/images/uploads/example.webp` 引用。
```

`title`、`description`、`pubDate` 必填，`slug`、`tags` 可选，`draft` 默认为 `false`。准备公开时设为 `draft: false`。

- `slug` 决定文章地址：上例构建后为 `/blog/my-note/`，只能包含小写字母、数字和连字符。省略或在后台留空时用文件名生成地址（中文文件名会得到中文地址）。文章发布后不要再改 `slug`，否则旧链接会失效。
- `tags` 每项一个标签。构建时会自动去掉 `#`/`＃`、拆开写在同一项里的多个标签（如 `＃随想＃recap`）并去重，所以从后台随手输入也不会产生错误标签。
- 标签中的 `/` 等路径特殊字符会转换为唯一的安全网址标识，页面仍显示原标签文字；现有普通标签的网址保持不变。

`getPublishedPosts()` 是公共内容边界：草稿不生成文章路由，也不进入博客列表、搜索索引和 RSS。**草稿不是保密机制**：文件仍在 Git 仓库中；不要写入密钥或私人材料。发布日期用于排序，不是定时发布开关。

### 内容管理入口

`/admin/` 与 `public/admin/config.yml` 使用固定版本并带 SRI 校验的 **Sveltia CMS**，沿用原有 GitHub OAuth 服务（`decap-oauth.ayixiayi.workers.dev`），支持在线编辑 `博客文章`、`项目案例`、`首页近况（now.json）` 与 `风景画册（plates.json）`。

**本地构建和测试不代表 OAuth 服务或远端写入权限已验证。** 如登录不可用，可直接编辑 Markdown / JSON；不要为静态站点临时添加认证后端或把令牌写入仓库。

## 生成艺术与默认海报

首页显示静态海报，点击「重新生成」后按需加载零依赖原生 Canvas 2D 引擎。绘制完成后停止渲染循环，不持续播放动画。当前种子写入首页 URL，如 `/?seed=1847`；相同种子在同一渲染环境下生成相同图像。种子范围为 1–999999，无效参数保留默认海报。无 JavaScript 时仍可阅读网站并看到海报。

图像使用冷灰山谷与小面积暖色宫殿。种子同时改变山谷位置、宽度、地平线和地形纹理，光线与水面跟随山谷。实现说明见 [docs/art.md](docs/art.md)。

改变默认画面、引擎或 `src/data/plates.json` 后，请重新生成并检查海报与画册图片。先启动开发服务器，再在另一个终端运行：

```sh
npm run art:poster
```

该命令使用 Playwright Chromium，访问**已经运行的** `http://127.0.0.1:4321/`，绘制并保存默认海报 `public/images/landscape.webp`、分享卡片底图 `src/assets/og-base.jpg` 以及全部 6 幅精选画册图 `public/images/plates/seed-*.webp`（支持 `--plates` 或 `--poster-only`）；不会自行启动服务器。默认种子定义在 `src/art/landscape.ts`。自定义服务器地址可作为可选参数传入：

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

`npm test` 使用两个独立预览：

- `http://127.0.0.1:4322` 服务正式构建 `dist/`，检查真实文章可访问且不含测试文章。测试不会自动重建正式产物，修改代码或文章后须先运行 `npm run build`。本地可复用已有预览服务，CI 不复用。
- `http://127.0.0.1:4323` 每次使用 `tests/fixtures/src/content/blog/` 中的独立样例重新构建并启动。页面、内容 schema 和发布逻辑仍来自真实源码；产物和缓存分别写入 `dist-test/`、`.astro-test/`，不改写正式文章或 `dist/`。草稿隔离、日期排序、搜索和目录测试不得依赖真实文章的标题、正文或发布状态。

部署仅上传 `dist/`。失败截图和 trace 位于 `test-results/`。

## GitHub Pages 工作流

`.github/workflows/deploy.yml` 在向 `main` 推送、向 `main` 提交 PR 或手动触发时运行：`npm ci` → 格式检查 → 类型检查 → 构建 → 安装 Chromium → 浏览器测试。

只有 **`main` 分支的非 PR 运行**会在全部检查通过后上传 `dist/` 并部署到原有 GitHub Pages 目标。PR（包括 fork PR）只做验证，不获得 Pages 写入或 OIDC 权限。全局权限仅为 `contents: read`，部署 job 单独获得 `pages: write` 和 `id-token: write`。失败时保留 Playwright 测试产物供排查。

仓库的 Pages Source 应继续使用 **GitHub Actions**。工作流源文件和本地检查不能证明远端部署或管理后台认证成功，需分别查看实际 Actions 运行和线上结果。
