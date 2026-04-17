# 本地调试手册

目标：在本地跑一套与线上等价的 folo-ai，数据来源是 GitHub 上的 `dynamicNing/content-archive` 仓库。

## 1. 核心架构速览

```
 content-archive (GitHub)                 folo-ai (Nuxt 3 + TS)
 ├─ ai-digest/*.md   ─┐                   ┌─ server/utils/contentPipeline.ts
 ├─ tech/*.md         │                   │    · fetchAllMdFiles() 列全量
 ├─ notes/*.md        ├─ webhook / sync ─▶│    · processFile()  md+frontmatter → marked → SQLite
 ├─ tools/*.md        │                   │    · syncAll()      全量同步入口
 └─ social/*.md      ─┘                   └─ data/articles.db  (表: articles / sync_state)
                                                   │
 content-archive (local clone)                     ▼
 └─ CONTENT_ARCHIVE_DIR/ ─── @nuxt/content ──▶ ContentRenderer 渲染正文
                                                   │
                                                   ▼
                                            Nuxt /api/* + pages/*
```

关键目录：

| 目录 | 作用 |
| --- | --- |
| `nuxt.config.ts` / `app.vue` | Nuxt 入口、runtimeConfig |
| `pages/` | 文件路由（含 `admin/*` 子路由 + layout 切换） |
| `components/` · `layouts/` · `stores/` · `composables/` · `middleware/` · `types/` | 前端 Vue 3 + TS |
| `server/utils/` | db / auth / fileStore / contentPipeline / collector |
| `server/api/**/*.ts` | Nitro handler（REST API） |
| `content.config.ts` | @nuxt/content collection（读 CONTENT_ARCHIVE_DIR 或回落 content/） |
| `scripts/*.ts` | 本地命令行工具（tsx 运行） |

## 2. 首次初始化

```bash
npm install
cp .env.example .env      # 若尚未创建
# 编辑 .env：填 ADMIN_PASSWORD_HASH / JWT_SECRET / GITHUB_TOKEN / MINIMAX_API_KEY（可选）
npm run archive:pull      # 克隆 content-archive 到 ./content-archive
npm run db:init           # 清空并从 GitHub 全量同步到 SQLite
npm run dev               # http://localhost:3000
```

`db:init` 等价于 `db:reset --yes && sync`。

## 3. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Nuxt dev server，前后端同进程 :3000 |
| `npm run build` | 生产构建，产物在 `.output/` |
| `npm run preview` | 跑 `.output/server/index.mjs` |
| `npm run sync` | 增量同步：遍历 content-archive 全部 md，SHA 未变则跳过 |
| `npm run db:reset` | 删除 `data/articles.db`（需确认），重建空表 |
| `npm run db:init` | 重置 + 全量同步（一键对齐线上数据） |
| `npm run archive:pull` | 克隆/更新 content-archive 到 `./content-archive` |

## 4. 与线上数据保持一致

线上的 `articles.db` 是 content-archive 的"物化视图"。本地执行 `npm run db:init` 后得到的就是与线上**逻辑等价**的数据库（AI 生成字段可能因调用结果不同略有差异）。

典型流程：

```bash
# 场景 A：线上有新文章合并进 content-archive，本地想跟上
npm run sync

# 场景 B：重现线上 bug，想要干净快照
npm run db:init

# 场景 C：调试 md 解析逻辑，改 server/utils/contentPipeline.ts 后想立即生效
npm run db:reset -- --yes && npm run sync
```

## 5. @nuxt/content 数据模型

- SQLite 存元数据：`status` / `category` / `tags` / `sha` / AI 字段 / `content`（marked 预渲染 HTML，作为降级）
- 文章正文优先由 `@nuxt/content` 从 `CONTENT_ARCHIVE_DIR` 直接读 md，用 `ContentRenderer` 渲染
- 若 `CONTENT_ARCHIVE_DIR` 未克隆，`content.config.ts` 回落到仓库内的示例 `content/`
- `pages/article/[slug].vue` 查不到 md 时自动用 SQLite 的 `content` HTML 降级

## 6. 模拟 webhook（增量验证）

`.env` 不设 `GITHUB_WEBHOOK_SECRET` 时，webhook 跳过签名校验：

```bash
curl -X POST http://localhost:3000/api/webhook/github \
  -H 'X-GitHub-Event: push' \
  -H 'Content-Type: application/json' \
  -d '{"commits":[{"added":["ai-digest/2025-12-01-test.md"],"modified":[],"removed":[]}]}'
```

## 7. 常见问题

- **`GitHub tree fetch failed: 403`** → 未设 `GITHUB_TOKEN` 被限流；生成一个 PAT 填入 `.env`。
- **AI 字段全为空** → 未设 `MINIMAX_API_KEY` 或 API 额度用尽，属正常降级，前端会显示解析规则生成的 title/summary。
- **社交页空白** → 本地没配 `CONTENT_ARCHIVE_DIR`；跑 `npm run archive:pull` 并在 `.env` 指定目录。
- **文章详情只显示元信息，正文空** → `CONTENT_ARCHIVE_DIR` 未克隆且 SQLite 里无 `content`；先 `npm run archive:pull` 再 `npm run sync`。
- **`data/articles.db` 被 git 跟踪** → 已在 `.gitignore` 的 `data/` 覆盖。
