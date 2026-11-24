# `mysite-comments` · Cloudflare Workers + D1 评论后端

无第三方运行时依赖的轻量评论服务，服务于 `ayixiayi.com` 文章页「题跋」评论区，支持免登录留言、一级回复、IP 哈希限流、蜜罐拦截、可选 Cloudflare Turnstile 人机校验与 Bearer Token 审核管理。

## 1. 创建并初始化 D1 数据库

在 `workers/comments/` 目录下执行（需已登录 `npx wrangler login`）：

```sh
npx wrangler d1 create mysite-comments
```

将返回的 `database_id` 填入 `workers/comments/wrangler.toml` 中的 `REPLACE_WITH_D1_DATABASE_ID`，随后导入表结构：

```sh
npx wrangler d1 execute mysite-comments --remote --file=schema.sql
```

## 2. 配置密钥（Secrets）

至少配置一个强随机 `ADMIN_TOKEN`（用于站长回复标记与后台审核）；如需额外防刷，可同时配置 `IP_HASH_SALT` 与 `TURNSTILE_SECRET`：

```sh
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put IP_HASH_SALT
# 可选：若启用 Cloudflare Turnstile，在 wrangler.toml 填写 TURNSTILE_SITE_KEY 并配置 secret
npx wrangler secret put TURNSTILE_SECRET
```

如需开启先审后发，将 `wrangler.toml` 中的 `MODERATION_MODE` 改为 `"pre"`（默认为 `"auto"`，直接发布）。

## 3. 部署 Worker

```sh
npx wrangler deploy
```

部署后会获得类似 `https://mysite-comments.<account>.workers.dev` 的地址（也可在 Cloudflare 绑定自定义子域名如 `https://comments.ayixiayi.com`）。

## 4. 接入站点前端

在 `src/data/site.ts` 中填写评论 API 地址（以及可选的 Turnstile Site Key），重新构建并部署站点即可。如在自定义域名下访问，确认 `wrangler.toml` 的 `ALLOWED_ORIGINS` 包含站点来源。

## 5. 本地测试

无需安装额外依赖，使用 Node 22 内置测试运行器直接验证所有接口与安全规则：

```sh
node --test workers/comments/test.mjs
```

## 6. 常用审核命令（`curl`）

```sh
export COMMENTS_API="https://mysite-comments.<account>.workers.dev"
export ADMIN_TOKEN="your-admin-token"

# 查看待审核评论（status 可选 pending / approved / deleted / all）
curl -s "$COMMENTS_API/api/admin/comments?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 通过审核（或改为 deleted 隐藏）
curl -s -X PATCH "$COMMENTS_API/api/comments/<COMMENT_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'

# 永久删除
curl -s -X DELETE "$COMMENTS_API/api/comments/<COMMENT_ID>" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 以站长身份回复（标记 is_owner=true，绕过限流与预审）
curl -s -X POST "$COMMENTS_API/api/comments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"<POST_SLUG>","parent_id":"<COMMENT_ID>","author":"ayixiayi","body":"感谢留言！"}'
```
