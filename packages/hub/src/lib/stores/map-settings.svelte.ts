/**
 * Settings and filters of the kosmos map (routes/map).
 *
 * Same shape as the architecture store, own state: the map is a knowledge
 * network, so it starts in the force layout instead of the hierarchy.
 */
import { createGraphSettings } from './architecture-settings.svelte'
import { MAP_PALETTE, type GraphFilters } from '$lib/components/architecture/constants'

// Wider and looser than the architecture defaults: pages link to each other a
// lot, and a tight force layout turns that into one knot.
const created = createGraphSettings({ layoutMode: 'cose', spacing: 2.2, repulsion: 20000, gravity: 0.08 })

export const mapSettings = created.settings

/** The settings overlay starts closed here — the map itself is what one came for */
export const mapPanel = $state({ open: false })

/**
 * "Concerns all" starts hidden: a convention that applies to every project
 * would draw an edge to each of them and bury the edges that say something.
 */
const HIDDEN_EDGES = ['betrifft-alle']

function defaultFilters(): GraphFilters {
  return {
    nodes: Object.fromEntries(Object.keys(MAP_PALETTE.nodeLabels).map((type) => [type, true])),
    edges: Object.fromEntries(Object.keys(MAP_PALETTE.edgeLabels).map((type) => [type, !HIDDEN_EDGES.includes(type)])),
  }
}

export const mapFilters: GraphFilters = $state(defaultFilters())

export function resetMapSettings() {
  created.reset()
  const fresh = defaultFilters()
  Object.assign(mapFilters.nodes, fresh.nodes)
  Object.assign(mapFilters.edges, fresh.edges)
}
