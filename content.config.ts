import fs from 'node:fs'
import path from 'node:path'
import { defineCollection, defineContentConfig } from '@nuxt/content'

const envArchive = process.env.CONTENT_ARCHIVE_DIR
const archiveDir = envArchive
  ? (path.isAbsolute(envArchive) ? envArchive : path.resolve(process.cwd(), envArchive))
  : path.resolve(process.cwd(), 'content-archive')

const cwd = fs.existsSync(archiveDir) ? archiveDir : path.resolve(process.cwd(), 'content')

export default defineContentConfig({
  collections: {
    archive: defineCollection({
      type: 'page',
      source: {
        cwd,
        include: '**/*.md',
        exclude: ['_**', '**/_**', 'README.md', 'readme.md'],
      },
    }),
  },
})
