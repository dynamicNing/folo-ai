# Skill Workbench 开发接手说明

> 面向后续维护或继续扩展该模块的开发同学

**版本**：v0.2  
**日期**：2026-04-25  
**适用对象**：需要继续开发 skill 管理、运行链路、Anthropic 路由或目录扫描能力的工程师

---

## 1. 当前设计结论

这套实现已经明确分成两层：

- `builtin` skill：系统内置、可运行
- `external` skill：外部已安装、仅纳管

不要把当前实现理解为“通用 SKILL.md 执行器”。它还不是。

当前真实行为是：

- 内置 skill 来自代码种子，并由本系统 runner 执行
- 外部 skill 来自本机扫描，只同步元数据到数据库
- 外部 skill 默认不允许创建 run

这条边界已经在前后端都做了保护。

---

## 2. 关键目录

### 前端页面

- [pages/admin/skills/index.vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/skills/index.vue)
- [pages/admin/skills/[slug].vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/skills/[slug].vue)
- [pages/admin/runs/index.vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/runs/index.vue)
- [pages/admin/runs/[runUid].vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/runs/[runUid].vue)
- [pages/admin/settings/models.vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/settings/models.vue)
- [pages/admin/settings/anthropic-debug.vue](/Users/dynamic/Documents/GitHub/folo-ai/pages/admin/settings/anthropic-debug.vue)

### API

- [server/api/skills/index.get.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/api/skills/index.get.ts)
- [server/api/skills/[slug].get.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/api/skills/[slug].get.ts)
- [server/api/skills/sync.post.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/api/skills/sync.post.ts)
- [server/api/skill-runs/index.post.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/api/skill-runs/index.post.ts)
- `server/api/skill-runs/*`
- `server/api/settings/models*`

### 核心服务

- [server/utils/db.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/db.ts)
- [server/utils/skillRegistry.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRegistry.ts)
- [server/utils/skillStore.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillStore.ts)
- [server/utils/skillRunner.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRunner.ts)
- [server/utils/skillRunQueue.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRunQueue.ts)
- [server/utils/skillCatalog.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillCatalog.ts)
- [server/utils/skillImporter.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillImporter.ts)
- [server/utils/appSettings.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/appSettings.ts)
- [server/utils/providers/anthropic.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/providers/anthropic.ts)
- [server/utils/providers/openai.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/providers/openai.ts)

### 类型

- [types/skill.ts](/Users/dynamic/Documents/GitHub/folo-ai/types/skill.ts)
- [types/settings.ts](/Users/dynamic/Documents/GitHub/folo-ai/types/settings.ts)

---

## 3. 数据模型

### `skill_definitions`

当前是整个模块的中心表。

这张表同时承载：

- 内置 skill
- 外部扫描 skill

关键字段作用：

- `source_origin`
  - `builtin`
  - `external`
- `source_type`
  - `inline`
  - `skill_folder`
  - `external_path`
- `source_label`
  - 外部来源显示名
- `source_version`
  - 外部 skill 的版本
- `source_metadata`
  - 原始 frontmatter 摘要、声明信息、路径信息

### `skill_runs`

只对可运行 skill 生效。

当前服务端会显式阻止外部 skill 进入这个表。

### `skill_run_events`

运行日志时间线，SSE 也是从这里拉。

### `approval_requests`

命中高风险 tool policy 时进入待审批。

### `artifacts`

记录结构化产物，当前主要用于运行结果沉淀。

### `app_settings`

当前主要承载 Anthropic 路由相关设置。

---

## 4. 内置 Skill 的真实来源

当前可运行的 skill 不是来自动态导入，而是来自：

- [server/utils/skillRegistry.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRegistry.ts)

访问 skill API 时会调用 `ensureSkillDefinitionsSeeded()`，把这些种子 upsert 进 `skill_definitions`。

注意：

- 这意味着“内置 skill 的定义源头”仍然是代码
- 数据库只是承接展示和运行
- 新增内置 skill 不是只插表，还要补 runner 逻辑

---

## 5. 外部 Skill 的真实来源

当前不是手动导入，而是管理员点击“同步目录”后扫描本机目录：

- `~/.codex/skills`
- `~/.agents/skills`
- `SKILL_SCAN_ROOTS`

扫描逻辑在：

- [server/utils/skillCatalog.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillCatalog.ts)

解析逻辑在：

- [server/utils/skillImporter.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillImporter.ts)

处理流程：

1. 递归寻找包含 `SKILL.md` 的目录
2. 用 `gray-matter` 解析 frontmatter
3. 生成 `SkillDefinitionDetail`
4. 标记为：
   - `source_origin = external`
   - `engine_type = external`
   - `default_provider = external`
5. 写入 `skill_definitions`

这里有一个重要设计点：

- 即使外部 `SKILL.md` 声明了 `provider`、`engine_type`、`default_model`
- 当前也只把这些值作为 `source_metadata` 保留
- 不直接让它进入运行链路

这样可以避免“只靠一个 SKILL.md 就被当成系统可执行 skill”。

补充：

- `GET /api/skills` 不会自动触发扫描
- 目录同步入口是 `POST /api/skills/sync`

---

## 6. 运行链路

### 创建 run

- API：`POST /api/skill-runs`
- 文件：[server/api/skill-runs/index.post.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/api/skill-runs/index.post.ts)

关键限制：

- skill 必须存在
- skill 必须 `active`
- skill 必须 `source_origin === 'builtin'`
- engine 只允许 `llm_direct` / `agent_sdk`

### 执行

- 队列：[server/utils/skillRunQueue.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRunQueue.ts)
- 运行器：[server/utils/skillRunner.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/skillRunner.ts)

当前 runner 依赖 `skill.slug` 做分支，不是配置驱动执行器。

这意味着：

- 新增一个真正可运行的内置 skill
- 至少要改 `skillRegistry.ts`
- 通常还要改 `skillRunner.ts`

---

## 7. Anthropic 路由实现

### 设置持久化

- [server/utils/appSettings.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/appSettings.ts)

当前支持：

- Base URL
- default model
- auth mode
- anthropic version
- API key

### Provider

- [server/utils/providers/anthropic.ts](/Users/dynamic/Documents/GitHub/folo-ai/server/utils/providers/anthropic.ts)

当前行为：

- 自动把 base URL 规范化到 `/v1/messages`
- 支持 `x-api-key` 与 `Bearer`
- 支持 placeholder model 回退到配置默认模型

### 调试接口

- `POST /api/settings/models/anthropic-debug`

特点：

- 走服务端 provider
- 不走浏览器直连
- 适合排查代理兼容性

---

## 8. 当前扩展点

### 最合理的下一步

#### 外部 skill 绑定执行方式

建议新增一个“binding layer”，而不是直接把外部 `SKILL.md` 当成可执行配置。

可以新增：

- `skill_bindings`
- `execution_profiles`
- `external_skill_adapters`

目标是把：

- catalog 元数据
- 实际运行方式

拆成两层。

#### 版本追踪

目前 `source_version` 只是单字段快照，没有同步历史。

如果后续要做对比，建议增加：

- `skill_sync_logs`
- `skill_source_versions`

#### 目录来源管理

当前扫描根目录来自环境变量，后台还没有可视化管理页。

如果后续要给管理员使用，建议新增：

- 扫描根目录配置页
- catalog 同步日志页

---

## 9. 当前限制与风险

### 1. 外部 skill 只纳管不运行

这是当前版本的故意设计，不是功能缺失。

### 2. 内置 skill 仍然是代码驱动

这让 MVP 更稳，但也意味着扩展时还没有做到完全配置化。

### 3. Anthropic key 仍未加密

当前适用于单管理员受控环境，不适合直接拿去做多管理员平台。

### 4. 扫描器默认信任本机 skill 根目录

现在只读取元数据，不执行脚本；但如果未来想读取更多内容，要重新评估安全边界。

---

## 10. 开发时的判断准则

后续如果你要继续改这块，建议先问清楚一个问题：

> 这次需求是“管理 skill 目录”，还是“让某个 skill 真正可运行”？

这两个方向不要混在一起做。

如果是前者，优先改：

- `skillCatalog.ts`
- `skillImporter.ts`
- `skillStore.ts`
- `/admin/skills`

如果是后者，优先改：

- `skillRegistry.ts`
- `skillRunner.ts`
- `skill-runs` API
- Anthropic/OpenAI provider

---

## 11. 交接结论

当前这套 Skill Workbench 已经有明确边界：

- 它已经是一个可用的内部后台模块
- 它还不是一个通用 skill 执行平台
- 它最稳定的状态，是“内置可运行，外部可管理”

只要后续扩展仍然尊重这个分层，代码会比较稳；如果直接把 catalog 层和 execution 层混掉，后面会很快失控。
