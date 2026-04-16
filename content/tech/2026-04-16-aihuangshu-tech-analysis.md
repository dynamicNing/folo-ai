---
title: 降噪 aihuangshu.com 技术架构分析
summary: 分析 aihuangshu.com（降噪 AI精选内容平台）的技术栈、内容存储与展示机制，重点解析其以 Airtable 为 CMS、Next.js RSC 为展示层的内容流水线。
tags: [技术分析, Next.js, Airtable, CMS]
status: published
date: 2026-04-16
---

## 概述

aihuangshu.com（降噪）是黄叔运营的 AI 精选内容平台，定位为「黄叔精选 + AI 生成，帮你从海量信息中过滤噪音，5 分钟获取优质访谈里的深度洞察」。

本文通过分析页面源码、RSC payload、JS bundle 及网络请求，还原其完整技术架构。

---

## 前端技术栈

| 技术 | 依据 |
|------|------|
| **Next.js 15 App Router** | `/_next/static/chunks/` 路径、RSC payload（`self.__next_f.push`）、无 `__NEXT_DATA__`（App Router 特征） |
| **React Server Components** | 所有内容通过 RSC 序列化传输，页面无客户端 API 调用 |
| **Turbopack** | `turbopack-496ddac884163a94.js` chunk 存在 |
| **Tailwind CSS + CSS Modules** | `antialiased` class、`card-module__KKvHUq__cardHover` 等 CSS Module hash 命名 |
| **shadcn/ui** | HTML 中能识别 shadcn 组件痕迹 |
| **Geist 字体** | `geist_a71539c9-module__T19VSG__variable`（Vercel 官方字体） |

### 部署平台

**Vercel**（IP `216.198.79.1`，Let's Encrypt 自动证书，配合 Geist 字体组合印证）

---

## 内容存储：Airtable 作为 CMS

这是架构中最核心的部分。所有内容 URL 格式为 `/content/recvgSHZMKV1MH`，其中 `rec` 开头的字母数字串是 **Airtable 记录 ID 的专有格式**。

### Airtable 数据 Schema

通过 RSC payload 可以还原完整的字段结构：

```json
{
  "id": "recvgSHZMKV1MH",
  "title": "被低估的6.5亿人：为什么拉丁美洲AI机会比美国大两倍",
  "guest": "Sebastián Mejía (Rappi联合创始人) | 主持人: A16z Show",
  "platform": "YouTube",
  "coverUrl": "https://img.youtube.com/vi/soVSK6tzAEs/maxresdefault.jpg",
  "tags": ["AI Business"],
  "quotes": [
    "「拉丁美洲从来没有真正用上软件，这就是为什么AI的机会在这里是两倍。」",
    "「不要再谈模型，不要再谈智能体，跟我说这个Agent在帮公司做什么工作。」"
  ],
  "summary": "...AI 生成的长篇 Markdown 正文...",
  "originalUrl": "https://www.youtube.com/watch?v=soVSK6tzAEs",
  "status": "已发布",
  "publishDate": "2026-04-15T00:00:00.000Z",
  "submittedAt": "2026-04-15T17:23:56.170Z"
}
```

### 内容来源

- **YouTube** 视频访谈（封面图直接用 `img.youtube.com/vi/{videoId}/maxresdefault.jpg`）
- **小宇宙** 等中文播客平台
- 其他访谈/对话内容

---

## 内容生产流水线

```
YouTube / 小宇宙 / 其他访谈来源
            ↓
      [人工筛选 / 提交]
            ↓
      Airtable 录入 (submittedAt 时间戳)
            ↓
      AI 生成结构化摘要
      （长篇 Markdown：背景、核心观点、金句、洞察）
            ↓
      Airtable 写入 summary 字段
            ↓
      status 改为「已发布」(publishDate)
            ↓
  Next.js Server Components 服务端读取 Airtable API
            ↓
      SSR 渲染 → 用户访问页面
```

---

## 内容展示机制

### 数据获取

Next.js Server Components 在**服务端**直接调用 Airtable REST API，Airtable API Token 不暴露给客户端。页面内容以 RSC payload 格式内联在 HTML 中传输。

### 图片代理

| 场景 | 方案 |
|------|------|
| YouTube 封面 | 直接引用 `img.youtube.com/vi/{id}/maxresdefault.jpg` |
| 非 YouTube 封面 | `/api/image?token=...`（Next.js API Route 代理） |

`/api/image` 路由的作用：Airtable 附件 URL 有时效性，通过代理层重新签发 token，避免封面图过期失效。

### 正文渲染

`summary` 字段存储 AI 生成的结构化 Markdown，服务端渲染成 HTML 后直接输出。正文包含：章节标题、加粗金句、段落叙事，风格统一（明显是同一套 prompt 产出）。

### 分类导航

通过 Airtable `tags` 字段实现全局分类，已观察到的标签：

- AI Business
- AI Coding
- AI Products
- AI Organization

---

## 架构总结

```
Airtable（CMS / 数据库）
      ↕ REST API（服务端）
Next.js 15 App Router（SSR + RSC）
      ↕ HTML + RSC payload
用户浏览器（React hydration）
```

**核心设计思路**：用 Airtable 替代传统数据库，零运维成本，非工程师也可录入和管理内容；Next.js RSC 保证首屏渲染性能和 SEO；AI 负责内容生产，人工只做筛选。

---

## 与 folo-ai 的对比参考

| 维度 | aihuangshu.com | folo-ai（本项目） |
|------|---------------|-----------------|
| 内容存储 | Airtable（云端数据库） | 本地 Markdown 文件 |
| CMS 管理 | Airtable 界面，无需开发 | 自建 Admin 面板 |
| 内容分类 | `tags` 字段多值标签 | 文件夹分类 |
| 数据获取 | 服务端 Airtable API | 服务端读取本地文件 |
| 图片处理 | `/api/image` 代理层 | 无封面图 |
| 渲染方式 | Next.js RSC（SSR） | Vue 3 SPA + Express API |
| 内容生产 | AI 生成长篇访谈摘要 | AI 生成每日资讯日报 |
| 部署 | Vercel | 自托管 |

本地 Markdown 方案在内容量较小时更灵活可控，适合当前阶段；如内容量增大或需要多人协作录入，可参考 Airtable 作为外部 CMS 的思路。
