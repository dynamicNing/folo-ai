import { apiError } from '~/server/utils/auth'
import { getLearningChapter } from '~/server/utils/learningStore'
import type { LearningChapterDetail } from '~/types/learning'

export default defineEventHandler((event): LearningChapterDetail => {
  const slug = getRouterParam(event, 'slug') || ''
  const chapter = getRouterParam(event, 'chapter') || ''
  const detail = getLearningChapter(slug, chapter)
  if (!detail) apiError(404, '章节不存在')
  return detail
})
