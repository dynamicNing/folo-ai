# folo-ai

> **Follow One Step** — 永远比信息快一步
> folo-ai.com

基于 Nuxt 3 + TypeScript 构建的个人信息聚合站：文章元数据存 SQLite，Markdown 正文由 `@nuxt/content` 从 `dynamicNing/content-archive` 渲染，同时支持 AI 生成的学习路径模块、亮/暗主题和管理后台。

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
├── pages/                   # 文件路由（index / article/[slug] / category/[name] / learn/** / admin/**）
├── layouts/                 # default（含 NavBar）、admin（侧栏）
├── components/              # NavBar、ArticleCard
├── composables/             # useApi · useLearningProgress
├── stores/                  # Pinia: auth（JWT）、theme
├── middleware/auth.ts       # 保护 /admin/*
├── types/                   # article.ts · learning.ts
├── server/
│   ├── api/                 # Nitro handler（auth / items / learn / webhook / health）
│   └── utils/               # db, auth, fileStore, contentPipeline, learning*
├── content/                 # 仓库内示例 md（archive 未克隆时回落）
├── scripts/                 # sync.ts · reset-db.ts · pull-archive.ts（tsx 跑）
├── data/                    # articles.db（gitignore）
└── content-archive/         # content-archive 本地克隆（gitignore）
```

## 快速开始

```bash
npm install
cp .env.example .env      # 编辑 JWT_SECRET / ADMIN_PASSWORD_HASH / GITHUB_TOKEN / LEARNING_AI_PROVIDER / 对应 AI Key
npm run archive:pull      # 克隆 content-archive 到 ./content-archive
npm run db:init           # 清空 SQLite 并全量同步
npm run dev               # http://localhost:3000
```

学习模块的生成接口依赖：

- `LEARNING_AI_PROVIDER`：当前支持 `minimax` / `deepseek`
- 对应 provider 的 API Key：`MINIMAX_API_KEY` 或 `DEEPSEEK_API_KEY`
- 可选模型覆盖：`LEARNING_AI_MODEL_PLAN` / `LEARNING_AI_MODEL_CHAPTER`
- `CONTENT_ARCHIVE_DIR` 可写：默认 `./content-archive`，生成时会写入 `learning/`

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

### 学习模块

- **主数据源** — 本地 `content-archive/learning/` 下的 Markdown 文件；这是学习模块的 source of truth
- **生成方式** — `POST /api/learn/generate` 阻塞式调用 AI：先生成目录 JSON，再逐章生成 Markdown，写入本地目录；底层 provider 可配置为 `minimax` 或 `deepseek`
- **索引表** — `learning_topics` / `learning_chapters`，由服务端在写入 Markdown 后立即刷新，用于 `/learn` 页面查询
- **阅读进度** — 浏览器 `localStorage`，按主题记录已完成章节
- **正文渲染** — 学习列表和章节索引从学习表读取，正文使用写入后的 Markdown 渲染结果

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
| `/learn` | 学习主题列表 |
| `/learn/:slug` | 学习主题详情 |
| `/learn/:slug/:chapter` | 学习章节阅读 |
| `/admin/login` | 登录 |
| `/admin` | 概览 |
| `/admin/learn` | 学习主题生成入口 |
| `/admin/items` · `/admin/items/:slug` | 内容管理 / 预览 |

### API（`/api` 下）

```
GET    /health
POST   /auth/login
GET    /items                      ?category= &tag= &status= &page= &pageSize=
GET    /items/categories
GET    /items/:slug
PATCH  /items/:slug/status         🔒
DELETE /items/:slug                🔒
POST   /learn/generate             🔒
GET    /learn/topics
GET    /learn/topics/:slug
GET    /learn/topics/:slug/chapters/:chapter
POST   /webhook/github             HMAC
POST   /webhook/sync-all           🔒
```

🔒 = 需要管理员登录（cookie 会话或 `Authorization: Bearer <jwt>`）。

## 学习模块工作流

1. 管理员在 `/admin/learn` 输入书名或主题、深度和补充上下文。
2. 服务端先让 AI 生成目录级 JSON，再按章节生成统一模板的 Markdown。
3. 生成结果写入 `content-archive/learning/{topic-slug}/index.md` 和各章节 `.md` 文件。
4. 服务端立即重新解析这些 Markdown，刷新 `learning_topics` / `learning_chapters`。
5. 用户在 `/learn` 阅读主题和章节，阅读进度保存在浏览器本地。

说明：

- 当前实现生成的是“学习版 Markdown”，不是原书逐页数字化副本。
- 生成接口是阻塞式的，章节较多时可能需要 30-90 秒。
- 学习模块当前支持通过配置切换 `minimax` / `deepseek`，不需要改生成流程代码。

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
- 若启用学习模块生成，服务端还需要对 `CONTENT_ARCHIVE_DIR/learning` 拥有写权限
- 若启用学习模块生成，需配置 `LEARNING_AI_PROVIDER` 和对应 provider 的 API Key
- Webhook secret 建议设 `GITHUB_WEBHOOK_SECRET` 强校验

更多本地调试细节见 [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md)；部署与运维见 [`docs/DEPLOY.md`](docs/DEPLOY.md)。
