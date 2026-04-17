# 本地调试手册

目标：在本地跑一套与线上等价的 folo-ai，数据来源是 GitHub 上的 `dynamicNing/content-archive` 仓库。

## 1. 核心架构速览

```
 content-archive (GitHub)        folo-ai 后端
 ├─ ai-digest/*.md   ─┐          ┌─ src/services/contentPipeline.js
 ├─ tech/*.md         │  拉取    │    · fetchAllMdFiles() 列全量
 ├─ notes/*.md        ├────────▶ │    · processFile()      解析 md+frontmatter → marked → SQLite
 ├─ tools/*.md        │          │    · syncAll()          全量同步入口
 └─ social/*.md      ─┘          └─ data/articles.db  (表: articles / sync_state)
                                        │
                                        ▼
                                 /api/items · /api/social (SPA 读取)
```

关键文件：

| 文件 | 作用 |
| --- | --- |
| `server.js` | Express 启动、挂路由、托管 `public/` 静态资源 |
| `src/services/db.js` | SQLite 初始化 + 建表 |
| `src/services/contentPipeline.js` | md 抓取 / 解析 / AI 补字段 / 入库 |
| `src/services/collector.js` | 社交媒体采集（读写 `CONTENT_ARCHIVE_DIR/social`） |
| `src/routes/webhook.js` | GitHub webhook 增量；`/api/webhook/sync-all` 全量 |
| `scripts/*.js` | 本地调试工具（见下文） |

## 2. 首次初始化

```bash
npm install
cp .env.example .env      # 若尚未创建
# 编辑 .env：填 ADMIN_PASSWORD_HASH / JWT_SECRET / GITHUB_TOKEN / MINIMAX_API_KEY（可选）
npm run build             # 打包前端到 public/
npm run db:init           # 清空并从 content-archive 全量同步
npm start                 # http://localhost:3000
```

`db:init` 等价于 `db:reset --yes && sync`。

## 3. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run sync` | 增量同步：遍历 content-archive 全部 md，SHA 未变则跳过 |
| `npm run db:reset` | 删除 `data/articles.db`（需确认），重建空表 |
| `npm run db:init` | 重置 + 全量同步（一键对齐线上数据） |
| `npm run archive:pull` | 把 content-archive 克隆/更新到 `./content-archive`，离线调试用 |
| `npm start` | 后端 3000 |
| `npm run client:dev` | 前端 Vite dev server 5173，自动代理 `/api` → 3000 |

## 4. 与线上数据保持一致

线上的 `articles.db` 是 content-archive 的"物化视图"。本地执行 `npm run db:init` 后得到的就是与线上**逻辑等价**的数据库（AI 生成字段可能因调用结果不同略有差异）。

典型流程：

```bash
# 场景 A：线上有新文章合并进 content-archive，本地想跟上
npm run sync            # SHA 对比，仅拉取变动

# 场景 B：重现线上 bug，想要干净快照
npm run db:init

# 场景 C：调试 md 解析逻辑，改 contentPipeline.js 后想立即生效
npm run db:reset -- --yes && npm run sync
```

## 5. 离线 / 无网环境

```bash
npm run archive:pull           # 克隆到 ./content-archive
# 在 .env 里指向本地目录（social 采集用）
echo 'CONTENT_ARCHIVE_DIR=./content-archive' >> .env
```

> 注意：目前 `contentPipeline.syncAll()` 仍走 GitHub API。若需完全离线，可在 pipeline 里加 `if (CONTENT_ARCHIVE_DIR)` 分支，用 `fs.readFile` 替代 `fetchRawContent`/`fetchAllMdFiles`（后续需求时再加）。

## 6. 模拟 webhook（增量验证）

`.env` 不设 `GITHUB_WEBHOOK_SECRET` 时，webhook 跳过签名校验，直接 POST 即可：

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
- **`data/articles.db` 被 git 跟踪？** → 应在 `.gitignore` 里排除（如未排除请补一条）。
