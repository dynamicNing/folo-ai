import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildImportedSkillDefinition, importSkillFromPath } from './skillImporter'
import { getSkillDefinition } from './skillStore'
import type { SkillCatalogSyncResponse } from '../../types/skill'

let catalogSynced = false

function getConfiguredRoots(): string[] {
  const fromEnv = (process.env.SKILL_SCAN_ROOTS || '')
    .split(path.delimiter)
    .map(item => item.trim())
    .filter(Boolean)

  const defaults = [
    path.join(os.homedir(), '.codex', 'skills'),
    path.join(os.homedir(), '.agents', 'skills'),
  ]

  return Array.from(new Set([...fromEnv, ...defaults]))
}

function findSkillDirs(root: string): string[] {
  if (!fs.existsSync(root)) return []

  const results: string[] = []

  function walk(current: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    if (entries.some(entry => entry.isFile() && entry.name === 'SKILL.md')) {
      results.push(current)
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      walk(path.join(current, entry.name))
    }
  }

  walk(root)
  return results
}

export function syncBundledSkillCatalog(force = false): SkillCatalogSyncResponse {
  if (catalogSynced && !force) {
    return {
      roots: getConfiguredRoots(),
      scanned: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    }
  }

  const roots = getConfiguredRoots()
  const skillDirs = Array.from(new Set(roots.flatMap(findSkillDirs)))
  const result: SkillCatalogSyncResponse = {
    roots,
    scanned: skillDirs.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const skillDir of skillDirs) {
    try {
      const preview = buildImportedSkillDefinition({ skillPath: skillDir })
      const existed = getSkillDefinition(preview.slug)
      importSkillFromPath({ skillPath: skillDir, slug: preview.slug })

      if (existed) result.updated += 1
      else result.created += 1
    } catch (err) {
      result.errors.push({
        path: skillDir,
        message: (err as Error).message || '同步失败',
      })
    }
  }

  result.skipped = Math.max(0, result.scanned - result.created - result.updated - result.errors.length)
  catalogSynced = true
  return result
}

export function ensureBundledSkillCatalogSynced(): void {
  syncBundledSkillCatalog(false)
}
