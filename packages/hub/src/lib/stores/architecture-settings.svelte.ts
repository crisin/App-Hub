/**
 * Centralized architecture visualization settings store.
 *
 * All settings live here as a single reactive $state object.
 * Components import and mutate `archSettings` directly —
 * Svelte 5's fine-grained reactivity handles the rest.
 *
 * To add a new setting:
 *   1. Add the field + default to `DEFAULTS`
 *   2. The SettingsPanel picks it up automatically if you add a row
 *   3. Graph components react via $effect watchers on the fields they care about
 */

// ── Default values (single source of truth) ───────────────────

const DEFAULTS = {
  // View mode
  viewMode: '2d' as '2d' | '3d',

  // Layout
  layoutMode: 'dagre' as 'dagre' | 'cose',
  dagDirection: 'TB' as 'TB' | 'LR' | 'BT' | 'RL',
  spacing: 1.5,
  gravity: 0.15,
  repulsion: 5000,
  animateLayout: true,

  // Node appearance
  nodeSize: 30,
  labelSize: 10,
  showLabels: true,
  showGroups: false,

  // Edge appearance
  edgeOpacity: 0.35,
  edgeWidth: 1.5,
  showArrows: true,
  showEdgeLabels: false,

  // 3D-specific
  showParticles: true,
  particleSpeed: 0.004,
  particleDensity: 2,
  nodeResolution: 12,
  linkCurvature: 0,
  bgColor: '#0a0a0f',
  ambientLight: 0.6,
  glowStrength: 0.3,
}

// No `as const` on DEFAULTS: it would narrow every field to its literal default
// (spacing: 1.5) and make the sliders unable to assign any other value.
export type ArchSettings = typeof DEFAULTS

// ── Filters (separate objects for granular reactivity) ─────────

function defaultNodeFilters(): Record<string, boolean> {
  return {
    page: true,
    api: true,
    'server-module': true,
    'db-table': true,
    template: true,
    'child-project': true,
    shared: true,
  }
}

function defaultEdgeFilters(): Record<string, boolean> {
  return {
    fetch: true,
    import: true,
    query: true,
    'created-from': true,
  }
}

// ── The store ─────────────────────────────────────────────────

/** Mutable settings state — import and use directly */
export const archSettings: ArchSettings = $state({ ...DEFAULTS })

/** Node visibility filters */
export const nodeFilters: Record<string, boolean> = $state(defaultNodeFilters())

/** Edge visibility filters */
export const edgeFilters: Record<string, boolean> = $state(defaultEdgeFilters())

/** Accordion section open/closed state */
export const openSections: Record<string, boolean> = $state({
  layout: true,
  nodes: true,
  edges: false,
  effects: false,
})

/** Whether settings panel is visible */
export let settingsOpen = $state({ value: true })

// ── Actions ──────────────────────────────────────────────────

/** Reset all settings to defaults */
export function resetSettings() {
  Object.assign(archSettings, { ...DEFAULTS })
  Object.assign(nodeFilters, defaultNodeFilters())
  Object.assign(edgeFilters, defaultEdgeFilters())
}

/** Toggle all filters in a group */
export function selectAll(group: 'nodes' | 'edges', value: boolean) {
  const target = group === 'nodes' ? nodeFilters : edgeFilters
  Object.keys(target).forEach((k) => (target[k] = value))
}

/** Toggle an accordion section */
export function toggleSection(key: string) {
  openSections[key] = !openSections[key]
}

// ── Derived helpers ──────────────────────────────────────────

/** Currently visible node types */
export function getVisibleTypes(): string[] {
  return Object.entries(nodeFilters)
    .filter(([_, v]) => v)
    .map(([k]) => k)
}

/** Currently visible edge types */
export function getVisibleEdgeTypes(): string[] {
  return Object.entries(edgeFilters)
    .filter(([_, v]) => v)
    .map(([k]) => k)
}

// ── More than one graph ──────────────────────────────────────

/** The architecture graph's filters in the shape the graph components take */
export const archFilters = { nodes: nodeFilters, edges: edgeFilters }

/**
 * Settings for another graph page (e.g. the kosmos map), so its layout and
 * look do not fight with the architecture page over one shared object.
 */
export function createGraphSettings(overrides: Partial<ArchSettings> = {}) {
  const defaults = { ...DEFAULTS, ...overrides } as ArchSettings
  const settings: ArchSettings = $state({ ...defaults })
  return { settings, reset: () => void Object.assign(settings, defaults) }
}
