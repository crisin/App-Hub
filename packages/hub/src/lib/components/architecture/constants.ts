/** Shared constants for the architecture visualization */

export const TYPE_COLORS: Record<string, string> = {
  page: '#6366f1',
  api: '#22c55e',
  'server-module': '#f59e0b',
  'db-table': '#3b82f6',
  template: '#8b5cf6',
  'child-project': '#f97316',
  shared: '#ec4899',
}

export const TYPE_LABELS: Record<string, string> = {
  page: 'Pages',
  api: 'APIs',
  'server-module': 'Modules',
  'db-table': 'Tables',
  template: 'Templates',
  'child-project': 'Projects',
  shared: 'Shared',
}

export const EDGE_COLORS: Record<string, string> = {
  fetch: '#6366f1',
  import: '#f59e0b',
  query: '#3b82f6',
  'created-from': '#8b5cf6',
}

export const EDGE_LABELS: Record<string, string> = {
  fetch: 'Fetch',
  import: 'Import',
  query: 'Query',
  'created-from': 'Template',
}

/** Node type definition for extensibility */
export interface NodeTypeDef {
  key: string
  label: string
  color: string
  shape?: string // cytoscape shape override
}

/** Edge type definition for extensibility */
export interface EdgeTypeDef {
  key: string
  label: string
  color: string
}

/** Architecture graph node from the server */
export interface ArchNode {
  id: string
  label: string
  type: string
  group?: string
  meta: Record<string, any>
}

/** Architecture graph edge from the server */
export interface ArchEdge {
  source: string
  target: string
  type: string
  label?: string
}

/** Architecture graph data */
export interface ArchGraphData {
  nodes: ArchNode[]
  edges: ArchEdge[]
}

/** Selected node info for the detail panel */
export interface SelectedNodeInfo {
  id: string
  label: string
  type: string
  path?: string
  route?: string
  lines?: number
  methods?: string[]
  exports?: string[]
  columns?: string[]
  description?: string
  tags?: string[]
  /** Free key/value rows (kosmos map: status, next step, …) */
  details?: Array<{ key: string; value: string }>
  /** External link, e.g. the project's repository */
  url?: string
  /** Page that can be opened in a reader */
  pageId?: string
}

/** Connected node summary */
export interface ConnectedNode {
  id: string
  label: string
  type: string
}

// ── Palettes ────────────────────────────────────────────────────
//
// The graph components draw any typed graph. A palette says which node and
// edge types exist and how they look; the architecture graph is the default,
// the kosmos map (routes/map) brings its own.

export interface GraphPalette {
  nodeColors: Record<string, string>
  nodeLabels: Record<string, string>
  edgeColors: Record<string, string>
  edgeLabels: Record<string, string>
  /** Node size relative to the size setting, per type (default 1) */
  nodeScale?: Record<string, number>
  /** Cytoscape shape per type (default ellipse) */
  nodeShapes?: Record<string, string>
}

/** Which node and edge types are currently shown */
export interface GraphFilters {
  nodes: Record<string, boolean>
  edges: Record<string, boolean>
}

export const ARCH_PALETTE: GraphPalette = {
  nodeColors: TYPE_COLORS,
  nodeLabels: TYPE_LABELS,
  edgeColors: EDGE_COLORS,
  edgeLabels: EDGE_LABELS,
}

/**
 * kosmos map. Type keys are the German words kosmos itself uses in its
 * frontmatter (`type: playbook | entscheidung | …`); labels are English like
 * the rest of the hub UI.
 */
export const MAP_PALETTE: GraphPalette = {
  nodeColors: {
    projekt: '#f97316',
    playbook: '#22c55e',
    entscheidung: '#6366f1',
    konvention: '#3b82f6',
    plan: '#eab308',
    uebersicht: '#94a3b8',
    seite: '#64748b',
    baustein: '#ec4899',
    thema: '#14b8a6',
  },
  nodeLabels: {
    projekt: 'Projects',
    playbook: 'Playbooks',
    entscheidung: 'Decisions',
    konvention: 'Conventions',
    plan: 'Plans',
    uebersicht: 'Overviews',
    seite: 'Pages',
    baustein: 'Building blocks',
    thema: 'Topics',
  },
  edgeColors: {
    betrifft: '#f97316',
    'betrifft-alle': '#9a6a45',
    thema: '#14b8a6',
    link: '#94a3b8',
    ersetzt: '#ef4444',
    verbindung: '#e879f9',
  },
  edgeLabels: {
    betrifft: 'Concerns',
    'betrifft-alle': 'Concerns all',
    thema: 'Topic',
    link: 'Link',
    ersetzt: 'Supersedes',
    verbindung: 'Data flow',
  },
  nodeScale: { projekt: 1.8, baustein: 1.15, thema: 0.55 },
  nodeShapes: { projekt: 'hexagon', baustein: 'diamond', thema: 'ellipse' },
}
