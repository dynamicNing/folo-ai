import { listLearningTopics } from '~/server/utils/learningStore'
import type { LearningTopic } from '~/types/learning'

export default defineEventHandler((): { topics: LearningTopic[] } => {
  return { topics: listLearningTopics() }
})
