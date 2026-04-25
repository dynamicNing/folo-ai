import { apiError, requireAuth } from '~/server/utils/auth'
import { generateLearningTopic } from '~/server/utils/learningGenerator'
import type { LearningDepth, LearningGenerateResponse, LearningSourceType } from '~/types/learning'

interface GenerateBody {
  topic?: string
  source_type?: LearningSourceType
  context?: string
  depth?: LearningDepth
}

const VALID_SOURCE_TYPES = new Set<LearningSourceType>(['book', 'concept', 'skill'])
const VALID_DEPTHS = new Set<LearningDepth>(['brief', 'standard', 'deep'])

export default defineEventHandler(async (event): Promise<LearningGenerateResponse> => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as GenerateBody

  const topic = body.topic?.trim() || ''
  if (!topic) apiError(400, '学习主题不能为空')

  const sourceType = VALID_SOURCE_TYPES.has(body.source_type || 'concept')
    ? (body.source_type || 'concept')
    : 'concept'
  const depth = VALID_DEPTHS.has(body.depth || 'standard')
    ? (body.depth || 'standard')
    : 'standard'

  try {
    return await generateLearningTopic({
      topic,
      source_type: sourceType,
      context: body.context?.trim() || '',
      depth,
    })
  } catch (err) {
    apiError(500, (err as Error).message)
  }
})
