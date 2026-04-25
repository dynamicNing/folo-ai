import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getSkillDefinition, upsertSkillDefinition } from './skillStore'
import type {
  EngineType,
  Provider,
  SkillCategory,
  SkillDefinitionDetail,
  SkillSourceType,
  SkillToolPolicy,
} from '../../types/skill'

interface ImportSkillInput {
  skillPath: string
  slug?: string
}

const EMPTY_POLICY: SkillToolPolicy = {
  network: false,
  filesystem_read: false,
  filesystem_write: false,
  shell: false,
  browser: false,
  approval_required: false,
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveSkillFiles(inputPath: string): { skillDir: string; skillFile: string } {
  const absolute = path.resolve(inputPath.trim())
  if (!fs.existsSync(absolute)) throw new Error('skill_path 不存在')

  const stat = fs.statSync(absolute)
  if (stat.isFile()) {
    if (path.basename(absolute) !== 'SKILL.md') throw new Error('请传入 skill 目录或 SKILL.md 文件')
    return { skillDir: path.dirname(absolute), skillFile: absolute }
  }

  const skillFile = path.join(absolute, 'SKILL.md')
  if (!fs.existsSync(skillFile)) throw new Error('目标目录下缺少 SKILL.md')
  return { skillDir: absolute, skillFile }
}

function firstParagraph(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map(block => block.replace(/^#+\s+/gm, '').trim())
    .find(Boolean) || ''
}

function normalizeCategory(value: unknown): SkillCategory {
  return value === 'prompt' || value === 'agent' || value === 'workflow' || value === 'external'
    ? value
    : 'external'
}

function normalizeProvider(value: unknown): Provider {
  return value === 'openai' || value === 'anthropic' || value === 'external'
    ? value
    : 'external'
}

function normalizeEngine(value: unknown): EngineType {
  return value === 'llm_direct' || value === 'agent_sdk' || value === 'external'
    ? value
    : 'external'
}

function normalizeSourceType(value: unknown): SkillSourceType {
  return value === 'inline' || value === 'skill_folder' || value === 'external_path'
    ? value
    : 'external_path'
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizePolicy(value: unknown): SkillToolPolicy {
  const raw = normalizeObject(value)
  return {
    network: !!raw.network,
    filesystem_read: !!raw.filesystem_read,
    filesystem_write: !!raw.filesystem_write,
    shell: !!raw.shell,
    browser: !!raw.browser,
    approval_required: !!raw.approval_required,
  }
}

function readPackageVersion(skillDir: string): string | null {
  const pkgPath = path.join(skillDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return null

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: unknown }
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : null
  } catch {
    return null
  }
}

export function buildImportedSkillDefinition(input: ImportSkillInput): SkillDefinitionDetail {
  const rawPath = input.skillPath.trim()
  if (!rawPath) throw new Error('skill_path 不能为空')

  const { skillDir, skillFile } = resolveSkillFiles(rawPath)
  const fileText = fs.readFileSync(skillFile, 'utf8')
  const parsed = matter(fileText)
  const frontmatter = normalizeObject(parsed.data)

  const displayName = String(frontmatter.name || path.basename(skillDir)).trim()
  if (!displayName) throw new Error('SKILL.md 缺少可用的 name')

  const slug = sanitizeSlug(input.slug || String(frontmatter.slug || displayName))
  if (!slug) throw new Error('无法生成合法 slug，请手动指定 slug')

  const existing = getSkillDefinition(slug)
  if (existing?.source_origin === 'builtin' && existing.source_path !== skillDir) {
    throw new Error('该 slug 已被内置 skill 占用，请调整 skill 名称或目录名')
  }
  if (existing?.source_origin === 'external' && existing.source_path && existing.source_path !== skillDir && !input.slug) {
    throw new Error('发现同名外部 skill，且来源目录不同，请调整名称避免冲突')
  }

  const description = String(frontmatter.description || firstParagraph(parsed.content) || `${displayName} imported from external skill folder.`).trim()
  const declaredProvider = normalizeProvider(frontmatter.default_provider || frontmatter.provider)
  const declaredEngineType = normalizeEngine(frontmatter.engine_type || (declaredProvider === 'external' ? 'external' : 'llm_direct'))
  const category = normalizeCategory(frontmatter.category || (declaredEngineType === 'external' ? 'external' : 'agent'))
  const version = String(frontmatter.version || readPackageVersion(skillDir) || '').trim() || null
  const createdAt = existing?.created_at || new Date().toISOString()
  const updatedAt = new Date().toISOString()

  const detail: SkillDefinitionDetail = {
    slug,
    name: displayName,
    description,
    category,
    engine_type: 'external',
    source_type: normalizeSourceType(frontmatter.source_type),
    source_path: skillDir,
    source_origin: 'external',
    source_label: String(frontmatter.name || path.basename(skillDir)).trim() || path.basename(skillDir),
    source_version: version,
    source_metadata: {
      frontmatter,
      declared_provider: declaredProvider,
      declared_engine_type: declaredEngineType,
      declared_default_model: String(frontmatter.default_model || '').trim() || null,
      skill_md_path: skillFile,
      imported_from: rawPath,
      content_excerpt: firstParagraph(parsed.content).slice(0, 400),
    },
    input_schema: normalizeObject(frontmatter.input_schema),
    output_schema: normalizeObject(frontmatter.output_schema),
    default_provider: 'external',
    default_model: 'external-skill',
    tool_policy: Object.keys(normalizeObject(frontmatter.tool_policy)).length
      ? normalizePolicy(frontmatter.tool_policy)
      : EMPTY_POLICY,
    status: frontmatter.status === 'disabled' ? 'disabled' : 'active',
    created_at: createdAt,
    updated_at: updatedAt,
  }

  return detail
}

export function importSkillFromPath(input: ImportSkillInput): SkillDefinitionDetail {
  const detail = buildImportedSkillDefinition(input)
  upsertSkillDefinition(detail)
  return getSkillDefinition(detail.slug) || detail
}

export function refreshImportedSkill(slug: string): SkillDefinitionDetail {
  const existing = getSkillDefinition(slug)
  if (!existing) throw new Error('skill 不存在')
  if (existing.source_origin !== 'external' || existing.source_type !== 'external_path' || !existing.source_path) {
    throw new Error('该 skill 不是可重新同步的外部目录 skill')
  }

  return importSkillFromPath({
    skillPath: existing.source_path,
    slug: existing.slug,
  })
}
