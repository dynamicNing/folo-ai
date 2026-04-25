# Skill Workbench 系统说明

> `folo-ai` 管理后台中的内部 Skill 管理与执行模块

**版本**：v0.2  
**日期**：2026-04-25  
**状态**：MVP 已落地，文档已按当前实现更新

---

## 阅读入口

按对象阅读可直接看：

- 产品/业务简版：[SKILL_WORKBENCH_BRIEF.md](./SKILL_WORKBENCH_BRIEF.md)
- 开发接手版：[SKILL_WORKBENCH_TECH_HANDOFF.md](./SKILL_WORKBENCH_TECH_HANDOFF.md)

本文档保留为“完整系统说明”。

---

## 一、目标

当前 Skill Workbench 的目标不是做一个通用技能市场，而是把两类能力放进统一后台：

- 内置 skill 的受控运行
- 外部已安装 skill 的目录化管理

管理员可以在 Web 后台中：

- 查看当前系统已纳管的 skill
- 区分内置 skill 与外部 skill
- 对内置 skill 发起运行
- 查看运行日志、审批、结果与产物
- 配置 Anthropic 官方或代理路由
- 直接在后台调试 Anthropic 代理链路是否可用

---

## 二、当前范围

### 已实现

- 单管理员模式
- Nuxt 3 + Nitro + SQLite 单体实现
- 内置 skill 注册、展示、运行
- 外部 skill 目录扫描、元数据入库、后台展示
- Skill Run 历史、详情、事件流、审批、产物
- Anthropic 路由后台配置
- Anthropic 代理连通性调试页

### 当前不做

- 不做公开技能市场
- 不做浏览器直连第三方模型
- 不做任意脚本执行平台
- 不做 Git / 远程仓库安装器
- 不做通用外部 skill 自动运行器

外部 skill 当前只做“目录纳管”，不直接接入运行链路。

---

## 三、系统边界

当前系统把 skill 分成两类：

### 1. 内置 Skill

来源：

- `server/utils/skillRegistry.ts` 中的种子定义

特点：

- 首次访问时自动写入 `skill_definitions`
- 由系统内置 runner 负责执行
- 当前支持 `llm_direct` 与 `agent_sdk`
- 当前真实可运行的仍是白名单内置 skill

### 2. 外部 Skill

来源：

- 本机已安装的 skill 目录
- 默认扫描路径：
  - `~/.codex/skills`
  - `~/.agents/skills`
- 可选附加路径：
  - `SKILL_SCAN_ROOTS`

特点：

- 扫描目录中的 `SKILL.md`
- 解析 frontmatter 与正文摘要
- 记录来源路径、来源版本、来源标签、原始元数据
- 统一显示在 `/admin/skills`
- 当前不参与运行，只做组织、检索与后续绑定准备

---

## 四、页面结构

### `/admin/skills`

技能目录页，支持：

- 按分类筛选
- 按 provider 筛选
- 按状态筛选
- 按来源类型筛选（`builtin` / `external`）
- 手动触发“同步目录”

页面结构上：

- 顶部优先展示“常用内置技能”
- 外部 skill 单独归到“外部技能目录”
- 外部 skill 需要先手动执行一次“同步目录”才会出现

这页现在是“技能目录管理台 + 内置技能入口”，不再只是运行入口。

### `/admin/skills/:slug`

技能详情页，显示：

- 基础元数据
- 来源信息
- 默认 provider / model
- source path / source version
- input / output schema
- tool policy

行为说明：

- 内置 skill：显示运行入口
- 外部 skill：只显示“当前仅纳入目录管理，未绑定运行器”

### `/admin/runs`

运行列表页，支持查看：

- skill
- provider
- engine
- status
- created_at / duration

### `/admin/runs/:runUid`

单次运行详情页，包含：

- 运行摘要
- Input / Output
- 资源统计（仅在当前 run 有采集数据时展示）
- 审批记录
- 实时日志 SSE
- 产物列表

### `/admin/settings/models`

Anthropic 路由设置页，支持配置：

- 启用数据库覆盖
- Base URL
- 默认模型
- 认证模式
- Anthropic Version
- API Key

注意：

- 开启“数据库覆盖”时，服务端优先使用数据库中的 Anthropic 配置
- 关闭时，会保留已填写的数据库值，但真实调用回退到环境变量或内置默认
- 页面会同时展示“数据库中保存的配置”和“当前实际生效的配置摘要”

### `/admin/settings/anthropic-debug`

Anthropic 调试页，直接复用服务端 provider 发起测试请求，用来验证：

- endpoint 拼接是否正确
- 认证头是否正确
- 模型是否可用
- 返回体是否兼容当前解析逻辑

---

## 五、当前数据模型

### `skill_definitions`

统一记录内置 skill 与外部 skill。

关键字段：

- `slug`
- `name`
- `description`
- `category`
- `engine_type`
- `source_type`
- `source_path`
- `source_origin`
- `source_label`
- `source_version`
- `source_metadata`
- `default_provider`
- `default_model`
- `tool_policy`
- `status`

其中：

- `source_origin = 'builtin'` 表示系统内置
- `source_origin = 'external'` 表示外部目录扫描所得

### `skill_runs`

记录一次 skill 执行实例：

- run_uid
- skill_slug
- provider
- engine_type
- model
- status
- input_json
- output_json
- error_message
- started_at / finished_at / duration_ms

### `skill_run_events`

记录运行过程中的时序事件，配合 SSE 实时展示。

### `approval_requests`

当 skill 命中高风险 tool policy 时，运行进入 `waiting_approval`，在这里记录待审批项。

### `artifacts`

记录结构化产物，例如：

- Markdown
- JSON
- 摘要文本
- 文件路径

### `app_settings`

当前主要用于保存 Anthropic 路由配置。

---

## 六、Skill 生命周期

### 1. 内置 Skill 生命周期

1. 系统启动后首次访问 `/api/skills`
2. `skillRegistry.ts` 中的默认 skill 自动 upsert 到 `skill_definitions`
3. 管理员在 `/admin/skills` 查看技能
4. 在详情页发起运行
5. 系统创建 `skill_run`
6. 若需要审批，则进入 `waiting_approval`
7. 否则进入队列并由 runner 执行
8. 运行日志写入 `skill_run_events`
9. 输出写入 `skill_runs` / `artifacts`

### 2. 外部 Skill 生命周期

1. 管理员点击“同步目录”
2. 系统扫描预设 skill 根目录
3. 找到包含 `SKILL.md` 的目录
4. 读取 frontmatter 与正文摘要
5. 写入 `skill_definitions`
6. 在 `/admin/skills` 展示为 `external`

注意：

- 外部 skill 当前不会进入运行队列
- 即使 `SKILL.md` 中写了 provider / engine，当前也只作为元数据保留
- 真正运行前，仍需要单独为它绑定本系统 runner
- `GET /api/skills` 不再自动触发目录扫描，避免读请求带副作用

### 3. 服务重启后的恢复

- 处于 `queued` 的内置 run 会在服务启动时自动恢复排队
- 处于 `running` 的 run 会标记为中断失败，避免静默悬挂
- `waiting_approval` 保持原状态，等待管理员继续处理

---

## 七、当前运行能力

### 已支持的执行模式

#### `llm_direct`

适用于单轮文本生成类 skill。

当前示例：

- `learning-topic-generator`
- `article-summary-polisher`

#### `agent_sdk`

适用于多步骤工作流。

当前示例：

- `daily-ai-briefing`

它会在服务端串联本地研究源、计划生成、正文生成，并将过程事件写入日志流。

### 当前运行限制

- 只有 `source_origin = builtin` 的 skill 允许创建 run
- runner 仍是白名单实现，不是通用 SKILL.md 解释器
- 外部 skill 当前不自动映射为 Anthropic / OpenAI prompt 执行

---

## 八、Anthropic 路由方案

### 设计目标

支持两种使用方式：

- 官方 Anthropic API
- Anthropic 兼容代理站

### 当前支持项

- `x-api-key`
- `Authorization: Bearer ...`
- 自定义 `anthropic-version`
- 自定义 Base URL
- 自动补全 endpoint：
  - 根地址
  - `/v1`
  - `/v1/messages`

### 配置优先级

1. 数据库 `app_settings`
2. 环境变量
3. 开发期 fallback

### Anthropic 调试页的作用

调试页不是在浏览器里直连第三方，而是通过当前服务端 provider 发请求，因此更接近真实运行链路。

它主要用于回答两个问题：

- 这条代理地址是不是 Anthropic Messages 兼容接口
- 当前系统能不能按现有 headers / body / response 逻辑正确使用它

---

## 九、已实现 API

### Skill 目录

- `GET /api/skills`
- `GET /api/skills/:slug`
- `POST /api/skills/sync`

### Run

- `POST /api/skill-runs`
- `GET /api/skill-runs`
- `GET /api/skill-runs/:runUid`
- `GET /api/skill-runs/:runUid/events`
- `GET /api/skill-runs/:runUid/stream`
- `GET /api/skill-runs/:runUid/approvals`
- `POST /api/skill-runs/:runUid/approvals/:id/approve`
- `POST /api/skill-runs/:runUid/approvals/:id/reject`
- `GET /api/skill-runs/:runUid/artifacts`

### Anthropic 配置

- `GET /api/settings/models`
- `PUT /api/settings/models/anthropic`
- `POST /api/settings/models/anthropic-debug`

---

## 十、与最初方案的差异

最初草案偏向“可运行的 Skill Workbench 平台”，当前实现已经调整为更现实的两层结构：

- 一层是“可运行的内置 skill”
- 一层是“可组织管理的外部 skill 目录”

因此当前与草案相比有几个明确变化：

- 不再提供通用 `POST /api/skills` 手工创建 skill 的入口
- 不做 `/admin/settings/policies` 页面
- 不做外部 skill 导入器 / 市场安装器
- 外部 skill 当前只做 catalog，不做通用执行
- Anthropic 路由配置已经从“建议”变成了真实可用后台能力

---

## 十一、安全与运维注意事项

### 1. 模型密钥

当前 Anthropic API Key 存在服务端 SQLite 中，浏览器不会直接持有，但也尚未做额外加密。

当前适合：

- 单管理员
- 内部工具
- 受控部署环境

上线前建议至少补：

- 密钥加密存储
- 配置变更审计
- 更严格的管理员操作日志

### 2. 代理路由

如果使用第三方 Anthropic 代理站，需要确认：

- 请求路径兼容 `/v1/messages`
- 认证头兼容 `x-api-key` 或 `Bearer`
- 返回体兼容 Anthropic Messages 风格

否则当前 provider 仍然可能失败。

### 3. 外部 Skill 扫描

当前扫描器只读取目录元数据，不执行脚本，因此风险相对可控；但仍建议限制扫描根目录，不要把不受信任的大目录直接加入 `SKILL_SCAN_ROOTS`。

---

## 十二、下一步建议

### 近期

- 给外部 skill 增加“绑定运行方式”的后台配置
- 为外部 skill 增加启用/禁用、标签、分组
- 增加 skill 目录同步日志
- 去掉开发期 hardcoded Anthropic fallback，收敛到环境变量或后台配置

### 中期

- 引入 execution profile 绑定
- 给 skill 增加版本历史与同步记录
- 支持按目录来源查看 skill
- 为外部 skill 增加更清晰的 catalog dashboard

### 长期

- 如果 skill 规模显著增大，再考虑把 catalog / run orchestration 拆成独立服务

---

## 十三、结论

当前 Skill Workbench 已经从“方案草案”进入“可使用的内部后台模块”阶段。

它现在的核心定位是：

- 对内置 skill，提供可控的运行与审计能力
- 对外部已安装 skill，提供统一目录化管理能力
- 对 Anthropic 路由，提供后台配置与真实链路调试能力

这套结构比一开始直接做“通用技能执行平台”更稳，也更符合当前项目阶段。
