<!--
  Map — kosmos as one graph: projects, playbooks, decisions, conventions,
  plans, topics and shared building blocks.

  The graph components are the architecture page's; this page hands them the
  map's palette, filters and settings. The data comes from $lib/server/kosmos,
  which only reads: kosmos stays the source.
-->
<script lang="ts">
  import { tick } from 'svelte'
  import { invalidateAll } from '$app/navigation'
  import { SettingsPanel, DetailPanel, CytoscapeGraph, ForceGraph3D } from '$lib/components/architecture'
  import { MAP_PALETTE } from '$lib/components/architecture/constants'
  import type { SelectedNodeInfo, ConnectedNode } from '$lib/components/architecture/constants'
  import KosmosReader from '$lib/components/map/KosmosReader.svelte'
  import { mapSettings, mapFilters, mapPanel, resetMapSettings } from '$lib/stores/map-settings.svelte'

  let { data } = $props()

  // ── Selection + reader ────────────────────────────────────────
  let selectedNode = $state<SelectedNodeInfo | null>(null)
  let connectedNodes = $state<ConnectedNode[]>([])
  let readingPageId = $state<string | null>(null)

  let cyGraph: CytoscapeGraph | undefined = $state()
  let graph3d: ForceGraph3D | undefined = $state()

  // ── View mode switching (same dance as the architecture page) ─
  let activeView = $state<'2d' | '3d'>(mapSettings.viewMode)
  let prevViewMode = mapSettings.viewMode
  $effect(() => {
    if (mapSettings.viewMode !== prevViewMode) {
      prevViewMode = mapSettings.viewMode
      selectedNode = null
      connectedNodes = []
      tick().then(() => {
        activeView = mapSettings.viewMode
      })
    }
  })

  function handleSelect(node: SelectedNodeInfo, connections: ConnectedNode[]) {
    selectedNode = node
    connectedNodes = connections
  }

  function handleDeselect() {
    selectedNode = null
    connectedNodes = []
  }

  function fitGraph() {
    if (activeView === '2d') cyGraph?.fit()
    else graph3d?.fit()
  }

  // ── Reader ────────────────────────────────────────────────────
  /** Node that stands for a kosmos page: the page itself, or the project it describes */
  function nodeForPage(pageId: string): string | undefined {
    const nodes = data.graph?.nodes ?? []
    return (
      nodes.find((n) => n.id === `page:${pageId}`) ?? nodes.find((n) => n.type === 'projekt' && n.meta.pageId === pageId)
    )?.id
  }

  function readPage(pageId: string) {
    readingPageId = pageId
    const nodeId = nodeForPage(pageId)
    if (nodeId && activeView === '2d' && selectedNode?.id !== nodeId) cyGraph?.clickNode(nodeId)
  }

  // ── Setup: where kosmos lives on this machine ─────────────────
  let pathInput = $state('')
  let saving = $state(false)
  let setupError = $state('')

  async function savePath(event: SubmitEvent) {
    event.preventDefault()
    saving = true
    setupError = ''
    try {
      const res = await fetch('/api/kosmos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathInput }),
      }).then((r) => r.json())
      if (!res.ok) setupError = res.error ?? 'Could not save the path'
      else await invalidateAll()
    } catch (e) {
      setupError = String(e)
    } finally {
      saving = false
    }
  }
</script>

<svelte:head>
  <title>Map | App Hub</title>
</svelte:head>

{#if !data.graph}
  <div class="setup">
    <h2>Map</h2>
    {#if data.location.path}
      <p class="setup-warn">
        The kosmos path does not exist on this machine: <code>{data.location.path}</code>
      </p>
    {:else}
      <p>
        The map draws <strong>kosmos</strong> — projects, playbooks, decisions and what connects them — as one
        graph. Tell the hub where kosmos lives on this machine.
      </p>
    {/if}
    {#if data.location.source === 'env'}
      <p class="setup-muted">The path comes from <code>APPHUB_KOSMOS_DIR</code>; change it there.</p>
    {:else}
      <form class="setup-form" onsubmit={savePath}>
        <input
          type="text"
          bind:value={pathInput}
          placeholder="D:\Projekte\dev\kosmos  ·  ~/kosmos"
          aria-label="Path to the kosmos vault"
        />
        <button type="submit" disabled={saving || !pathInput.trim()}>{saving ? 'Saving…' : 'Use this folder'}</button>
      </form>
      {#if setupError}<p class="setup-warn">{setupError}</p>{/if}
      <p class="setup-muted">
        The vault folder, or a clone of its <code>werkstatt</code> repo. Stored in <code>apphub.local.json</code>,
        per machine. The hub only reads from it.
      </p>
    {/if}
  </div>
{:else}
  <div class="map-page">
    <div class="topbar">
      <div class="topbar-left">
        <button
          class="settings-toggle"
          class:active={mapPanel.open}
          onclick={() => (mapPanel.open = !mapPanel.open)}
          title="Toggle settings"
          aria-label="Toggle settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
          </svg>
        </button>
        <h2 class="page-title">Map</h2>
        <div class="stats-pills">
          <span class="pill">{data.graph.stats.projects} projects</span>
          <span class="pill">{data.graph.stats.pages} pages</span>
          <span class="pill">{data.graph.stats.topics} topics</span>
          <span class="pill">{data.graph.stats.blocks} building blocks</span>
          <span class="pill">{data.graph.stats.edges} edges</span>
        </div>
      </div>
      <div class="topbar-right">
        <span class="source" title="Where kosmos is read from ({data.location.layout})">{data.location.path}</span>
        <div class="view-toggle">
          <button class="vt-btn" class:active={mapSettings.viewMode === '2d'} onclick={() => (mapSettings.viewMode = '2d')}>2D</button>
          <button class="vt-btn" class:active={mapSettings.viewMode === '3d'} onclick={() => (mapSettings.viewMode = '3d')}>3D</button>
        </div>
        <button class="ctrl-btn" onclick={fitGraph} title="Fit to view" aria-label="Fit to view">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/></svg>
        </button>
        {#if activeView === '2d'}
          <button class="ctrl-btn" onclick={() => cyGraph?.zoomIn()} title="Zoom in">+</button>
          <button class="ctrl-btn" onclick={() => cyGraph?.zoomOut()} title="Zoom out">&minus;</button>
        {/if}
      </div>
    </div>

    <div class="main-area">
      {#if mapPanel.open}
        <SettingsPanel palette={MAP_PALETTE} filters={mapFilters} settings={mapSettings} onreset={resetMapSettings} />
      {/if}

      <div class="graph-area">
        {#if activeView === '2d'}
          <CytoscapeGraph
            bind:this={cyGraph}
            graphData={data.graph}
            palette={MAP_PALETTE}
            filters={mapFilters}
            settings={mapSettings}
            onselect={handleSelect}
            ondeselect={handleDeselect}
          />
        {:else}
          <ForceGraph3D
            bind:this={graph3d}
            graphData={data.graph}
            palette={MAP_PALETTE}
            filters={mapFilters}
            settings={mapSettings}
            onselect={handleSelect}
            ondeselect={handleDeselect}
          />
        {/if}

        {#if selectedNode}
          <DetailPanel
            node={selectedNode}
            connections={connectedNodes}
            palette={MAP_PALETTE}
            onclose={handleDeselect}
            onread={readPage}
            onconnectionclick={(id) => {
              if (activeView === '2d') cyGraph?.clickNode(id)
            }}
          />
        {/if}

        {#if readingPageId}
          <KosmosReader
            pageId={readingPageId}
            isKnown={(id) => nodeForPage(id) !== undefined}
            onclose={() => (readingPageId = null)}
            onnavigate={readPage}
          />
        {/if}

        <div class="legend">
          {#each Object.entries(MAP_PALETTE.nodeLabels) as [type, label]}
            <span class="legend-item" class:inactive={!mapFilters.nodes[type]}>
              <span class="legend-dot" style="background: {MAP_PALETTE.nodeColors[type]}"></span>
              {label}
            </span>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .map-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 4rem);
    margin: -2rem;
    position: relative;
    overflow: hidden;
  }

  /* ── Setup ── */
  .setup {
    max-width: 620px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .setup h2 { margin: 0; }
  .setup p { margin: 0; line-height: 1.55; }
  .setup code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg-inset);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .setup-form { display: flex; gap: 0.5rem; }
  .setup-form input {
    flex: 1;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .setup-form button {
    padding: 0.5rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }
  .setup-form button:disabled { opacity: 0.5; cursor: default; }
  .setup-muted { color: var(--text-muted); font-size: 0.82rem; }
  .setup-warn { color: var(--warning); }

  /* ── Top bar ── */
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    flex-shrink: 0;
    z-index: 20;
    gap: 0.75rem;
  }
  .topbar-left, .topbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .topbar-right { gap: 0.5rem; }
  .settings-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .settings-toggle:hover, .settings-toggle.active {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }
  .page-title {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0;
    white-space: nowrap;
  }
  .stats-pills { display: flex; gap: 0.35rem; }
  .pill {
    font-size: 0.62rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    background: var(--bg-inset);
    padding: 0.15rem 0.4rem;
    border-radius: 999px;
    white-space: nowrap;
  }
  .source {
    font-size: 0.62rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .vt-btn {
    padding: 0.25rem 0.65rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .vt-btn.active { background: var(--accent); color: #fff; }
  .vt-btn:not(.active):hover { background: var(--bg-hover); }

  .ctrl-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .ctrl-btn:hover { background: var(--bg-hover); color: var(--text); }

  /* ── Main area ── */
  .main-area {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }
  .graph-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* ── Legend ── */
  .legend {
    position: absolute;
    bottom: 10px;
    left: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.7rem;
    max-width: calc(100% - 20px);
    background: rgba(18, 18, 26, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 0.3rem 0.65rem;
    z-index: 5;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.62rem;
    color: var(--text-muted);
    transition: opacity 0.15s;
  }
  .legend-item.inactive { opacity: 0.3; }
  .legend-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
</style>
