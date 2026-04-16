# folo-ai

> 个人信息聚合站点 · folo-ai.com
> 只慢别人一步

## 快速启动

```bash
npm install
npm start
```

## 使用 PM2 管理

```bash
pm2 start server.js --name folo-ai
pm2 logs folo-ai
pm2 restart folo-ai
pm2 save
pm2 startup
```

## Nginx 配置

证书申请后替换 `/etc/nginx/sites-available/folo-ai`。
