# folo-ai

> **Follow One Step** — 永远比信息快一步  
> folo-ai.com

基于 Node/Express + Vue3 构建的个人信息聚合站，以 Markdown 文件为数据源，支持亮/暗色主题切换和管理后台。

## 技术栈

- **后端**：Express 5 + gray-matter + marked + JWT
- **前端**：Vue3 + Vite + Vue Router + Pinia
- **数据**：Markdown 文件（无数据库）

## 目录结构

```
folo-ai/
├── server.js              # Express 入口
├── src/
│   ├── routes/            # API 路由（items, auth）
│   ├── services/          # 业务层（mdParser, fileStore, collector[预留]）
│   └── middleware/        # JWT 鉴权
├── content/               # Markdown 内容文件
│   ├── tech/
│   ├── tools/
│   └── notes/
├── client/                # Vue3 前端源码
│   └── src/
│       ├── views/         # 展示页 + 管理后台
│       ├── stores/        # Pinia（theme, auth）
│       ├── router/
│       └── api/
└── public/                # 构建产物（vite build 输出）
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env`，修改密码 hash 和 JWT secret：

```bash
cp .env.example .env
```

生成新的管理员密码 hash：

```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('你的密码',10))"
```

将输出结果填入 `.env` 的 `ADMIN_PASSWORD_HASH`。

### 开发模式

```bash
# 启动后端（:3000）
npm run dev

# 新开终端，启动前端 Vite 开发服务器（:5173，API 自动代理到 3000）
npm run client:dev
```

访问 http://localhost:5173

### 生产构建

```bash
npm run build   # Vue 打包到 public/
npm start       # Express 托管静态文件 + API
```

访问 http://localhost:3000

## 内容管理

### 添加文章

在 `content/<分类>/` 目录下创建 `.md` 文件，文件名即为 slug：

```markdown
---
title: 文章标题
category: tech
tags: [ai, weekly]
status: published
date: 2026-04-16
summary: 一句话摘要
---

正文内容...
```

**status 可选值**：`published`（公开）/ `draft`（草稿）/ `archived`（归档）

### 管理后台

访问 `/admin/login`，使用 `.env` 中配置的密码登录。

| 路径 | 说明 |
|------|------|
| `/admin` | 概览（统计 + 最近发布）|
| `/admin/items` | 内容列表（状态切换、删除）|
| `/admin/items/:slug` | 文章预览 |
| `/admin/collector` | AI 采集（预留）|

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页文章列表 |
| `/article/:slug` | 文章详情 |
| `/category/:name` | 分类筛选 |

## API

```
GET  /api/items              文章列表（?category= &tag= &status= &page=）
GET  /api/items/categories   分类列表
GET  /api/items/:slug        文章详情

POST   /api/auth/login           登录，返回 JWT
PATCH  /api/items/:slug/status   修改状态（需鉴权）
DELETE /api/items/:slug          删除文章（需鉴权，移入 _trash）
```

## PM2 部署

```bash
pm2 start server.js --name folo-ai
pm2 save
pm2 startup
```

## Nginx 配置

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

证书申请后替换 `/etc/nginx/sites-available/folo-ai`。
