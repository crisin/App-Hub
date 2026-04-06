import type { PageServerLoad } from './$types'
import { buildArchitectureGraph } from '$lib/server/architecture'

export const load: PageServerLoad = async () => {
  const graph = buildArchitectureGraph()

  return {
    graph,
    stats: {
      pages: graph.nodes.filter((n) => n.type === 'page').length,
      apis: graph.nodes.filter((n) => n.type === 'api').length,
      modules: graph.nodes.filter((n) => n.type === 'server-module').length,
      tables: graph.nodes.filter((n) => n.type === 'db-table').length,
      templates: graph.nodes.filter((n) => n.type === 'template').length,
      projects: graph.nodes.filter((n) => n.type === 'child-project').length,
      edges: graph.edges.length,
    },
  }
}
