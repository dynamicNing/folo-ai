type LearningAiProvider = 'minimax' | 'deepseek'
type LearningTask = 'plan' | 'chapter'

interface LearningTextOptions {
  maxTokens: number
  task: LearningTask
  temperature?: number
}

interface MinimaxResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>
}

function getLearningProvider(): LearningAiProvider {
  const provider = (process.env.LEARNING_AI_PROVIDER || 'minimax').trim().toLowerCase()
  return provider === 'deepseek' ? 'deepseek' : 'minimax'
}

function modelOverrideKey(task: LearningTask): 'LEARNING_AI_MODEL_PLAN' | 'LEARNING_AI_MODEL_CHAPTER' {
  return task === 'plan' ? 'LEARNING_AI_MODEL_PLAN' : 'LEARNING_AI_MODEL_CHAPTER'
}

function resolveModel(provider: LearningAiProvider, task: LearningTask): string {
  const override = process.env[modelOverrideKey(task)]?.trim()
  if (override) return override

  if (provider === 'deepseek') {
    return (process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim()
  }

  return (process.env.MINIMAX_MODEL || 'MiniMax-Text-01').trim()
}

async function callMinimax(prompt: string, options: LearningTextOptions): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('缺少 MINIMAX_API_KEY，无法生成学习内容')

  const endpoint = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2').trim()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolveModel('minimax', options.task),
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens,
    }),
  })

  if (!res.ok) throw new Error(`MiniMax API error: ${res.status}`)
  const data = await res.json() as MinimaxResponse
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callDeepSeek(prompt: string, options: LearningTextOptions): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('缺少 DEEPSEEK_API_KEY，无法生成学习内容')

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolveModel('deepseek', options.task),
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens,
      stream: false,
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
  const data = await res.json() as DeepSeekResponse
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function generateLearningText(prompt: string, options: LearningTextOptions): Promise<string> {
  const provider = getLearningProvider()
  return provider === 'deepseek'
    ? callDeepSeek(prompt, options)
    : callMinimax(prompt, options)
}
