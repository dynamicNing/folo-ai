# ADR-006: Skill Workbench 先在现有 Nuxt/Nitro 单体内实现

- **日期**：2026-04-25
- **状态**：已接受

## 背景

项目希望把一部分 skill 做成 Web 可调用的能力，并允许配置 OpenAI / Anthropic 模型。当前仓库已经具备：

- Nuxt 3 + Nitro 的前后端一体结构
- 管理后台和管理员鉴权
- SQLite 本地数据存储
- 基于服务端环境变量的模型 provider 切换能力

选择实现路径时，有两种明显方向：

- 新建独立 Skill 平台项目
- 在现有 `folo-ai` 单体中新增后台模块

## 决策

我们决定先在现有 `folo-ai` 项目中，以 `admin/skills`、`admin/runs`、`api/skills`、`api/skill-runs` 为核心入口，增量实现内部 Skill Workbench。

架构上采用：

- 现有 Nitro API 作为 BFF 和 Orchestrator
- SQLite 持久化 skill、run、event、approval、artifact
- Provider Adapter 适配 OpenAI / Anthropic
- 首期只开放管理员和白名单 skill

不在 v1 阶段新建独立服务或独立前端。

## 当前落地结果

截至 2026-04-25，这个决策已经落地为一套仍在单体内的 MVP：

- `/admin/skills` 不再只展示内置 skill，也统一纳管本机已安装的外部 skill 目录
- 外部 skill 通过扫描 `~/.codex/skills`、`~/.agents/skills` 以及 `SKILL_SCAN_ROOTS` 自动同步进目录
- 外部 skill 当前只做 catalog 管理，不接入通用运行器
- `/admin/runs`、审批、SSE 日志和产物记录已接入
- Anthropic 路由已支持后台配置与调试页

这说明最初“先做单体内验证”的判断仍然成立，而且当前阶段不需要单独拆服务。

## 原因

- 现有项目已经具备后台、鉴权、API、数据库和模型调用模式，继续扩展成本最低
- Skill Workbench 的首要目标是验证使用场景和流程，而不是一开始追求平台化
- 内部工具需要优先解决权限、审批、日志和审计问题，在单体项目中更容易统一实现
- 当前规模下，独立拆服务会显著增加配置、部署和维护复杂度

## 后果

**正面**：开发速度快；复用现有基础设施；便于统一权限、日志和后台体验；更适合 MVP 验证。  
**负面**：应用边界会扩大，后续需要注意后台模块和内容业务模块的解耦。  
**中性**：如果未来 Skill Workbench 成为独立产品，可以在接口和数据模型稳定后再拆分为独立服务。
