import type { SkillDefinitionDetail } from '../../types/skill'

const DEFAULT_ANTHROPIC_MODEL = process.env.SKILL_ANTHROPIC_DEFAULT_MODEL?.trim() || 'anthropic-default'
const CREATED_AT = '2026-04-25T00:00:00.000Z'

export const DEFAULT_SKILL_DEFINITIONS: SkillDefinitionDetail[] = [
  {
    slug: 'learning-topic-generator',
    name: '学习主题拆解',
    description: '围绕书籍、概念或技能主题生成结构化学习路径，并为后续内容写入预留工作流入口。',
    category: 'workflow',
    engine_type: 'llm_direct',
    source_type: 'inline',
    source_path: null,
    source_origin: 'builtin',
    source_label: 'Built-in',
    source_version: 'seed-2026-04-25',
    source_metadata: {
      tags: ['学习路径', '主题拆解', '课程设计'],
      trigger_keywords: ['学习路径', '拆解主题', '课程大纲', '学习计划'],
      limitations: [
        '当前输出是结构化学习路径，不会自动读取整本书或长文全文。',
        '主题过大时，建议在 context 中补充读者背景和学习范围。',
      ],
      examples: [
        {
          title: '把一本技术书拆成学习路径',
          prompt: '帮我把 Clean Architecture 拆成面向 Web 工程师的学习路径',
          note: '适合先验证 chapter 结构是否合理，再决定是否继续写入 learn 流程。',
          input: {
            topic: 'Clean Architecture',
            source_type: 'book',
            depth: 'standard',
            context: '面向有 3 年 Web 开发经验、准备补软件架构基础的工程师',
          },
        },
        {
          title: '拆一个技能主题',
          prompt: '围绕提示词工程做一个从入门到实践的学习地图',
          input: {
            topic: '提示词工程',
            source_type: 'skill',
            depth: 'deep',
            context: '重点覆盖工作流设计、评估方法和团队协作规范',
          },
        },
      ],
    },
    input_schema: {
      type: 'object',
      required: ['topic', 'source_type'],
      properties: {
        topic: { type: 'string', title: '学习主题' },
        source_type: { type: 'string', enum: ['book', 'concept', 'skill'], title: '主题类型' },
        depth: { type: 'string', enum: ['brief', 'standard', 'deep'], title: '生成深度' },
        context: { type: 'string', title: '补充上下文' },
      },
    },
    output_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        total_chapters: { type: 'number' },
        estimated_read_minutes: { type: 'number' },
      },
    },
    default_provider: 'anthropic',
    default_model: DEFAULT_ANTHROPIC_MODEL,
    tool_policy: {
      network: true,
      filesystem_read: true,
      filesystem_write: true,
      shell: false,
      browser: false,
      approval_required: true,
    },
    status: 'active',
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    slug: 'article-summary-polisher',
    name: '文章摘要润色',
    description: '对已有正文或摘要进行压缩、提炼和重写，输出适合归档或展示的 Markdown 摘要。',
    category: 'prompt',
    engine_type: 'llm_direct',
    source_type: 'inline',
    source_path: null,
    source_origin: 'builtin',
    source_label: 'Built-in',
    source_version: 'seed-2026-04-25',
    source_metadata: {
      tags: ['摘要', '润色', '重写'],
      trigger_keywords: ['摘要润色', '压缩正文', '提炼要点', '总结文章'],
      limitations: [
        '它擅长压缩和重写已有内容，不负责事实核验。',
        '如果正文过长，建议先截取重点段落再运行。',
      ],
      examples: [
        {
          title: '把长文压成归档摘要',
          prompt: '把下面的技术长文压缩成一段摘要和 3 个要点',
          input: {
            title: 'Anthropic Model Routing Notes',
            tone: 'technical',
            content: '本文整理了我们在接代理路由时踩过的兼容性问题，包括 endpoint 拼接、认证头差异、fallback 策略与日志定位方法。',
          },
        },
        {
          title: '生成更短的中性摘要',
          prompt: '把这段项目复盘压成适合后台展示的简短摘要',
          input: {
            title: '项目复盘',
            tone: 'brief',
            content: '本次上线主要解决了模型配置漂移、长时间任务缺乏状态可视化、以及外部技能目录难以统一检索三个问题。',
          },
        },
      ],
    },
    input_schema: {
      type: 'object',
      required: ['content'],
      properties: {
        title: { type: 'string', title: '标题' },
        content: { type: 'string', title: '正文' },
        tone: { type: 'string', enum: ['neutral', 'technical', 'brief'], title: '语气' },
      },
    },
    output_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        bullets: { type: 'array', items: { type: 'string' } },
      },
    },
    default_provider: 'anthropic',
    default_model: DEFAULT_ANTHROPIC_MODEL,
    tool_policy: {
      network: false,
      filesystem_read: false,
      filesystem_write: false,
      shell: false,
      browser: false,
      approval_required: false,
    },
    status: 'active',
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  {
    slug: 'daily-ai-briefing',
    name: '每日 AI 简报',
    description: '基于主题、日期和补充来源线索生成一版 AI 日报草稿，当前采用托管式多步 workflow runner。',
    category: 'workflow',
    engine_type: 'agent_sdk',
    source_type: 'inline',
    source_path: null,
    source_origin: 'builtin',
    source_label: 'Built-in',
    source_version: 'seed-2026-04-25',
    source_metadata: {
      tags: ['日报', '研究', '工作流'],
      trigger_keywords: ['AI 简报', '日报草稿', '行业简报', '资讯汇总'],
      limitations: [
        '当前更适合生成“草稿”，最终发布前仍需要人工做事实校验。',
        '研究阶段依赖现有来源与模型输出质量，不保证覆盖全部重要事件。',
      ],
      examples: [
        {
          title: '生成一版 AI 日报草稿',
          prompt: '给 2026-04-26 做一版中文 AI 日报草稿，面向产品和技术读者',
          note: '会按 research -> plan -> compose 三步执行，适合观察事件流。',
          input: {
            date: '2026-04-26',
            topic: 'AI 产品与模型动态',
            locale: 'zh-CN',
            audience: '关注模型、代理和 AI 产品发布节奏的产品与技术读者',
            source_notes: '优先关注模型发布、重要融资、开发者工具更新',
          },
        },
      ],
    },
    input_schema: {
      type: 'object',
      required: ['date', 'topic'],
      properties: {
        date: { type: 'string', title: '日期' },
        topic: { type: 'string', title: '主题' },
        locale: { type: 'string', title: '语言/区域' },
        audience: { type: 'string', title: '目标读者' },
        source_notes: { type: 'string', title: '补充来源线索' },
      },
    },
    output_schema: {
      type: 'object',
      properties: {
        markdown: { type: 'string' },
        items_count: { type: 'number' },
      },
    },
    default_provider: 'anthropic',
    default_model: DEFAULT_ANTHROPIC_MODEL,
    tool_policy: {
      network: true,
      filesystem_read: false,
      filesystem_write: true,
      shell: false,
      browser: false,
      approval_required: true,
    },
    status: 'active',
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
]
