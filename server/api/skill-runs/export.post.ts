import { requireAuth, apiError } from '~/server/utils/auth'
import { exportRunsToGitHub } from '~/server/utils/skillExporter'

interface ExportBody {
  runIds?: string[]
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = await readBody(event).catch(() => ({})) as ExportBody
  const runIds = body.runIds || []

  if (!Array.isArray(runIds) || runIds.length === 0) {
    apiError(400, 'runIds 不能为空')
  }

  try {
    const result = await exportRunsToGitHub(runIds)
    return {
      ok: true,
      exported: result.exported,
      failed: result.errors.length,
      errors: result.errors,
    }
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
