import { appendSkillRunEvent, createArtifact } from './skillStore'

export function materializeArtifactsForRun(runUid: string, output: Record<string, unknown>): void {
  const created = []

  if (typeof output.markdown === 'string' && output.markdown.trim()) {
    created.push(createArtifact({
      runUid,
      kind: 'markdown',
      title: 'result.md',
      contentText: output.markdown,
      mimeType: 'text/markdown',
      meta: {
        chars: output.markdown.length,
      },
    }))
  }

  if (typeof output.summary === 'string' && output.summary.trim()) {
    created.push(createArtifact({
      runUid,
      kind: 'text',
      title: 'summary.txt',
      contentText: output.summary,
      mimeType: 'text/plain',
      meta: {
        chars: output.summary.length,
      },
    }))
  }

  created.push(createArtifact({
    runUid,
    kind: 'json',
    title: 'output.json',
    contentText: JSON.stringify(output, null, 2),
    mimeType: 'application/json',
    meta: {
      keys: Object.keys(output),
    },
  }))

  if (Array.isArray(output.sources) && output.sources.length > 0) {
    created.push(createArtifact({
      runUid,
      kind: 'json',
      title: 'sources.json',
      contentText: JSON.stringify(output.sources, null, 2),
      mimeType: 'application/json',
      meta: {
        count: output.sources.length,
      },
    }))
  }

  for (const artifact of created) {
    appendSkillRunEvent(runUid, 'artifact.created', {
      artifact_id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
    })
  }
}
