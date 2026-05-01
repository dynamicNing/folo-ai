# 部署与运维

上线、升级、故障排查的操作手册。本地开发细节见 [`LOCAL_DEV.md`](LOCAL_DEV.md)。

## 1. 服务器准备

- Node **18+**（建议 20 LTS）
- `git`（拉 content-archive）
- `pm2`：`npm i -g pm2`
- Nginx（反代 + HTTPS）
- `certbot`（Let's Encrypt 证书）

## 2. 首次部署

### 2.1 拉代码 + 装依赖

```bash
git clone https://github.com/dynamicNing/folo-ai.git
cd folo-ai
npm install
```

### 2.2 配置 `.env`

```bash
cp .env.example .env
```

生产必填：

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | 强随机串（admin 登录签 token 用） |
| `ADMIN_PASSWORD_HASH` | bcryptjs 散列，见下 |
| `GITHUB_TOKEN` | GitHub PAT，避免同步限流 |
| `GITHUB_WEBHOOK_SECRET` | 和 GitHub webhook 配置一致 |
| `CONTENT_ARCHIVE_DIR` | content-archive 绝对路径，如 `/root/content-archive` |

可选：

| 变量 | 说明 |
| --- | --- |
| `MINIMAX_API_KEY` | 无则 AI 字段降级为规则生成 |
| `PORT` | 默认 3000 |

生成密码 hash：

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('你的密码',10))"
```

### 2.3 初始化内容

```bash
npm run archive:pull    # 克隆 content-archive 到 $CONTENT_ARCHIVE_DIR
npm run db:init         # 全量同步进 SQLite（首次可能几分钟）
```

### 2.4 构建 + 启动

```bash
npm run build
pm2 start .output/server/index.mjs --name folo-ai --update-env
pm2 save && pm2 startup
```

默认监听 `0.0.0.0:3000`。

## 3. Nginx + HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name folo-ai.com;

    ssl_certificate     /etc/letsencrypt/live/folo-ai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/folo-ai.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }
}
```

签证书：

```bash
certbot --nginx -d folo-ai.com
```

## 4. GitHub Webhook

仓库 `dynamicNing/content-archive` → **Settings → Webhooks → Add webhook**：

| 字段 | 值 |
| --- | --- |
| Payload URL | `https://folo-ai.com/api/webhook/github` |
| Content type | `application/json` |
| Secret | 与 `.env.GITHUB_WEBHOOK_SECRET` 一致 |
| Events | Just the push event |

之后 push 新 md 会自动：webhook → SHA 对比 → 抓原文 → AI 补字段 → SQLite。

## 5. 日常升级

```bash
cd /path/to/folo-ai
git pull
npm install                # 仅在依赖变动时
npm run build
pm2 restart folo-ai --update-env
```

### 数据维护

| 场景 | 命令 |
| --- | --- |
| 拉 content-archive 最新 | `npm run archive:pull` |
| 增量同步到 SQLite | `npm run sync` |
| 清空并重建（会重跑 AI） | `npm run db:init` |

## 6. 故障排查

| 现象 | 排查 |
| --- | --- |
| 502 Bad Gateway | `pm2 logs folo-ai`，看进程是否起来 / 端口是否冲突 |
| 文章列表为空 | `sqlite3 data/articles.db 'select count(*) from articles'`；为 0 则 `npm run sync` |
| 文章详情元信息有但正文空 | `CONTENT_ARCHIVE_DIR` 是否存在且为 git 仓库；SQLite `content` 字段是否也为空（降级失败） |
| Webhook 不触发 | GitHub 后台 **Recent Deliveries** 看响应状态；`pm2 logs` 搜 `[webhook]` |
| Webhook 401 | `GITHUB_WEBHOOK_SECRET` 两边不一致 |
| AI 字段为空 | `MINIMAX_API_KEY` 对不对 / 额度；`pm2 logs` 搜 `[pipeline] AI error` |
| admin 登录失败 | `ADMIN_PASSWORD_HASH` 是 bcryptjs 结果、不是明文；`JWT_SECRET` 非空 |
| 同步 403 `rate limit` | 未设 `GITHUB_TOKEN` 或 token 过期 |
| 部署后改 `.env` 不生效 | `pm2 restart folo-ai --update-env`（必须 `--update-env`） |

### 常用日志

```bash
pm2 logs folo-ai --lines 200
pm2 logs folo-ai --err
sqlite3 data/articles.db 'select status, count(*) from articles group by status;'
```

## 7. 回滚

```bash
git log --oneline -n 20
git checkout <上一个稳定 commit>
npm install && npm run build
pm2 restart folo-ai --update-env
```

SQLite 是 content-archive 的物化视图，回滚代码通常不用回滚数据；若 schema 有破坏性变更，先 `cp data/articles.db data/articles.db.bak` 再改。
