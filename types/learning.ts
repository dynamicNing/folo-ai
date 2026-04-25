export type LearningSourceType = 'book' | 'concept' | 'skill'
export type LearningDepth = 'brief' | 'standard' | 'deep'

export interface LearningTopic {
  topic_slug: string
  title: string
  source_type: LearningSourceType
  description: string
  learning_goals: string[]
  tags: string[]
  total_chapters: number
  estimated_read_minutes: number
  content_html: string
  repo_path: string
  created_at: string
  updated_at: string
}

export interface LearningChapterSummary {
  topic_slug: string
  chapter_slug: string
  chapter_no: number
  title: string
  estimated_minutes: number
  learning_goals: string[]
  summary: string
  repo_path: string
  created_at: string
  updated_at: string
}

export interface LearningTopicDetail extends LearningTopic {
  chapters: LearningChapterSummary[]
}

export interface LearningAdjacentChapter {
  chapter_slug: string
  title: string
}

export interface LearningChapterDetail extends LearningChapterSummary {
  content_html: string
  topic: Pick<LearningTopic, 'topic_slug' | 'title' | 'total_chapters' | 'estimated_read_minutes'>
  prev_chapter: LearningAdjacentChapter | null
  next_chapter: LearningAdjacentChapter | null
}

export interface LearningGenerateResponse {
  slug: string
  title: string
  total_chapters: number
  files_written: string[]
  estimated_read_minutes: number
}
