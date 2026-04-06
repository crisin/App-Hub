/**
 * Architecture graph scanner — auto-discovers the hub's structure
 * by parsing imports, fetch calls, SQL statements, and filesystem layout.
 */
import fs from 'node:fs'
import path from 'node:path'
import { parseProjectMeta } from './parser.js'
import { listTemplates } from './templates.js'
import { APPHUB_META_FILE } from '@apphub/shared'

// ── Types ───────────────────────────────────────────────────────────

export type ArchNodeType =
  | 'page'
  | 'api'
  | 'server-module'
  | 'db-table'
  | 'template'
  | 'child-project'
  | 'shared'

export type ArchEdgeType = 'fetch' | 'import' | 'query' | 'created-from'

export interface ArchNode {
  id: string
  label: string
  type: ArchNodeType
  group: string
  meta: Record<string, unknown>
}

export interface ArchEdge {
  source: string
  target: string
  type: ArchEdgeType
  label?: string
}

export interface ArchitectureGraph {
  nodes: ArchNode[]
  edges: ArchEdge[]
}

// ── Helpers ─────────────────────────────────────────────────────────

const HUB_SRC = path.resolve(process.cwd(), 'src')
const ROUTES_DIR = path.join(HUB_SRC, 'routes')
const LIB_SERVER_DIR = path.join(HUB_SRC, 'lib', 'server')
const MONOREPO_ROOT = path.resolve(process.cwd(), '..', '..')

function countLines(filePath: string): number {
  try {
    return fs.readFileSync(filePath, 'utf-8').split('\n').length
  } catch {
    return 0
  }
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/** Recursively walk a directory, returning all file paths */
function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, files)
    } else {
      files.push(full)
    }
  }
  return files
}

/** Extract route path from file system path */
function fileToRoutePath(filePath: string): string {
  const rel = path.relative(ROUTES_DIR, path.dirname(filePath))
  return '/' + rel.replace(/\\/g, '/')
}

/** Pretty label from route path */
function routeLabel(routePath: string): string {
  if (routePath === '/') return 'Dashboard'
  return routePath
    .split('/')
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith('[') && s.endsWith(']')) return `:${s.slice(1, -1)}`
      return s.charAt(0).toUpperCase() + s.slice(1)
    })
    .join(' / ')
}

// ── Regex scanners ──────────────────────────────────────────────────

/** Find fetch('/api/...') calls in file content */
function findFetchCalls(content: string): string[] {
  const results: string[] = []
  // Match fetch('/api/...') and fetch(`/api/...`)
  const re = /fetch\(\s*[`'"]\/?api\/([^`'")\s]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    // Normalize: strip template expressions, just keep the static path segments
    let apiPath = '/api/' + m[1]
    // Replace ${...} with [param]
    apiPath = apiPath.replace(/\$\{[^}]+\}/g, '[param]')
    // Remove query strings
    apiPath = apiPath.split('?')[0]
    results.push(apiPath)
  }
  return [...new Set(results)]
}

/** Find $lib/server/X imports */
function findLibServerImports(content: string): string[] {
  const results: string[] = []
  // Match from '$lib/server/X' and from './X' patterns
  const re1 = /from\s+['"](?:\$lib\/server\/)([\w-]+)(?:\.js)?['"]/g
  let m: RegExpExecArray | null
  while ((m = re1.exec(content)) !== null) {
    results.push(m[1])
  }
  // Also match relative imports used within lib/server/
  const re2 = /from\s+['"]\.\/([\w-]+)(?:\.js)?['"]/g
  while ((m = re2.exec(content)) !== null) {
    results.push(m[1])
  }
  return [...new Set(results)]
}

/** Find SQL table references in content */
function findDbTableRefs(content: string): string[] {
  const results: string[] = []
  const re =
    /(?:FROM|INTO|UPDATE|JOIN|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS)\s+(\w+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const table = m[1].toLowerCase()
    // Skip SQL keywords that might match
    if (['set', 'where', 'values', 'select', 'table', 'index', 'if'].includes(table)) continue
    results.push(table)
  }
  return [...new Set(results)]
}

/** Find exported HTTP methods (GET, POST, PATCH, DELETE) */
function findHttpMethods(content: string): string[] {
  const results: string[] = []
  const re = /export\s+const\s+(GET|POST|PATCH|DELETE|PUT|HEAD)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    results.push(m[1])
  }
  return results
}

/** Check if file imports from @apphub/shared */
function usesShared(content: string): boolean {
  return /from\s+['"]@apphub\/shared/.test(content)
}

// ── Discovery functions ─────────────────────────────────────────────

function discoverPages(): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = []
  const edges: ArchEdge[] = []

  const pageFiles = walkDir(ROUTES_DIR).filter(
    (f) => f.endsWith('+page.svelte') && !f.includes('/api/')
  )

  for (const file of pageFiles) {
    const routePath = fileToRoutePath(file)
    const id = `page:${routePath}`
    const content = readFile(file)

    // Also check +page.server.ts for the same route
    const serverFile = path.join(path.dirname(file), '+page.server.ts')
    const serverContent = readFile(serverFile)

    nodes.push({
      id,
      label: routeLabel(routePath),
      type: 'page',
      group: 'group:pages',
      meta: {
        path: path.relative(MONOREPO_ROOT, file),
        lines: countLines(file),
        route: routePath,
      },
    })

    // Find fetch calls in both .svelte and .server.ts
    const allContent = content + '\n' + serverContent
    const fetchCalls = findFetchCalls(allContent)
    for (const apiPath of fetchCalls) {
      edges.push({
        source: id,
        target: `api:${apiPath}`,
        type: 'fetch',
      })
    }

    // Find $lib/server imports in server load
    const imports = findLibServerImports(serverContent)
    for (const mod of imports) {
      edges.push({
        source: id,
        target: `mod:${mod}`,
        type: 'import',
      })
    }
  }

  return { nodes, edges }
}

function discoverApiEndpoints(): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = []
  const edges: ArchEdge[] = []

  const apiFiles = walkDir(ROUTES_DIR).filter(
    (f) => f.endsWith('+server.ts') && f.includes('/api/')
  )

  for (const file of apiFiles) {
    const routePath = fileToRoutePath(file)
    const content = readFile(file)
    const methods = findHttpMethods(content)
    const id = `api:${routePath}`

    nodes.push({
      id,
      label: `${methods.join('/') || '?'} ${routePath.replace('/api', '')}`,
      type: 'api',
      group: 'group:api',
      meta: {
        path: path.relative(MONOREPO_ROOT, file),
        lines: countLines(file),
        methods,
        route: routePath,
      },
    })

    // Find server module imports
    const imports = findLibServerImports(content)
    for (const mod of imports) {
      edges.push({
        source: id,
        target: `mod:${mod}`,
        type: 'import',
      })
    }

    // Find direct DB table refs (some API routes query directly)
    const tables = findDbTableRefs(content)
    for (const table of tables) {
      edges.push({
        source: id,
        target: `table:${table}`,
        type: 'query',
      })
    }
  }

  return { nodes, edges }
}

function discoverServerModules(): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = []
  const edges: ArchEdge[] = []

  if (!fs.existsSync(LIB_SERVER_DIR)) return { nodes, edges }

  const files = fs.readdirSync(LIB_SERVER_DIR).filter((f) => f.endsWith('.ts'))

  for (const file of files) {
    const filePath = path.join(LIB_SERVER_DIR, file)
    const modName = file.replace('.ts', '')
    const content = readFile(filePath)
    const id = `mod:${modName}`

    // Count exported functions
    const exports = content.match(/export\s+(?:function|const|class|async\s+function)\s+\w+/g) || []

    nodes.push({
      id,
      label: file,
      type: 'server-module',
      group: 'group:server',
      meta: {
        path: path.relative(MONOREPO_ROOT, filePath),
        lines: countLines(filePath),
        exports: exports.map((e) => {
          const m = e.match(/\s(\w+)$/)
          return m ? m[1] : e
        }),
        usesShared: usesShared(content),
      },
    })

    // Cross-module imports
    const imports = findLibServerImports(content)
    for (const imp of imports) {
      if (imp !== modName) {
        edges.push({
          source: id,
          target: `mod:${imp}`,
          type: 'import',
        })
      }
    }

    // DB table references
    const tables = findDbTableRefs(content)
    for (const table of tables) {
      edges.push({
        source: id,
        target: `table:${table}`,
        type: 'query',
      })
    }
  }

  return { nodes, edges }
}

function discoverDbTables(): { nodes: ArchNode[] } {
  const nodes: ArchNode[] = []

  const dbFile = path.join(LIB_SERVER_DIR, 'db.ts')
  const content = readFile(dbFile)

  // Parse CREATE TABLE statements
  const re = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)(?:\);)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const tableName = m[1].toLowerCase()
    const body = m[2]

    // Extract column names
    const columns: string[] = []
    for (const line of body.split('\n')) {
      const colMatch = line.trim().match(/^(\w+)\s+(TEXT|INTEGER|REAL|BLOB)\b/i)
      if (colMatch) columns.push(colMatch[1])
    }

    nodes.push({
      id: `table:${tableName}`,
      label: tableName,
      type: 'db-table',
      group: 'group:database',
      meta: { columns },
    })
  }

  // Also catch ALTER TABLE ADD COLUMN tables (for completeness)
  const alterRe = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi
  while ((m = alterRe.exec(content)) !== null) {
    const tableName = m[1].toLowerCase()
    const existing = nodes.find((n) => n.id === `table:${tableName}`)
    if (existing && Array.isArray(existing.meta.columns)) {
      ;(existing.meta.columns as string[]).push(m[2])
    }
  }

  return { nodes }
}

function discoverTemplatesNodes(): { nodes: ArchNode[] } {
  const templates = listTemplates()
  return {
    nodes: templates.map((t) => ({
      id: `tpl:${t.slug}`,
      label: t.name,
      type: 'template' as const,
      group: 'group:templates',
      meta: {
        description: t.description,
        tags: t.tags,
        path: path.relative(MONOREPO_ROOT, t.source),
      },
    })),
  }
}

function discoverChildProjects(): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const nodes: ArchNode[] = []
  const edges: ArchEdge[] = []

  const projectsDir = path.resolve(MONOREPO_ROOT, 'projects')
  if (!fs.existsSync(projectsDir)) return { nodes, edges }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue

    const metaFile = path.join(projectsDir, entry.name, APPHUB_META_FILE)
    if (!fs.existsSync(metaFile)) continue

    const content = readFile(metaFile)
    const meta = parseProjectMeta(content)
    const id = `proj:${meta.slug || entry.name}`

    nodes.push({
      id,
      label: meta.name || entry.name,
      type: 'child-project',
      group: 'group:projects',
      meta: {
        path: `projects/${entry.name}`,
        status: meta.status,
        template: meta.template,
        tags: meta.tags,
      },
    })

    // Link to template if known
    if (meta.template) {
      edges.push({
        source: id,
        target: `tpl:${meta.template}`,
        type: 'created-from',
      })
    }

    // All child projects can consume the dev API
    edges.push({
      source: id,
      target: 'api:/api/dev/auth',
      type: 'fetch',
      label: 'dev-api',
    })
  }

  return { nodes, edges }
}

// ── Main builder ────────────────────────────────────────────────────

export function buildArchitectureGraph(): ArchitectureGraph {
  const allNodes: ArchNode[] = []
  const allEdges: ArchEdge[] = []

  // Group parent nodes
  const groups: ArchNode[] = [
    { id: 'group:pages', label: 'Pages', type: 'page', group: '', meta: {} },
    { id: 'group:api', label: 'API Endpoints', type: 'api', group: '', meta: {} },
    { id: 'group:server', label: 'Server Modules', type: 'server-module', group: '', meta: {} },
    { id: 'group:database', label: 'Database', type: 'db-table', group: '', meta: {} },
    { id: 'group:templates', label: 'Templates', type: 'template', group: '', meta: {} },
    { id: 'group:projects', label: 'Child Projects', type: 'child-project', group: '', meta: {} },
  ]
  allNodes.push(...groups)

  // Discover all node types
  const pages = discoverPages()
  allNodes.push(...pages.nodes)
  allEdges.push(...pages.edges)

  const apis = discoverApiEndpoints()
  allNodes.push(...apis.nodes)
  allEdges.push(...apis.edges)

  const mods = discoverServerModules()
  allNodes.push(...mods.nodes)
  allEdges.push(...mods.edges)

  const tables = discoverDbTables()
  allNodes.push(...tables.nodes)

  const templates = discoverTemplatesNodes()
  allNodes.push(...templates.nodes)

  const projects = discoverChildProjects()
  allNodes.push(...projects.nodes)
  allEdges.push(...projects.edges)

  // Add shared package node
  allNodes.push({
    id: 'shared:pkg',
    label: '@apphub/shared',
    type: 'shared',
    group: '',
    meta: {
      path: 'packages/shared/src',
      files: ['types.ts', 'schemas.ts', 'constants.ts'],
    },
  })

  // Prune edges with missing targets
  const nodeIds = new Set(allNodes.map((n) => n.id))

  // For fetch edges, try to match to closest API endpoint
  const validEdges = allEdges.filter((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) return true

    // Try matching fetch edges to parent API routes
    if (e.type === 'fetch' && !nodeIds.has(e.target)) {
      // Walk up the path to find a matching API node
      let targetPath = e.target.replace('api:', '')
      while (targetPath.length > 1) {
        const candidate = `api:${targetPath}`
        if (nodeIds.has(candidate)) {
          e.target = candidate
          return true
        }
        targetPath = targetPath.substring(0, targetPath.lastIndexOf('/'))
      }
    }

    return nodeIds.has(e.source) && nodeIds.has(e.target)
  })

  // Deduplicate edges
  const edgeKey = (e: ArchEdge) => `${e.source}|${e.target}|${e.type}`
  const seen = new Set<string>()
  const uniqueEdges = validEdges.filter((e) => {
    const k = edgeKey(e)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { nodes: allNodes, edges: uniqueEdges }
}
