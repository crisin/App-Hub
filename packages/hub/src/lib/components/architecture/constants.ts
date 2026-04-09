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
}

/** Connected node summary */
export interface ConnectedNode {
  id: string
  label: string
  type: string
}
