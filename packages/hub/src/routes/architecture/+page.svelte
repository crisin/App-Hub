<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'

  let { data } = $props()

  // ── State ───────────────────────────────────────────────────────
  let container: HTMLDivElement
  let cy: any = null

  // Node type colors
  const TYPE_COLORS: Record<string, string> = {
    page: '#6366f1',
    api: '#22c55e',
    'server-module': '#f59e0b',
    'db-table': '#3b82f6',
    template: '#8b5cf6',
    'child-project': '#f97316',
    shared: '#ec4899',
  }

  const TYPE_LABELS: Record<string, string> = {
    page: 'Pages',
    api: 'API Endpoints',
    'server-module': 'Server Modules',
    'db-table': 'DB Tables',
    template: 'Templates',
    'child-project': 'Projects',
    shared: 'Shared',
  }

  const EDGE_COLORS: Record<string, string> = {
    fetch: '#6366f1',
    import: '#f59e0b',
    query: '#3b82f6',
    'created-from': '#8b5cf6',
  }

  // Filter toggles
  let filters = $state<Record<string, boolean>>({
    page: true,
    api: true,
    'server-module': true,
    'db-table': true,
    template: true,
    'child-project': true,
    shared: true,
  })

  // Layout mode
  let layoutMode = $state<'dagre' | 'cose'>('dagre')

  // Selected node
  let selectedNode = $state<any>(null)
  let connectedNodes = $state<any[]>([])

  // ── Graph data helpers ──────────────────────────────────────────

  function buildElements() {
    const visibleTypes = Object.entries(filters)
      .filter(([_, v]) => v)
      .map(([k]) => k)

    // Only use compound/parent nodes in hierarchical mode — cose doesn't handle them well
    const useGroups = layoutMode === 'dagre'

    const nodes = data.graph.nodes
      .filter((n: any) => {
        // Skip group nodes entirely in force mode
        if (n.id.startsWith('group:')) {
          return useGroups && visibleTypes.includes(n.type)
        }
        return visibleTypes.includes(n.type)
      })
      .map((n: any) => ({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          parent: useGroups ? (n.group || undefined) : undefined,
          ...n.meta,
        },
      }))

    const nodeIds = new Set(nodes.map((n: any) => n.data.id))

    const edges = data.graph.edges
      .filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e: any, i: number) => ({
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

  function getCyStyle() {
    return [
      // ── Group / compound nodes ──
      {
        selector: 'node[type="page"][!parent]',
        style: {
          'background-color': 'transparent',
          'border-width': 0,
          label: '',
        },
      },
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
      // ── Regular nodes (leaf nodes — either with parent or without in force mode) ──
      {
        selector: 'node[type]:not(:parent)',
        style: {
          label: 'data(label)',
          'text-valign': 'bottom' as any,
          'text-halign': 'center' as any,
          'text-margin-y': 6,
          'font-size': 9,
          color: 'rgba(255,255,255,0.7)',
          'text-wrap': 'ellipsis' as any,
          'text-max-width': '100px',
          width: 28,
          height: 28,
          'border-width': 2,
          'border-color': 'rgba(0,0,0,0.3)',
          'overlay-padding': 4,
        },
      },
      // ── Node type colors (leaf nodes only) ──
      ...Object.entries(TYPE_COLORS).map(([type, color]) => ({
        selector: `node[type="${type}"]:not(:parent)`,
        style: {
          'background-color': color,
        },
      })),
      // ── Override: compound parents must stay transparent regardless of type ──
      ...Object.entries(TYPE_COLORS).map(([type, color]) => ({
        selector: `node:parent[type="${type}"]`,
        style: {
          'background-color': 'rgba(255,255,255,0.03)',
          'background-opacity': 1,
          'border-color': color,
          'border-opacity': 0.3,
        },
      })),
      // ── Shared node (no parent) ──
      {
        selector: 'node[type="shared"]',
        style: {
          'background-color': TYPE_COLORS.shared,
          label: 'data(label)',
          'text-valign': 'bottom' as any,
          'text-halign': 'center' as any,
          'text-margin-y': 6,
          'font-size': 9,
          color: 'rgba(255,255,255,0.7)',
          width: 36,
          height: 36,
          'border-width': 2,
          'border-color': 'rgba(0,0,0,0.3)',
          shape: 'diamond' as any,
        },
      },
      // ── Edges ──
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': 'rgba(255,255,255,0.08)',
          'target-arrow-color': 'rgba(255,255,255,0.15)',
          'target-arrow-shape': 'triangle' as any,
          'arrow-scale': 0.6,
          'curve-style': 'bezier' as any,
          opacity: 0.6,
        },
      },
      ...Object.entries(EDGE_COLORS).map(([type, color]) => ({
        selector: `edge[edgeType="${type}"]`,
        style: {
          'line-color': color,
          'target-arrow-color': color,
          opacity: 0.3,
        },
      })),
      // ── Interaction states ──
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#ffffff',
          'overlay-color': '#ffffff',
          'overlay-opacity': 0.1,
        },
      },
      {
        selector: '.highlighted',
        style: {
          opacity: 1,
          'z-index': 10,
        },
      },
      {
        selector: '.highlighted-edge',
        style: {
          opacity: 0.8,
          width: 2.5,
          'z-index': 10,
        },
      },
      {
        selector: '.dimmed',
        style: {
          opacity: 0.08,
        },
      },
    ]
  }

  function getLayoutConfig() {
    if (layoutMode === 'dagre') {
      return {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 60,
        rankSep: 100,
        edgeSep: 30,
        padding: 50,
        animate: true,
        animationDuration: 400,
      }
    }
    return {
      name: 'cose',
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 120,
      gravity: 0.3,
      padding: 40,
      animate: true,
      animationDuration: 400,
      randomize: false,
    }
  }

  // ── Detail panel helpers ────────────────────────────────────────

  function getConnections(nodeId: string) {
    if (!cy) return []
    const node = cy.getElementById(nodeId)
    const connected = node.connectedEdges().connectedNodes().filter((n: any) => n.id() !== nodeId)
    return connected.map((n: any) => ({
      id: n.id(),
      label: n.data('label'),
      type: n.data('type'),
    }))
  }

  // ── Mount ───────────────────────────────────────────────────────

  onMount(async () => {
    const cytoscape = (await import('cytoscape')).default
    const dagre = (await import('cytoscape-dagre')).default
    cytoscape.use(dagre)

    cy = cytoscape({
      container,
      elements: buildElements(),
      style: getCyStyle() as any,
      layout: getLayoutConfig() as any,
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    })

    // Click handler — any leaf node (not a compound parent)
    cy.on('tap', 'node:not(:parent)', (evt: any) => {
      const node = evt.target
      selectedNode = node.data()
      connectedNodes = getConnections(node.id())

      // Highlight connected elements
      cy.elements().removeClass('highlighted highlighted-edge dimmed')
      cy.elements().addClass('dimmed')
      const neighborhood = node.neighborhood().add(node)
      neighborhood.nodes().removeClass('dimmed').addClass('highlighted')
      neighborhood.edges().removeClass('dimmed').addClass('highlighted-edge')
      // Keep parent groups visible
      cy.nodes(':parent').removeClass('dimmed')
    })

    // Click background to deselect
    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        selectedNode = null
        connectedNodes = []
        cy.elements().removeClass('highlighted highlighted-edge dimmed')
      }
    })

    return () => {
      if (cy) cy.destroy()
    }
  })

  // ── Reactive updates ────────────────────────────────────────────

  function updateGraph() {
    if (!cy) return
    selectedNode = null
    connectedNodes = []
    cy.elements().remove()
    cy.add(buildElements())
    cy.elements().removeClass('highlighted highlighted-edge dimmed')
    const layout = cy.layout(getLayoutConfig() as any)
    layout.run()
  }

  function handleFilterToggle(type: string) {
    filters[type] = !filters[type]
    updateGraph()
  }

  function handleLayoutToggle() {
    layoutMode = layoutMode === 'dagre' ? 'cose' : 'dagre'
    // Rebuild elements since compound grouping changes per layout mode
    updateGraph()
  }

  function fitGraph() {
    if (cy) cy.fit(undefined, 40)
  }

  function zoomIn() {
    if (cy) cy.zoom({ level: cy.zoom() * 1.3, position: cy.pan() })
  }

  function zoomOut() {
    if (cy) cy.zoom({ level: cy.zoom() / 1.3, position: cy.pan() })
  }
</script>

<svelte:head>
  <title>Architecture | App Hub</title>
</svelte:head>

<div class="arch-page">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <h2 class="page-title">Architecture</h2>
      <div class="stats-row">
        <span class="stat">{data.stats.pages} pages</span>
        <span class="stat">{data.stats.apis} APIs</span>
        <span class="stat">{data.stats.modules} modules</span>
        <span class="stat">{data.stats.tables} tables</span>
        <span class="stat">{data.stats.edges} connections</span>
      </div>
    </div>
    <div class="toolbar-right">
      <div class="filter-chips">
        {#each Object.entries(TYPE_LABELS) as [type, label]}
          <button
            class="chip"
            class:active={filters[type]}
            style="--chip-color: {TYPE_COLORS[type]}"
            onclick={() => handleFilterToggle(type)}
          >
            <span class="chip-dot"></span>
            {label}
          </button>
        {/each}
      </div>
      <div class="toolbar-controls">
        <button class="ctrl-btn" onclick={handleLayoutToggle} title="Toggle layout">
          {layoutMode === 'dagre' ? '\u2B22' : '\u25A6'} {layoutMode === 'dagre' ? 'Hierarchical' : 'Force'}
        </button>
        <button class="ctrl-btn" onclick={fitGraph} title="Fit to view">&#x2922;</button>
        <button class="ctrl-btn" onclick={zoomIn} title="Zoom in">+</button>
        <button class="ctrl-btn" onclick={zoomOut} title="Zoom out">-</button>
      </div>
    </div>
  </div>

  <!-- Graph + Detail panel -->
  <div class="graph-area">
    <div class="cy-container" bind:this={container}></div>

    {#if selectedNode}
      <div class="detail-panel glass">
        <div class="detail-header">
          <span class="detail-type-badge" style="background: {TYPE_COLORS[selectedNode.type]}">
            {TYPE_LABELS[selectedNode.type] || selectedNode.type}
          </span>
          <button class="detail-close" onclick={() => { selectedNode = null; connectedNodes = []; if (cy) cy.elements().removeClass('highlighted highlighted-edge dimmed'); }}>
            &times;
          </button>
        </div>

        <h3 class="detail-label">{selectedNode.label}</h3>

        {#if selectedNode.path}
          <div class="detail-field">
            <span class="field-label">Path</span>
            <span class="field-value mono">{selectedNode.path}</span>
          </div>
        {/if}

        {#if selectedNode.route}
          <div class="detail-field">
            <span class="field-label">Route</span>
            <span class="field-value mono">{selectedNode.route}</span>
          </div>
        {/if}

        {#if selectedNode.lines}
          <div class="detail-field">
            <span class="field-label">Lines</span>
            <span class="field-value">{selectedNode.lines}</span>
          </div>
        {/if}

        {#if selectedNode.methods?.length}
          <div class="detail-field">
            <span class="field-label">Methods</span>
            <div class="method-badges">
              {#each selectedNode.methods as method}
                <span class="method-badge method-{method.toLowerCase()}">{method}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedNode.exports?.length}
          <div class="detail-field">
            <span class="field-label">Exports</span>
            <div class="export-list">
              {#each selectedNode.exports as exp}
                <span class="export-name mono">{exp}()</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedNode.columns?.length}
          <div class="detail-field">
            <span class="field-label">Columns</span>
            <div class="column-list">
              {#each selectedNode.columns as col}
                <span class="column-name mono">{col}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedNode.description}
          <div class="detail-field">
            <span class="field-label">Description</span>
            <span class="field-value">{selectedNode.description}</span>
          </div>
        {/if}

        {#if selectedNode.tags?.length}
          <div class="detail-field">
            <span class="field-label">Tags</span>
            <div class="tag-list">
              {#each selectedNode.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if connectedNodes.length > 0}
          <div class="detail-section">
            <span class="field-label">Connections ({connectedNodes.length})</span>
            <div class="connection-list">
              {#each connectedNodes as conn}
                <button
                  class="connection-item"
                  onclick={() => { if (cy) { cy.getElementById(conn.id).emit('tap'); } }}
                >
                  <span class="conn-dot" style="background: {TYPE_COLORS[conn.type]}"></span>
                  <span class="conn-label">{conn.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Legend -->
  <div class="legend">
    <div class="legend-section">
      <span class="legend-title">Edges</span>
      {#each Object.entries(EDGE_COLORS) as [type, color]}
        <span class="legend-item">
          <span class="legend-line" style="background: {color}"></span>
          {type}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  .arch-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 4rem);
    margin: -2rem;
    position: relative;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    flex-shrink: 0;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .toolbar-left {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .page-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }
  .stats-row {
    display: flex;
    gap: 0.75rem;
  }
  .stat {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  /* ── Filter chips ── */
  .filter-chips {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.68rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .chip.active {
    background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    border-color: var(--chip-color);
    color: var(--text);
  }
  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--chip-color);
  }

  /* ── Controls ── */
  .toolbar-controls {
    display: flex;
    gap: 0.25rem;
  }
  .ctrl-btn {
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-inset);
    color: var(--text-muted);
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ctrl-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  /* ── Graph area ── */
  .graph-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .cy-container {
    width: 100%;
    height: 100%;
    background: var(--bg);
  }

  /* ── Detail panel ── */
  .detail-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 300px;
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    padding: 1rem;
    overflow-y: auto;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detail-type-badge {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    color: #fff;
  }
  .detail-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.2rem;
    line-height: 1;
  }
  .detail-close:hover {
    color: var(--text);
  }
  .detail-label {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
    word-break: break-all;
  }

  .detail-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .field-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .field-value {
    font-size: 0.8rem;
    color: var(--text);
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .method-badges {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .method-badge {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-family: var(--font-mono);
  }
  .method-get { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .method-post { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
  .method-patch { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
  .method-delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  .method-put { background: rgba(168, 85, 247, 0.2); color: #a855f7; }

  .export-list, .column-list, .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }
  .export-name {
    font-size: 0.68rem;
    background: var(--bg-inset);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: var(--text-muted);
  }
  .column-name {
    font-size: 0.68rem;
    background: rgba(59, 130, 246, 0.1);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: #60a5fa;
  }
  .tag {
    font-size: 0.65rem;
    background: var(--bg-inset);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: var(--text-muted);
  }

  .connection-list {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-height: 200px;
    overflow-y: auto;
  }
  .connection-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    background: none;
    border: none;
    color: var(--text);
    font-size: 0.72rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .connection-item:hover {
    background: var(--bg-hover);
  }
  .conn-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .conn-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Legend ── */
  .legend {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    display: flex;
    gap: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.4rem 0.75rem;
    z-index: 5;
  }
  .legend-section {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .legend-title {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.65rem;
    color: var(--text-muted);
  }
  .legend-line {
    width: 16px;
    height: 2px;
    border-radius: 1px;
  }
</style>
