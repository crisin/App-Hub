<!--
  2D graph visualization using Cytoscape.js.
  Reads settings from the shared store and reacts to changes.
-->
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import {
    archSettings,
    nodeFilters,
    edgeFilters,
    getVisibleTypes,
    getVisibleEdgeTypes,
  } from '$lib/stores/architecture-settings.svelte'
  import { TYPE_COLORS, EDGE_COLORS, type ArchGraphData, type SelectedNodeInfo, type ConnectedNode } from './constants'

  let {
    graphData,
    onselect,
    ondeselect,
  }: {
    graphData: ArchGraphData
    onselect: (node: SelectedNodeInfo, connections: ConnectedNode[]) => void
    ondeselect: () => void
  } = $props()

  let container: HTMLDivElement
  let cy: any = null

  // ── Build Cytoscape elements ──────────────────────────────────

  function buildElements() {
    const visibleTypes = getVisibleTypes()
    const visibleEdgeTypes = getVisibleEdgeTypes()
    const useGroups = archSettings.layoutMode === 'dagre' && archSettings.showGroups

    const nodes = graphData.nodes
      .filter((n) => {
        if (n.id.startsWith('group:')) return useGroups && visibleTypes.includes(n.type)
        return visibleTypes.includes(n.type)
      })
      .map((n) => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          leaf: n.id.startsWith('group:') ? undefined : 'yes',
          parent: useGroups ? n.group || undefined : undefined,
          ...n.meta,
        },
      }))

    const nodeIds = new Set(nodes.map((n) => n.data.id))

    const edges = graphData.edges
      .filter(
        (e) =>
          nodeIds.has(e.source) &&
          nodeIds.has(e.target) &&
          visibleEdgeTypes.includes(e.type),
      )
      .map((e, i) => ({
        data: {
          id: `edge-${i}`,
          source: e.source,
          target: e.target,
          edgeType: e.type,
          label: e.label || '',
        },
      }))

    return [...nodes, ...edges]
  }

  // ── Cytoscape style ───────────────────────────────────────────

  function getCyStyle() {
    const s = archSettings
    return [
      {
        selector: ':parent',
        style: {
          'background-color': 'rgba(255,255,255,0.03)',
          'background-opacity': 1,
          'border-color': 'rgba(255,255,255,0.08)',
          'border-width': 1,
          'border-style': 'dashed' as any,
          shape: 'round-rectangle' as any,
          padding: '24px',
          label: 'data(label)',
          'text-valign': 'top' as any,
          'text-halign': 'center' as any,
          'font-size': 11,
          color: 'rgba(255,255,255,0.3)',
          'font-weight': '600',
          'text-margin-y': -8,
        },
      },
      {
        selector: 'node[leaf]',
        style: {
          label: s.showLabels ? 'data(label)' : '',
          'text-valign': 'bottom' as any,
          'text-halign': 'center' as any,
          'text-margin-y': 6,
          'font-size': s.labelSize,
          color: 'rgba(255,255,255,0.7)',
          'text-wrap': 'ellipsis' as any,
          'text-max-width': `${Math.max(60, s.nodeSize * 4)}px`,
          width: s.nodeSize,
          height: s.nodeSize,
          'border-width': 2,
          'border-color': 'rgba(0,0,0,0.3)',
          'overlay-padding': 4,
        },
      },
      ...Object.entries(TYPE_COLORS).map(([type, color]) => ({
        selector: `node[leaf][type="${type}"]`,
        style: { 'background-color': color },
      })),
      ...Object.entries(TYPE_COLORS).map(([type, color]) => ({
        selector: `node:parent[type="${type}"]`,
        style: {
          'background-color': 'rgba(255,255,255,0.03)',
          'background-opacity': 1,
          'border-color': color,
          'border-opacity': 0.3,
        },
      })),
      {
        selector: 'node[type="shared"]',
        style: {
          'background-color': TYPE_COLORS.shared,
          width: s.nodeSize + 8,
          height: s.nodeSize + 8,
          shape: 'diamond' as any,
        },
      },
      {
        selector: 'edge',
        style: {
          width: s.edgeWidth,
          'line-color': 'rgba(255,255,255,0.08)',
          'target-arrow-color': 'rgba(255,255,255,0.15)',
          'target-arrow-shape': s.showArrows ? ('triangle' as any) : ('none' as any),
          'arrow-scale': 0.6,
          'curve-style': 'bezier' as any,
          opacity: s.edgeOpacity,
          label: s.showEdgeLabels ? 'data(label)' : '',
          'font-size': 8,
          color: 'rgba(255,255,255,0.4)',
          'text-rotation': 'autorotate' as any,
          'text-margin-y': -8,
        },
      },
      ...Object.entries(EDGE_COLORS).map(([type, color]) => ({
        selector: `edge[edgeType="${type}"]`,
        style: { 'line-color': color, 'target-arrow-color': color },
      })),
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#ffffff',
          'overlay-color': '#ffffff',
          'overlay-opacity': 0.1,
        },
      },
      { selector: '.highlighted', style: { opacity: 1, 'z-index': 10 } },
      { selector: '.highlighted-edge', style: { opacity: 0.8, width: s.edgeWidth + 1, 'z-index': 10 } },
      { selector: '.dimmed', style: { opacity: 0.08 } },
    ]
  }

  // ── Layout config ─────────────────────────────────────────────

  function getLayoutConfig() {
    const s = archSettings
    if (s.layoutMode === 'dagre') {
      return {
        name: 'dagre',
        rankDir: s.dagDirection,
        nodeSep: 60 * s.spacing,
        rankSep: 100 * s.spacing,
        edgeSep: 30 * s.spacing,
        padding: 50,
        animate: s.animateLayout,
        animationDuration: 400,
        fit: true,
      }
    }
    return {
      name: 'cose',
      nodeRepulsion: () => s.repulsion * s.spacing * s.spacing,
      idealEdgeLength: () => 100 * s.spacing,
      edgeElasticity: () => 100 / s.spacing,
      gravity: s.gravity,
      numIter: 1500,
      padding: 50,
      animate: s.animateLayout,
      animationDuration: 500,
      randomize: s.spacing > 1.2,
      fit: true,
    }
  }

  // ── Connections helper ────────────────────────────────────────

  function getConnections(nodeId: string): ConnectedNode[] {
    if (!cy) return []
    const node = cy.getElementById(nodeId)
    const connected = node
      .connectedEdges()
      .connectedNodes()
      .filter((n: any) => n.id() !== nodeId)
    return connected.map((n: any) => ({
      id: n.id(),
      label: n.data('label'),
      type: n.data('type'),
    }))
  }

  // ── Graph operations ──────────────────────────────────────────

  function fullRebuild() {
    if (!cy) return
    ondeselect()
    cy.elements().remove()
    cy.style(getCyStyle() as any)
    cy.add(buildElements())
    cy.elements().removeClass('highlighted highlighted-edge dimmed')
    cy.layout(getLayoutConfig() as any).run()
  }

  function updateStyleOnly() {
    if (!cy) return
    cy.style(getCyStyle() as any)
  }

  // ── Public API ────────────────────────────────────────────────

  export function fit() {
    cy?.fit(undefined, 40)
  }

  export function zoomIn() {
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, position: cy.pan() })
  }

  export function zoomOut() {
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, position: cy.pan() })
  }

  export function clickNode(nodeId: string) {
    cy?.getElementById(nodeId)?.emit('tap')
  }

  // ── Mount ─────────────────────────────────────────────────────

  let mounted = false

  onMount(async () => {
    mounted = true
    await tick()
    if (!container || !mounted) return

    const cytoscape = (await import('cytoscape')).default
    const dagre = (await import('cytoscape-dagre')).default
    try { cytoscape.use(dagre) } catch { /* already registered */ }

    cy = cytoscape({
      container,
      elements: buildElements(),
      style: getCyStyle() as any,
      layout: getLayoutConfig() as any,
      minZoom: 0.1,
      maxZoom: 5,
    })

    cy.on('tap', 'node[leaf]', (evt: any) => {
      const node = evt.target
      const connections = getConnections(node.id())
      cy.elements().removeClass('highlighted highlighted-edge dimmed').addClass('dimmed')
      const hood = node.neighborhood().add(node)
      hood.nodes().removeClass('dimmed').addClass('highlighted')
      hood.edges().removeClass('dimmed').addClass('highlighted-edge')
      cy.nodes(':parent').removeClass('dimmed')
      onselect(node.data(), connections)
    })

    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted highlighted-edge dimmed')
        ondeselect()
      }
    })
  })

  onDestroy(() => {
    mounted = false
    if (cy) { cy.destroy(); cy = null }
  })

  // ── Reactive watchers ─────────────────────────────────────────

  // Structural changes → full rebuild
  let prevFiltersKey = ''
  $effect(() => {
    const key = JSON.stringify({
      nf: nodeFilters, ef: edgeFilters,
      lm: archSettings.layoutMode, dd: archSettings.dagDirection,
      sg: archSettings.showGroups,
    })
    if (key !== prevFiltersKey && prevFiltersKey !== '') {
      fullRebuild()
    }
    prevFiltersKey = key
  })

  // Style-only changes → no relayout
  let prevStyleKey = ''
  $effect(() => {
    const key = JSON.stringify({
      ns: archSettings.nodeSize, ls: archSettings.labelSize,
      sl: archSettings.showLabels, eo: archSettings.edgeOpacity,
      ew: archSettings.edgeWidth, sa: archSettings.showArrows,
      sel: archSettings.showEdgeLabels, al: archSettings.animateLayout,
    })
    if (key !== prevStyleKey && prevStyleKey !== '') {
      updateStyleOnly()
    }
    prevStyleKey = key
  })

  // Layout param changes → relayout
  let prevLayoutKey = ''
  $effect(() => {
    const key = JSON.stringify({
      sp: archSettings.spacing, gr: archSettings.gravity,
      rp: archSettings.repulsion,
    })
    if (key !== prevLayoutKey && prevLayoutKey !== '') {
      cy?.layout(getLayoutConfig() as any).run()
    }
    prevLayoutKey = key
  })
</script>

<div class="cy-container" bind:this={container}></div>

<style>
  .cy-container {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    background: var(--bg);
  }
</style>
