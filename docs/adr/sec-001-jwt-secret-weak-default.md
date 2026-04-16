# SEC-001: JWT_SECRET 使用默认弱值

- **日期**：2026-04-16
- **状态**：待处理

## 风险

`.env` 中 `JWT_SECRET` 默认值为 `folo-ai-jwt-secret-change-me`。若上线前忘记修改，攻击者可用此已知密钥伪造管理员 Token，完全绕过后台鉴权。

## 影响范围

`/api/items/:slug/status`（修改文章状态）和 `DELETE /api/items/:slug`（删除文章）接口。

## 修复方案

上线前在服务器 `.env` 中替换为足够长的随机字符串：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 备注

本地开发环境暂时保留默认值，生产服务器务必修改。
