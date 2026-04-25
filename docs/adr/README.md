# Architecture Decision Records

记录 folo-ai 项目的关键架构决策，说明「为什么这么做」。

每次做出重要技术/产品决策时，在此目录新增一个 ADR 文件。

## 规范

- 文件名：`NNN-简短描述.md`（NNN 为三位序号，如 `006-add-search.md`）
- 安全隐患单独用 `sec-NNN-描述.md` 记录
- 状态变更：不修改旧 ADR，在新 ADR 中注明「替代 ADR-XXX」
- 模板：参考 [template.md](./template.md)

## 决策列表

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| [ADR-001](./001-markdown-as-database.md) | 使用 Markdown 文件作为数据存储 | 已接受 | 2026-04-16 |
| [ADR-002](./002-vue3-no-ui-library.md) | 前端使用 Vue3 + Vite，不引入 UI 组件库 | 已接受 | 2026-04-16 |
| [ADR-003](./003-jwt-single-admin.md) | 管理后台使用 JWT 鉴权，单管理员模式 | 已接受 | 2026-04-16 |
| [ADR-004](./004-collector-reserved.md) | AI 采集模块预留接口，暂不实现 | 已接受 | 2026-04-16 |
| [ADR-005](./005-public-committed-to-git.md) | public/ 构建产物提交进 Git，服务器免构建部署 | 已接受 | 2026-04-16 |
| [ADR-006](./006-skill-workbench-inside-monolith.md) | Skill Workbench 先在现有 Nuxt/Nitro 单体内实现 | 已接受 | 2026-04-25 |

## 安全隐患

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| [SEC-001](./sec-001-jwt-secret-weak-default.md) | JWT_SECRET 使用默认弱值 | 待处理 | 2026-04-16 |
