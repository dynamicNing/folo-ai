import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'
import { db } from './db'
import { ensureLearningDir, repoPathFromAbsolute, topicDir, topicIndexPath } from './archivePaths'
import type { LearningChapterDetail, LearningChapterSummary, LearningSourceType, LearningTopic, LearningTopicDetail } from '../../types/learning'

marked.setOptions({ breaks: true, gfm: true })

interface TopicRow {
  topic_slug: string
  repo_path: string
  title: string
  source_type: LearningSourceType
  description: string
  learning_goals: string
  tags: string
  total_chapters: number
  estimated_read_minutes: number
  content_html: string
  created_at: string
  updated_at: string
}

interface ChapterRow {
  topic_slug: string
  chapter_slug: string
  repo_path: string
  chapter_no: number
  title: string
  estimated_minutes: number
  learning_goals: string
  summary: string
  content_html: string
  created_at: string
  updated_at: string
}

interface ParsedTopicFile {
  topic: LearningTopic
  chapters: LearningChapterSummary[]
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

function summaryFromBody(body: string): string {
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim()
    if (line.length >= 24) return line.length > 120 ? `${line.slice(0, 120)}…` : line
  }
  return ''
}

function rowToTopic(row: TopicRow): LearningTopic {
  return {
    topic_slug: row.topic_slug,
    repo_path: row.repo_path,
    title: row.title,
    source_type: row.source_type,
    description: row.description,
    learning_goals: parseJsonArray(row.learning_goals),
    tags: parseJsonArray(row.tags),
    total_chapters: Number(row.total_chapters) || 0,
    estimated_read_minutes: Number(row.estimated_read_minutes) || 0,
    content_html: row.content_html,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToChapter(row: ChapterRow): LearningChapterSummary {
  return {
    topic_slug: row.topic_slug,
    chapter_slug: row.chapter_slug,
    repo_path: row.repo_path,
    chapter_no: Number(row.chapter_no) || 0,
    title: row.title,
    estimated_minutes: Number(row.estimated_minutes) || 0,
    learning_goals: parseJsonArray(row.learning_goals),
    summary: row.summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function parseTopicFromDisk(topicSlug: string): ParsedTopicFile {
  const indexPath = topicIndexPath(topicSlug)
  if (!fs.existsSync(indexPath)) throw new Error(`学习主题不存在: ${topicSlug}`)

  const topicRaw = fs.readFileSync(indexPath, 'utf-8')
  const { data: topicMeta, content: topicBody } = matter(topicRaw)
  const topicRepoPath = repoPathFromAbsolute(indexPath)
  const createdAt = String(topicMeta.created_at || new Date().toISOString())
  const updatedAt = String(topicMeta.updated_at || createdAt)

  const chapterFiles = fs.readdirSync(topicDir(topicSlug))
    .filter(file => file.endsWith('.md') && file.toLowerCase() !== 'index.md')
    .sort()

  const chapters = chapterFiles.map((file): LearningChapterSummary => {
    const filePath = path.join(topicDir(topicSlug), file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const chapterCreatedAt = String(data.created_at || createdAt)
    const chapterUpdatedAt = String(data.updated_at || chapterCreatedAt)
    return {
      topic_slug: topicSlug,
      chapter_slug: String(data.chapter_slug || file.replace(/\.md$/, '')),
      chapter_no: Number(data.chapter || 0),
      title: String(data.title || file.replace(/\.md$/, '')),
      estimated_minutes: Number(data.estimated_minutes || 0),
      learning_goals: parseJsonArray(data.learning_goals),
      summary: String(data.summary || summaryFromBody(content)),
      repo_path: repoPathFromAbsolute(filePath),
      created_at: chapterCreatedAt,
      updated_at: chapterUpdatedAt,
    }
  }).sort((a, b) => a.chapter_no - b.chapter_no)

  const totalMinutes = chapters.reduce((sum, chapter) => sum + chapter.estimated_minutes, 0)

  return {
    topic: {
      topic_slug: String(topicMeta.topic_slug || topicSlug),
      repo_path: topicRepoPath,
      title: String(topicMeta.title || topicSlug),
      source_type: String(topicMeta.source_type || 'concept') as LearningSourceType,
      description: String(topicMeta.description || ''),
      learning_goals: parseJsonArray(topicMeta.learning_goals),
      tags: parseJsonArray(topicMeta.tags),
      total_chapters: Number(topicMeta.total_chapters || chapters.length),
      estimated_read_minutes: Number(topicMeta.estimated_read_minutes || totalMinutes),
      content_html: marked(topicBody) as string,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    chapters,
  }
}

export function refreshLearningTopic(topicSlug: string): LearningTopicDetail {
  const parsed = parseTopicFromDisk(topicSlug)
  const tx = db.transaction((topic: LearningTopic, chapters: LearningChapterSummary[]) => {
    db.prepare(`
      INSERT INTO learning_topics (
        topic_slug, repo_path, title, source_type, description, learning_goals, tags,
        total_chapters, estimated_read_minutes, content_html, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(topic_slug) DO UPDATE SET
        repo_path = excluded.repo_path,
        title = excluded.title,
        source_type = excluded.source_type,
        description = excluded.description,
        learning_goals = excluded.learning_goals,
        tags = excluded.tags,
        total_chapters = excluded.total_chapters,
        estimated_read_minutes = excluded.estimated_read_minutes,
        content_html = excluded.content_html,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `).run(
      topic.topic_slug,
      topic.repo_path,
      topic.title,
      topic.source_type,
      topic.description,
      JSON.stringify(topic.learning_goals),
      JSON.stringify(topic.tags),
      topic.total_chapters,
      topic.estimated_read_minutes,
      topic.content_html,
      topic.created_at,
      topic.updated_at
    )

    db.prepare('DELETE FROM learning_chapters WHERE topic_slug = ?').run(topic.topic_slug)

    const insertChapter = db.prepare(`
      INSERT INTO learning_chapters (
        topic_slug, chapter_slug, repo_path, chapter_no, title, estimated_minutes,
        learning_goals, summary, content_html, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const chapter of chapters) {
      const absolutePath = path.join(topicDir(topic.topic_slug), `${chapter.chapter_slug}.md`)
      const raw = fs.readFileSync(absolutePath, 'utf-8')
      const { content } = matter(raw)
      insertChapter.run(
        chapter.topic_slug,
        chapter.chapter_slug,
        chapter.repo_path,
        chapter.chapter_no,
        chapter.title,
        chapter.estimated_minutes,
        JSON.stringify(chapter.learning_goals),
        chapter.summary,
        marked(content) as string,
        chapter.created_at,
        chapter.updated_at
      )
    }
  })

  tx(parsed.topic, parsed.chapters)
  return {
    ...parsed.topic,
    chapters: parsed.chapters,
  }
}

export function listLearningTopics(): LearningTopic[] {
  const rows = db.prepare(`
    SELECT topic_slug, repo_path, title, source_type, description, learning_goals, tags,
           total_chapters, estimated_read_minutes, content_html, created_at, updated_at
    FROM learning_topics
    ORDER BY created_at DESC, updated_at DESC
  `).all() as TopicRow[]

  return rows.map(rowToTopic)
}

export function getLearningTopic(topicSlug: string): LearningTopicDetail | null {
  const topicRow = db.prepare(`
    SELECT topic_slug, repo_path, title, source_type, description, learning_goals, tags,
           total_chapters, estimated_read_minutes, content_html, created_at, updated_at
    FROM learning_topics
    WHERE topic_slug = ?
  `).get(topicSlug) as TopicRow | undefined

  if (!topicRow) return null

  const chapterRows = db.prepare(`
    SELECT topic_slug, chapter_slug, repo_path, chapter_no, title, estimated_minutes,
           learning_goals, summary, content_html, created_at, updated_at
    FROM learning_chapters
    WHERE topic_slug = ?
    ORDER BY chapter_no ASC
  `).all(topicSlug) as ChapterRow[]

  return {
    ...rowToTopic(topicRow),
    chapters: chapterRows.map(rowToChapter),
  }
}

export function getLearningChapter(topicSlug: string, chapterSlug: string): LearningChapterDetail | null {
  const topic = getLearningTopic(topicSlug)
  if (!topic) return null

  const chapterRow = db.prepare(`
    SELECT topic_slug, chapter_slug, repo_path, chapter_no, title, estimated_minutes,
           learning_goals, summary, content_html, created_at, updated_at
    FROM learning_chapters
    WHERE topic_slug = ? AND chapter_slug = ?
  `).get(topicSlug, chapterSlug) as ChapterRow | undefined

  if (!chapterRow) return null

  const chapters = topic.chapters
  const index = chapters.findIndex(chapter => chapter.chapter_slug === chapterSlug)
  const prev = index > 0 ? chapters[index - 1] : null
  const next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null

  return {
    ...rowToChapter(chapterRow),
    content_html: chapterRow.content_html,
    topic: {
      topic_slug: topic.topic_slug,
      title: topic.title,
      total_chapters: topic.total_chapters,
      estimated_read_minutes: topic.estimated_read_minutes,
    },
    prev_chapter: prev ? { chapter_slug: prev.chapter_slug, title: prev.title } : null,
    next_chapter: next ? { chapter_slug: next.chapter_slug, title: next.title } : null,
  }
}

export function topicSlugExists(topicSlug: string): boolean {
  const row = db.prepare('SELECT topic_slug FROM learning_topics WHERE topic_slug = ?').get(topicSlug) as { topic_slug: string } | undefined
  return !!row || fs.existsSync(path.join(ensureLearningDir(), topicSlug))
}
