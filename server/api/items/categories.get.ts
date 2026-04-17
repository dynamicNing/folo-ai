import { listCategories } from '~/server/utils/fileStore'

export default defineEventHandler(() => listCategories())
