import fs from 'node:fs'
import path from 'node:path'

export function contentArchiveDir(): string {
  const envArchive = process.env.CONTENT_ARCHIVE_DIR
  if (!envArchive) return path.resolve(process.cwd(), 'content-archive')
  return path.isAbsolute(envArchive)
    ? envArchive
    : path.resolve(process.cwd(), envArchive)
}

export function ensureContentArchiveDir(): string {
  const dir = contentArchiveDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function learningDir(): string {
  return path.join(ensureContentArchiveDir(), 'learning')
}

export function ensureLearningDir(): string {
  const dir = learningDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function topicDir(topicSlug: string): string {
  return path.join(ensureLearningDir(), topicSlug)
}

export function topicIndexPath(topicSlug: string): string {
  return path.join(topicDir(topicSlug), 'index.md')
}

export function chapterPath(topicSlug: string, chapterSlug: string): string {
  return path.join(topicDir(topicSlug), `${chapterSlug}.md`)
}

export function repoPathFromAbsolute(filePath: string): string {
  return path.relative(ensureContentArchiveDir(), filePath).replace(/\\/g, '/')
}
