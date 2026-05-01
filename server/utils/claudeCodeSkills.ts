import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface ClaudeCodeSkill {
  slug: string
  name: string
  description: string
}

function extractFrontmatterField(yaml: string, field: string): string {
  // Single-line: field: "value" or field: value
  const single = yaml.match(new RegExp(`^${field}:\\s*["']?([^\\n"']+?)["']?\\s*$`, 'm'))
  if (single) return single[1].trim()
  // Multi-line block: field:\n  line1\n  line2 — take first non-empty line
  const block = yaml.match(new RegExp(`^${field}:\\s*\\n((?:[ \\t]+[^\\n]+\\n?)+)`, 'm'))
  if (block) {
    const first = block[1].split('\n').find(l => l.trim())
    return first?.trim() ?? ''
  }
  return ''
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { name: '', description: '' }
  const yaml = match[1]
  return {
    name: extractFrontmatterField(yaml, 'name'),
    description: extractFrontmatterField(yaml, 'description'),
  }
}

export async function listClaudeCodeSkills(): Promise<ClaudeCodeSkill[]> {
  const skillsDir = join(homedir(), '.claude', 'skills')
  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }

  const skills: ClaudeCodeSkill[] = []
  for (const slug of entries) {
    try {
      const content = await readFile(join(skillsDir, slug, 'SKILL.md'), 'utf-8')
      const { name, description } = parseFrontmatter(content)
      if (name || description) {
        skills.push({ slug, name: name || slug, description })
      }
    } catch {
      // no SKILL.md or unreadable — skip
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}
