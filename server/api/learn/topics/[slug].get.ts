import { apiError } from '~/server/utils/auth'
import { getLearningTopic } from '~/server/utils/learningStore'
import type { LearningTopicDetail } from '~/types/learning'

export default defineEventHandler((event): LearningTopicDetail => {
  const slug = getRouterParam(event, 'slug') || ''
  const topic = getLearningTopic(slug)
  if (!topic) apiError(404, '学习主题不存在')
  return topic
})
