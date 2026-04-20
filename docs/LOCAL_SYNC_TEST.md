# folo-ai 本地同步验证清单（远程仓库更新）

## 0. 验证目标
- 验证远程 `content-archive` 更新后，站点能正确完成：
- 拉取最新仓库内容
- 写入/更新 SQLite 元数据
- 前台与后台正确展示变化
- 同步日志记录准确

## 1. 环境准备（一次性）
### 1.1 安装与配置
```bash
cd /Users/dynamic/Documents/GitHub/folo-ai
npm install
cp .env.example .env
```

### 1.2 关键环境变量检查（`.env`）
- `JWT_SECRET`
- `ADMIN_PASSWORD_HASH`
- `GITHUB_TOKEN`（建议配置，避免 API 限流）
- `CONTENT_ARCHIVE_DIR`（默认可用 `./content-archive`）

### 1.3 初始化内容与数据库
```bash
npm run archive:pull
npm run db:init
```

### 1.4 启动服务
```bash
npm run dev
```

## 2. 基线检查（确保初始状态正常）
### 2.1 页面可用性
- 打开首页 `/`，确认有文章列表
- 打开后台 `/admin/login`，确认可登录
- 登录后打开 `/admin/items`，确认可看到内容列表
- 打开 `/admin/sync`，确认可看到同步记录

### 2.2 API 基线（可选）
```bash
curl -s http://localhost:3000/api/health
curl -s "http://localhost:3000/api/items?page=1&pageSize=5"
```

## 3. 场景 A：新增文章同步验证
### 3.1 准备“远程新增”
- 真实方式：在 `dynamicNing/content-archive` 新增一篇 `.md` 并 push
- 模拟方式：先在本地 `content-archive` 目录新增符合规则的 markdown 文件

建议路径示例：
- `ai-digest/2026-04-20.md`

### 3.2 执行拉取 + 同步
```bash
npm run archive:pull
npm run sync
```

### 3.3 验收点
- 后台 `/admin/items` 出现新增文章
- 首页 `/` 能看到新增内容（若状态是 `published`）
- 文章详情 `/article/<slug>` 可打开
- `/admin/sync` 有成功记录，`processed` 有增量，`failed = 0`

## 4. 场景 B：修改文章同步验证
### 4.1 准备“远程修改”
- 修改已存在 markdown 的标题、`summary`、`tags`、`status`（可选）

### 4.2 执行拉取 + 同步
```bash
npm run archive:pull
npm run sync
```

### 4.3 验收点
- 后台列表看到标题/摘要变化
- 详情页内容变化可见
- 若改了 `status`，前台可见性符合预期（见第 6 节）

## 5. 场景 C：删除文章同步验证
### 5.1 准备“远程删除”
- 在 `content-archive` 删除一篇已同步文章并 push

### 5.2 执行拉取 + 同步
```bash
npm run archive:pull
npm run sync
```

### 5.3 验收点
- 后台 `/admin/items` 不再显示该文章
- 前台访问原 URL 返回不存在/404
- 同步日志能看到 `removed` 计数变化

## 6. 状态与可见性验证（`published` / `draft` / `archived`）
### 6.1 操作
- 选一篇文章分别设为 `published`、`draft`、`archived`
- 每次修改后执行：
```bash
npm run sync
```

### 6.2 验收点
- 前台（未登录）仅看到 `published`
- 后台（登录）可管理全部状态
- API 行为符合权限预期

## 7. 全量同步与 webhook 链路验证
### 7.1 后台手动全量同步
- 进入 `/admin/sync`
- 点击“手动全量同步”
- 观察同步日志是否成功

### 7.2 API 方式（已登录态）
- 调用 `POST /api/webhook/sync-all`
- 验证返回 `ok`，并在 `/admin/sync` 有记录

### 7.3 webhook 增量（可选）
- 若本地已配置 GitHub webhook 到该服务地址，push 后观察是否自动增量同步
- 验证点同上

## 8. 快速排障命令
### 8.1 看本地内容仓库是否更新成功
```bash
cd content-archive
git log --oneline -n 5
git status
```

### 8.2 重新全量初始化（兜底）
```bash
cd /Users/dynamic/Documents/GitHub/folo-ai
npm run db:init
```

### 8.3 检查类型和基本健康
```bash
npm run typecheck
curl -s http://localhost:3000/api/health
```

## 9. 常见失败原因
- `.env` 未配置 `GITHUB_TOKEN`，触发限流/拉取失败
- `CONTENT_ARCHIVE_DIR` 指向错误目录
- 新增 markdown 命名不符合当前同步规则（如被过滤）
- webhook secret 不一致导致 webhook 请求被拒
- 本地服务未重启导致配置未生效

## 10. 通过标准（建议）
- 场景 A/B/C 全部通过
- `/admin/sync` 无失败，或失败可解释且可重试成功
- 前台/后台展示与状态规则一致
