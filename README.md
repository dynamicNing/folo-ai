# folo-ai

> **Follow One Step** — 永远比信息快一步
> folo-ai.com

基于 Nuxt 3 + TypeScript 构建的个人信息聚合站：文章元数据存 SQLite，Markdown 正文由 `@nuxt/content` 从 `dynamicNing/content-archive` 渲染，支持亮/暗主题和管理后台。

## 技术栈

- **框架**：Nuxt 3（Vue 3 + Nitro）+ TypeScript
- **内容**：[@nuxt/content](https://content.nuxt.com) + Markdown（content-archive 仓库）
- **后端**：Nitro server/api + better-sqlite3 + JWT + bcryptjs
- **前端**：Pinia + 文件路由 + Composables
- **解析**：gray-matter + marked（webhook 抓取时预渲染 HTML 做降级）

## 目录结构

```
folo-ai/
├── nuxt.config.ts · content.config.ts · app.vue
├── pages/                   # 文件路由（index / article/[slug] / category/[name] / admin/**）
├── layouts/                 # default（含 NavBar）、admin（侧栏）
├── components/              # NavBar、ArticleCard
├── composables/useApi.ts    # 统一 $fetch 封装 + 类型
├── stores/                  # Pinia: auth（JWT）、theme
├── middleware/auth.ts       # 保护 /admin/*
├── types/article.ts         # Article / Social 全量类型
├── server/
│   ├── api/                 # Nitro handler（auth / items / social / webhook / health）
│   └── utils/               # db, auth, fileStore, contentPipeline, collector
├── content/                 # 仓库内示例 md（archive 未克隆时回落）
├── scripts/                 # sync.ts · reset-db.ts · pull-archive.ts（tsx 跑）
├── data/                    # articles.db · custom-feeds.json（gitignore）
└── content-archive/         # content-archive 本地克隆（gitignore）
```

## 快速开始

```bash
npm install
cp .env.example .env      # 编辑 JWT_SECRET / ADMIN_PASSWORD_HASH / GITHUB_TOKEN / MINIMAX_API_KEY
npm run archive:pull      # 克隆 content-archive 到 ./content-archive
npm run db:init           # 清空 SQLite 并全量同步
npm run dev               # http://localhost:3000
```

生成管理员密码 hash：

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('你的密码',10))"
```

生产构建：

```bash
npm run build
node .output/server/index.mjs     # 或 npm run preview
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Nuxt dev（前后端同进程 :3000） |
| `npm run build` · `npm run preview` | 生产构建 / 预览 |
| `npm run sync` | 增量同步 content-archive → SQLite |
| `npm run db:reset` · `db:init` | 重置 / 重置+全量同步 |
| `npm run archive:pull` | 克隆或更新 content-archive |

## 内容模型

- **元数据**（`status` / `category` / `tags` / `date` / `summary` / `sha` / AI 字段）— SQLite `articles` 表，由 webhook 或 `sync` 写入
- **正文** — `@nuxt/content` 从 `CONTENT_ARCHIVE_DIR` 读原始 md，`<ContentRenderer>` 运行时渲染；若 md 查不到，降级到 SQLite 的 `content`（marked 预渲染 HTML）
- **状态** — `published` / `draft` / `archived`；未登录只看 published

### 触发同步

- **Webhook**：`POST /api/webhook/github`（HMAC-SHA256 校验 `X-Hub-Signature-256`）
- **全量**：`POST /api/webhook/sync-all`（需 JWT）或本地 `npm run sync`

## 路由

### 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 首页（Hero + 最近更新） |
| `/article/:slug` | 文章详情 |
| `/category/:name` | 分类筛选 |
| `/admin/login` | 登录 |
| `/admin` | 概览 |
| `/admin/items` · `/admin/items/:slug` | 内容管理 / 预览 |
| `/admin/collector` | 社交采集 + 自定义 RSS |

### API（`/api` 下）

```
GET    /health
POST   /auth/login
GET    /items                      ?category= &tag= &status= &page= &pageSize=
GET    /items/categories
GET    /items/:slug
PATCH  /items/:slug/status         🔒
DELETE /items/:slug                🔒
GET    /social/status
GET    /social/items               ?platform= &page= &pageSize=
POST   /social/collect             🔒
POST   /social/collect/custom      🔒
GET    /social/feeds
POST   /social/feeds               🔒
DELETE /social/feeds/:id           🔒
PATCH  /social/feeds/:id/toggle    🔒
POST   /webhook/github             HMAC
POST   /webhook/sync-all           🔒
```

🔒 = 需要 `Authorization: Bearer <jwt>`。

## 部署

### PM2

```bash
npm run build
pm2 start .output/server/index.mjs --name folo-ai
pm2 save && pm2 startup
```

### Nginx

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 部署注意

- 服务端需要克隆 `content-archive` 并设置 `CONTENT_ARCHIVE_DIR`，否则 `@nuxt/content` 只能读仓库内的 `content/` 示例
- 首次部署跑一次 `npm run db:init` 物化 SQLite
- Webhook secret 建议设 `GITHUB_WEBHOOK_SECRET` 强校验

更多本地调试细节见 [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md)；部署与运维见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。
