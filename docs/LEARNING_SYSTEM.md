# 学习拆解系统 — 设计方案

> folo-ai 新模块：AI 驱动的学习路径生成与管理

**版本**：v0.2（与当前实现对齐）  
**日期**：2026-04-24  
**状态**：已落地 v1，持续迭代中

---

## 一、背景与目标

### 问题

面对一本书或一个知识点，学习者往往缺乏结构化路径：
- 不知道从哪入手，学习顺序混乱
- 读完即忘，没有主动检验机制
- 笔记散落各处，难以回顾

### 目标

在 folo-ai 中新增「学习拆解」模块，用户输入学习目标（书名 / 知识点 / 技能），AI 自动生成结构化学习路径和章节内容，以 Markdown 持久化管理，并在 `/learn` 中持续阅读与回顾。

### 设计原则

1. **folo-ai 为主体**：内容归档于 `content-archive/learning/`，与现有内容体系统一管理
2. **AI 一次性全量生成**：输入主题后自动生成所有章节，无需手动触发
3. **v1 先聚焦生成与阅读**：先打通“生成 → 写 Markdown → 入库/刷新 → 阅读 → 本地进度”，暂不引入问答和任务队列

---

## 二、系统架构

### 总体流程

```
用户输入学习主题
       │
       ▼
POST /api/learn/generate
       │
       ├─ Step 1：AI 生成目录结构（JSON）
       │           ↓
       └─ Step 2：AI 并行生成每章 Markdown
                   ↓
       写入 content-archive/learning/{slug}/
                   ↓
       直接解析本地 Markdown
                   ↓
       刷新 learning_topics / learning_chapters
                   ↓
       /learn 页面展示
```

### 目录结构（新增部分）

```
folo-ai/
├── pages/
│   └── admin/
│       └── learn.vue         # 管理员生成入口
│   └── learn/
│       ├── index.vue          # 学习主题列表
│       ├── [slug].vue         # 某主题目录 + 进度总览
│       └── [slug]/
│           └── [chapter].vue  # 单章阅读 + 完成状态
├── server/
│   └── api/
│       └── learn/
│           ├── generate.post.ts                  # 生成入口
│           ├── topics.get.ts                     # 主题列表
│           └── topics/
│               └── [slug]/
│                   ├── get.ts                    # 主题详情
│                   └── chapters/
│                       └── [chapter].get.ts      # 单章详情
└── content-archive/
    └── learning/
        └── {slug}/
            ├── index.md           # 总览 + 目录
            ├── 01-{chapter}.md
            ├── 02-{chapter}.md
            └── ...
```

---

## 三、内容模型

### 主题 index.md

```markdown
---
title: "深入理解 Linux 内核"
type: learning-topic
topic_slug: linux-kernel
source_type: book          # book | concept | skill
description: "围绕 Linux 内核核心机制的系统学习路径"
total_chapters: 18
estimated_read_minutes: 360
created_at: 2026-04-24
updated_at: 2026-04-24
tags: [linux, kernel, os]
learning_goals:
  - 理解 Linux 内核的主要子系统及其交互
  - 解释进程调度、内存管理、文件系统的核心机制
  - 阅读并理解内核相关源码
---

## 学习目标

完成本学习路径后，你将能够：
- 理解 Linux 内核的主要子系统及其交互
- 解释进程调度、内存管理、文件系统的核心机制
- 阅读并理解内核相关源码

## 目录

1. [内核简介与架构](./01-introduction.md)
2. [进程与线程](./02-processes.md)
...

## 学习建议

预计学习时长：40 小时  
建议顺序：线性阅读，第3章需掌握第2章基础
```

### 章节 {n}-{chapter}.md

```markdown
---
title: "第2章：进程与线程"
topic: "深入理解 Linux 内核"
topic_slug: linux-kernel
chapter_slug: 02-processes
chapter: 2
total_chapters: 18
estimated_minutes: 25
summary: "理解 Linux 中进程/线程的统一抽象方式及状态变化。"
created_at: 2026-04-24
updated_at: 2026-04-24
learning_goals:
  - 理解进程描述符 task_struct
  - 区分进程与线程在 Linux 中的实现差异
  - 掌握进程状态机的转换条件
---

## 核心概念

### 进程描述符

...正文内容，约 800-1500 字...

### 进程状态机

...

## 关键术语

| 术语 | 解释 |
|---|---|
| task_struct | Linux 内核进程描述符，包含进程所有元数据 |
| fork() | 创建子进程的系统调用 |

## 本章小结

...三句话总结核心要点...

## 思考题

> 可以先自己思考，再结合本章内容和延伸阅读继续展开。

1. 为什么 Linux 不区分进程和线程，而是统一用 task_struct？
2. 僵尸进程的产生原因是什么？如何避免？
3. fork() 之后父子进程的内存如何管理？

## 延伸阅读

- Robert Love《Linux Kernel Development》第3章
- kernel.org 文档：[Process Model](...)
```

---

## 四、API 设计

### `POST /api/learn/generate`

**权限**：需要 JWT（管理员操作）

**请求体**

```json
{
  "topic": "深入理解 Linux 内核",
  "source_type": "book",         // book | concept | skill
  "context": "Robert Love 著，第三版",  // 可选补充信息
  "depth": "standard"            // brief(5章) | standard(10-15章) | deep(20+章)
}
```

**响应**（阻塞式；返回时 Markdown 和学习表都已写好）

```json
{
  "slug": "linux-kernel",
  "title": "深入理解 Linux 内核",
  "total_chapters": 14,
  "files_written": [
    "content-archive/learning/linux-kernel/index.md",
    "content-archive/learning/linux-kernel/01-introduction.md",
    ...
  ],
  "estimated_read_minutes": 280
}
```

---

### `GET /api/learn/topics`

返回所有学习主题列表（来自 `learning_topics`）

```json
{
  "topics": [
    {
      "topic_slug": "linux-kernel",
      "title": "深入理解 Linux 内核",
      "total_chapters": 14,
      "source_type": "book",
      "estimated_read_minutes": 280,
      "created_at": "2026-04-24",
      "updated_at": "2026-04-24"
    }
  ]
}
```

---

### `GET /api/learn/topics/:slug`

返回单个学习主题详情，包括主题信息和章节目录。

```json
{
  "topic_slug": "linux-kernel",
  "title": "深入理解 Linux 内核",
  "source_type": "book",
  "description": "围绕 Linux 内核核心机制的系统学习路径",
  "total_chapters": 14,
  "estimated_read_minutes": 280,
  "chapters": [
    {
      "chapter_slug": "01-introduction",
      "chapter_no": 1,
      "title": "第1章：内核简介与架构",
      "estimated_minutes": 20,
      "summary": "建立全书整体框架。"
    }
  ]
}
```

---

### `GET /api/learn/topics/:slug/chapters/:chapter`

返回单章详情，包括章节正文、所属主题和上一章/下一章导航信息。

```json
{
  "topic_slug": "linux-kernel",
  "chapter_slug": "02-processes",
  "chapter_no": 2,
  "title": "第2章：进程与线程",
  "estimated_minutes": 25,
  "summary": "理解 Linux 中进程/线程的统一抽象方式及状态变化。",
  "content_html": "<h2>核心概念</h2>...",
  "topic": {
    "topic_slug": "linux-kernel",
    "title": "深入理解 Linux 内核",
    "total_chapters": 14,
    "estimated_read_minutes": 280
  },
  "prev_chapter": {
    "chapter_slug": "01-introduction",
    "title": "第1章：内核简介与架构"
  },
  "next_chapter": {
    "chapter_slug": "03-scheduler",
    "title": "第3章：进程调度"
  }
}
```

---

## 五、AI 如何把一本书变成 Markdown

### 先说明边界

当前 v1 的实现，不是“把整本书 PDF 或原文逐页转成 Markdown”，而是：

> 把一本书当成一个学习主题，先让 AI 理解这本书应该怎么学，再把这种理解拆成一组结构化 Markdown 学习材料。

也就是说，AI 生成的是**学习版内容**，不是原书的数字化副本。

---

### 整体链路

#### Step 1 — 管理员提供最少必要信息

管理员输入：

- 书名 / 主题名
- 类型（`book` / `concept` / `skill`）
- 深度（`brief` / `standard` / `deep`）
- 补充上下文（作者、版本、重点章节、希望覆盖的方向）

例如：

```json
{
  "topic": "深入理解 Linux 内核",
  "source_type": "book",
  "context": "Robert Love，第三版，重点放在进程调度和内存管理",
  "depth": "standard"
}
```

这一步给 AI 的不是原书正文，而是“这本书是谁写的、学多深、重点在哪”。

#### Step 2 — AI 先做目录级理解

系统不会先生成正文，而是先要求模型输出一份严格 JSON，用来描述整本书的学习路径。当前实现里，这一步会生成：

- 主题标题
- slug
- 简介
- 学习目标
- 标签
- 章节顺序
- 每章预计阅读时长
- 每章学习目标

本质上，这一步是把“一本书”先抽象成“可执行的学习目录”。

可以理解为：

> AI 先回答“这本书应该按什么顺序学”，再回答“每一章具体讲什么”。

#### Step 3 — 服务端把目录规划标准化

AI 输出完 JSON 后，服务端不会原样落盘，而是先做一次标准化处理：

- 清洗 `slug`
- 自动补章节编号
- 统一章节文件名格式（如 `01-introduction.md`）
- 限制学习目标数量
- 为空值补默认值
- 避免与已有主题目录冲突

这一步的作用是把“模型输出”变成“稳定文件结构”，避免未来页面路由、数据库索引、重生成逻辑都依赖一份不稳定文本。

#### Step 4 — AI 再做章节级展开

有了全书目录之后，系统会按章调用模型生成正文。每一章生成时，模型拿到的是：

- 整体主题
- 主题简介
- 当前章节标题
- 当前章节学习目标
- 全书目录
- 用户补充上下文

然后按固定模板输出 Markdown 正文，必须包含：

- `## 核心概念`
- `## 关键术语`
- `## 本章小结`
- `## 思考题`
- `## 延伸阅读`

这意味着 AI 不是“自由发挥写文章”，而是在“整本书目录已经确定”的前提下，逐章产出结构一致的学习材料。

#### Step 5 — 服务端包装成真正的 Markdown 文件

每个主题最终会落成一组 `.md` 文件：

- `index.md`：主题总览、学习目标、目录、学习建议
- `01-xxx.md` / `02-xxx.md`：章节正文

服务端会为这些文件补充 frontmatter，例如：

- `topic_slug`
- `chapter_slug`
- `estimated_minutes`
- `learning_goals`
- `created_at`
- `updated_at`

这样生成结果既是可读内容，也是可索引数据源。

#### Step 6 — 写入本地后立即刷新学习表

文件写入 `content-archive/learning/{topic-slug}/` 后，系统会立刻从磁盘重新读取这些 Markdown：

- 解析 frontmatter
- 提取章节顺序和元数据
- 将 Markdown 转成 HTML
- 刷新 `learning_topics` / `learning_chapters` 两张学习表

因此，SQLite 在这里不是“主数据源”，而是本地 Markdown 的可查询索引。

---

### 为什么要分两步，而不是一次生成整本内容

分两步的好处是：

1. 先固定目录，整套学习材料的结构会更稳定。
2. 章节生成时能看到全书上下文，不容易前后重复或断裂。
3. 文件名、路由、数据库主键都可以在正文生成前先确定。
4. 某一章以后需要重生成时，可以单独做，不必推翻整本主题。

---

### 当前实现的工程约束

- 当前模型调用支持通过配置切换 `minimax` / `deepseek`。
- 生成接口是阻塞式的：请求完成时，Markdown 和学习表都已经写好。
- 真正的 source of truth 是本地 `content-archive/learning/`。
- 页面读取时，列表和目录来自学习表，正文来自 Markdown 渲染结果。

---

### 一句话总结

可以把这套机制理解为：

> AI 不是在“复制一本书”，而是在“把一本书重组为一套可学习、可索引、可维护的 Markdown 学习路径”。

---

## 六、前端页面设计

### `/learn` — 主题列表

```
┌─────────────────────────────────┐
│  我的学习                         │
│                                   │
│  [+ 新建学习主题]                  │
│                                   │
│  ┌───────────────┐ ┌───────────┐ │
│  │ 深入理解Linux  │ │ RAG技术   │ │
│  │ 内核           │ │ 原理      │ │
│  │ 书籍 · 14章    │ │ 概念 · 8章│ │
│  │ 进行中 3/14    │ │ 未开始    │ │
│  └───────────────┘ └───────────┘ │
└─────────────────────────────────┘
```

### `/learn/[slug]` — 主题详情

```
┌─────────────────────────────────┐
│  深入理解 Linux 内核              │
│  14章 · 预计280分钟 · 进行中      │
│                                   │
│  学习目标：...                    │
│                                   │
│  目录                             │
│  ✅ 第1章 内核简介                │
│  ✅ 第2章 进程与线程               │
│  👉 第3章 进程调度 （当前）        │
│     第4章 系统调用                │
│  ...                              │
└─────────────────────────────────┘
```

### `/learn/[slug]/[chapter]` — 单章阅读

```
┌─────────────────────────────────┐
│  ← 上一章          下一章 →      │
│                                   │
│  第3章：进程调度                  │
│  预计25分钟 · 已阅读过            │
│                                   │
│  [章节正文 Markdown 渲染结果]     │
│                                   │
│  ✅ 标记本章已完成                │
└─────────────────────────────────┘
```

---

## 七、数据持久化策略

| 数据类型 | 存储位置 | 说明 |
|---|---|---|
| 主题与章节 Markdown | `content-archive/learning/` | 学习内容的 source of truth |
| 主题索引 | SQLite `learning_topics` | 主题列表、详情、主题正文 HTML 缓存 |
| 章节索引 | SQLite `learning_chapters` | 章节排序、摘要、正文 HTML、上下章导航 |
| 阅读进度 | 浏览器 `localStorage` | 轻量，无需登录 |

### 数据关系

- 本地 Markdown 是主数据源
- `learning_topics` / `learning_chapters` 是从 Markdown 刷新的可查询索引
- 页面读取时直接使用学习表中的结构化字段和 `content_html`

---

## 八、实现阶段

### v1 当前实现

- [x] `POST /api/learn/generate` — 两步生成，阻塞式写本地 Markdown
- [x] 生成后直接刷新 `learning_topics` / `learning_chapters`
- [x] `GET /api/learn/topics` — 主题列表
- [x] `GET /api/learn/topics/:slug` — 主题详情
- [x] `GET /api/learn/topics/:slug/chapters/:chapter` — 单章详情
- [x] `pages/admin/learn.vue` — 管理员生成入口
- [x] `pages/learn/index.vue` — 主题列表
- [x] `pages/learn/[slug].vue` — 主题详情 + 目录
- [x] `pages/learn/[slug]/[chapter].vue` — 章节阅读
- [x] `localStorage` 阅读进度

### 后续可扩展

- [ ] 单章重生成
- [ ] 章节问答（服务端自行读取章节内容）
- [ ] 生成过程进度提示
- [ ] 自动提交/推送到远端 `content-archive`
- [ ] 引入更强的书籍背景检索与事实校验

---

## 九、待决定事项

| 问题 | 选项 A | 选项 B | 备注 |
|---|---|---|---|
| 是否自动同步到 GitHub | 手动 `git push` | 自动 commit + push | 当前实现仅写本地 |
| 是否支持单章重生成 | 暂不支持 | 支持 | 当前实现暂不支持 |
| 是否加入章节问答 | 暂不支持 | 管理员/JWT 可用 | v1 未做 |
| 章节模板是否开放自定义 | 固定模板 | 自定义模板 | v1 先固定 |

---

## 十、关键约束

1. **API 成本**：一个15章主题约消耗 ~30k tokens，按需生成，不批量
2. **文件写入**：生成时直接写 `content-archive/` 本地目录，需确认服务端有写权限
3. **阻塞式时延**：生成接口是同步等待，章节较多时可能需要 30-90 秒
4. **主数据源**：本地 `content-archive/learning/` 是 source of truth，学习表可由本地 Markdown 重建
5. **模型配置**：当前实现支持 `LEARNING_AI_PROVIDER=minimax|deepseek`，并要求配置对应 provider 的 API Key
6. **内容边界**：生成的是学习版 Markdown，不是原书逐页数字化副本

---

*文档基于当前仓库实现整理，后续迭代以代码为准。*
