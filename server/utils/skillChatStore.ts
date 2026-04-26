import { randomUUID } from 'node:crypto'
import { db } from './db'
import type { SkillChatSessionCreateRequest, SkillChatSessionRecord, SkillChatSessionUpdateRequest } from '../../types/skillChat'

interface SkillChatSessionRow {
  id: string
  title: string
  preview: string
  message_count: number
  messages_json: string
  created_at: string
  updated_at: string
}

function parseMessages(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToSession(row: SkillChatSessionRow): SkillChatSessionRecord {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview,
    messageCount: row.message_count,
    messages: parseMessages(row.messages_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listSkillChatSessions(): SkillChatSessionRecord[] {
  const rows = db.prepare(`
    SELECT id, title, preview, message_count, messages_json, created_at, updated_at
    FROM skill_chat_sessions
    ORDER BY updated_at DESC, created_at DESC
  `).all() as SkillChatSessionRow[]

  return rows.map(rowToSession)
}

export function getSkillChatSession(id: string): SkillChatSessionRecord | null {
  const row = db.prepare(`
    SELECT id, title, preview, message_count, messages_json, created_at, updated_at
    FROM skill_chat_sessions
    WHERE id = ?
    LIMIT 1
  `).get(id) as SkillChatSessionRow | undefined

  return row ? rowToSession(row) : null
}

export function createSkillChatSession(input: SkillChatSessionCreateRequest = {}): SkillChatSessionRecord {
  const now = new Date().toISOString()
  const messages = Array.isArray(input.messages) ? input.messages : []
  const title = (input.title || '').trim() || '新会话'
  const preview = (input.preview || '').trim()
  const messageCount = typeof input.messageCount === 'number'
    ? Math.max(0, Math.floor(input.messageCount))
    : messages.length
  const id = randomUUID()

  db.prepare(`
    INSERT INTO skill_chat_sessions (
      id, title, preview, message_count, messages_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title,
    preview,
    messageCount,
    JSON.stringify(messages),
    now,
    now,
  )

  return getSkillChatSession(id) as SkillChatSessionRecord
}

export function updateSkillChatSession(id: string, input: SkillChatSessionUpdateRequest): SkillChatSessionRecord | null {
  const existing = getSkillChatSession(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const messages = Array.isArray(input.messages) ? input.messages : existing.messages
  const title = (input.title || '').trim() || existing.title || '新会话'
  const preview = typeof input.preview === 'string' ? input.preview.trim() : existing.preview
  const messageCount = typeof input.messageCount === 'number'
    ? Math.max(0, Math.floor(input.messageCount))
    : messages.length

  db.prepare(`
    UPDATE skill_chat_sessions
    SET title = ?,
        preview = ?,
        message_count = ?,
        messages_json = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    title,
    preview,
    messageCount,
    JSON.stringify(messages),
    now,
    id,
  )

  return getSkillChatSession(id)
}

export function deleteSkillChatSession(id: string): boolean {
  const result = db.prepare('DELETE FROM skill_chat_sessions WHERE id = ?').run(id)
  return result.changes > 0
}
