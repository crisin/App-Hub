import type { PageServerLoad } from './$types'
import { syncProjects } from '$lib/server/scanner'
import { listTemplates } from '$lib/server/templates'

export const load: PageServerLoad = async () => {
  const projects = syncProjects()
  const templates = listTemplates()
  return { projects, templates }
}
