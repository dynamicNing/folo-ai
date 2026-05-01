export interface SkillChatSessionRecord {
  id: string
  title: string
  preview: string
  messageCount: number
  messages: unknown[]
  createdAt: string
  updatedAt: string
}

export interface SkillChatSessionCreateRequest {
  title?: string
  preview?: string
  messageCount?: number
  messages?: unknown[]
}

export interface SkillChatSessionUpdateRequest {
  title?: string
  preview?: string
  messageCount?: number
  messages: unknown[]
}
