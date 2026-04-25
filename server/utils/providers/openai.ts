interface OpenAITextOptions {
  model: string
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
}

interface OpenAIResponse {
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: {
    message?: string
  }
}

function extractText(data: OpenAIResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()

  const chunks = (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' || item.type === 'text' || (!item.type && item.text))
    .map(item => item.text?.trim() || '')
    .filter(Boolean)

  return chunks.join('\n').trim()
}

export async function generateOpenAIText(options: OpenAITextOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('缺少 OPENAI_API_KEY，无法执行 OpenAI skill')

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const res = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      instructions: options.system || undefined,
      input: options.prompt,
      temperature: options.temperature ?? 0.3,
      max_output_tokens: options.maxTokens ?? 1200,
    }),
  })

  const data = await res.json().catch(() => ({})) as OpenAIResponse
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI API error: ${res.status}`)
  }

  const text = extractText(data)
  if (!text) throw new Error('OpenAI 未返回可用文本结果')
  return text
}
