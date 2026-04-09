/**
 * Project Summary Builder
 *
 * Generates a structured text summary of a project by combining:
 * - Project metadata from the database
 * - Architecture graph data (pages, APIs, modules, DB tables, edges)
 * - Existing board items (to avoid duplicate suggestions)
 *
 * The summary is designed to be passed directly to Claude as prompt context,
 * so it doesn't need to scan or read any files itself.
 */
import { getDb } from './db.js'
import { listItems } from './data.js'
import { buildArchitectureGraph } from './architecture.js'

export interface ProjectSummary {
  slug: string
  name: string
  description: string
  status: string
  context: string
  architecture: string
  existingItems: string
  itemCount: number
  stats: {
    pages: number
    apis: number
    modules: number
    tables: number
    edges: number
  }
}

/**
 * Build a comprehensive project summary for AI consumption.
 * Combines DB metadata + architecture analysis + existing items.
 */
export function buildProjectSummary(projectSlug: string): ProjectSummary {
  const db = getDb()

  // ── Project metadata ──────────────────────────────────────────
  const project = db
    .prepare('SELECT slug, name, description, status, context FROM projects WHERE slug = ?')
    .get(projectSlug) as any

  const name = project?.name ?? projectSlug
  const description = project?.description ?? ''
  const status = project?.status ?? 'unknown'
  const context = project?.context ?? ''

  // ── Architecture analysis ─────────────────────────────────────
  let architecture = ''
  const stats = { pages: 0, apis: 0, modules: 0, tables: 0, edges: 0 }

  try {
    const graph = buildArchitectureGraph()

    // Group nodes by type with details
    const nodesByType: Record<string, Array<{ label: string; meta: Record<string, any> }>> = {}
    for (const node of graph.nodes) {
      if (node.id.startsWith('group:')) continue
      if (!nodesByType[node.type]) nodesByType[node.type] = []
      nodesByType[node.type].push({ label: node.label, meta: node.meta || {} })
    }

    // Stats
    stats.pages = nodesByType['page']?.length ?? 0
    stats.apis = nodesByType['api']?.length ?? 0
    stats.modules = nodesByType['server-module']?.length ?? 0
    stats.tables = nodesByType['db-table']?.length ?? 0
    stats.edges = graph.edges.length

    // Build readable architecture summary
    const sections: string[] = []

    // Pages
    if (nodesByType['page']?.length) {
      const pages = nodesByType['page'].map((p) => {
        const route = p.meta.route || p.label
        return `  - ${route}`
      })
      sections.push(`Pages (${pages.length}):\n${pages.join('\n')}`)
    }

    // API endpoints
    if (nodesByType['api']?.length) {
      const apis = nodesByType['api'].map((a) => {
        const methods = a.meta.methods?.join(', ') || ''
        const route = a.meta.route || a.label
        return `  - ${methods ? `[${methods}] ` : ''}${route}`
      })
      sections.push(`API Endpoints (${apis.length}):\n${apis.join('\n')}`)
    }

    // Server modules
    if (nodesByType['server-module']?.length) {
      const mods = nodesByType['server-module'].map((m) => {
        const exports = m.meta.exports?.slice(0, 5).join(', ') || ''
        return `  - ${m.label}${exports ? ` (exports: ${exports})` : ''}`
      })
      sections.push(`Server Modules (${mods.length}):\n${mods.join('\n')}`)
    }

    // DB tables
    if (nodesByType['db-table']?.length) {
      const tables = nodesByType['db-table'].map((t) => {
        const cols = t.meta.columns?.slice(0, 8).join(', ') || ''
        return `  - ${t.label}${cols ? ` (${cols})` : ''}`
      })
      sections.push(`Database Tables (${tables.length}):\n${tables.join('\n')}`)
    }

    // Templates
    if (nodesByType['template']?.length) {
      sections.push(
        `Templates (${nodesByType['template'].length}): ${nodesByType['template'].map((t) => t.label).join(', ')}`,
      )
    }

    // Edge summary (connections between types)
    const edgeSummary: Record<string, number> = {}
    for (const edge of graph.edges) {
      edgeSummary[edge.type] = (edgeSummary[edge.type] || 0) + 1
    }
    if (Object.keys(edgeSummary).length) {
      const edgeLines = Object.entries(edgeSummary)
        .map(([type, count]) => `  - ${type}: ${count}`)
        .join('\n')
      sections.push(`Connections (${graph.edges.length} total):\n${edgeLines}`)
    }

    architecture = sections.join('\n\n')
  } catch {
    architecture = '(architecture analysis unavailable)'
  }

  // ── Existing items ────────────────────────────────────────────
  const items = listItems({ project: projectSlug })
  const itemCount = items.length

  const existingItems = items.length
    ? items
        .map(
          (i: any) =>
            `[${i.stage}] ${i.priority} — ${i.title}${i.labels?.length ? ` {${i.labels.join(', ')}}` : ''}`,
        )
        .join('\n')
    : '(no items yet)'

  return {
    slug: projectSlug,
    name,
    description,
    status,
    context,
    architecture,
    existingItems,
    itemCount,
    stats,
  }
}

/**
 * Format a project summary as a single text block for prompt injection.
 */
export function formatSummaryForPrompt(summary: ProjectSummary): string {
  return `## Project: ${summary.name} (${summary.slug})
Status: ${summary.status}
Description: ${summary.description || '(none)'}
${summary.context ? `\nContext:\n${summary.context}\n` : ''}
## Architecture (${summary.stats.pages} pages, ${summary.stats.apis} APIs, ${summary.stats.modules} modules, ${summary.stats.tables} tables, ${summary.stats.edges} connections)

${summary.architecture}

## Existing Board Items (${summary.itemCount})

${summary.existingItems}`
}
