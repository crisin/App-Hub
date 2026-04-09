<!--
  Architecture visualization page — thin orchestrator.

  All logic lives in components and the settings store:
  - SettingsPanel: floating glassmorphism settings overlay
  - CytoscapeGraph: 2D interactive graph
  - ForceGraph3D: 3D WebGL graph
  - DetailPanel: selected node detail overlay
  - archSettings store: single source of truth for all settings

  To add a new visualization mode:
  1. Create a new component (e.g. TreemapView.svelte) with the same API
  2. Add the mode to archSettings.viewMode type
  3. Add a {#if} block + tab button here
-->
<script lang="ts">
  import { tick } from 'svelte'
  import { SettingsPanel, DetailPanel, CytoscapeGraph, ForceGraph3D } from '$lib/components/architecture'
  import { EDGE_COLORS } from '$lib/components/architecture/constants'
  import {
    archSettings,
    settingsOpen,
    edgeFilters,
  } from '$lib/stores/architecture-settings.svelte'
  import type { SelectedNodeInfo, ConnectedNode } from '$lib/components/architecture/constants'

  let { data } = $props()

  // ── Selection state (shared between graph components) ─────────
  let selectedNode = $state<SelectedNodeInfo | null>(null)
  let connectedNodes = $state<ConnectedNode[]>([])

  // ── Component refs ────────────────────────────────────────────
  let cyGraph: CytoscapeGraph | undefined = $state()
  let graph3d: ForceGraph3D | undefined = $state()

  // ── View mode switching ───────────────────────────────────────
  let activeView = $state<'2d' | '3d'>(archSettings.viewMode)

  // Sync activeView with settings and handle destroy/init
  let prevViewMode = archSettings.viewMode
  $effect(() => {
    if (archSettings.viewMode !== prevViewMode) {
      prevViewMode = archSettings.viewMode
      selectedNode = null
      connectedNodes = []
      // Delay to let the old component unmount
      tick().then(() => {
        activeView = archSettings.viewMode
      })
    }
  })

  // ── Selection handlers ────────────────────────────────────────
  function handleSelect(node: SelectedNodeInfo, connections: ConnectedNode[]) {
    selectedNode = node
    connectedNodes = connections
  }

  function handleDeselect() {
    selectedNode = null
    connectedNodes = []
  }

  function handleClose() {
    selectedNode = null
    connectedNodes = []
    // Clear cytoscape highlighting
    cyGraph?.clickNode?.('__deselect__') // no-op, just triggers deselect via tap
  }

  // ── Graph actions ─────────────────────────────────────────────
  function fitGraph() {
    if (activeView === '2d') cyGraph?.fit()
    else graph3d?.fit()
  }

  function zoomIn() {
    if (activeView === '2d') cyGraph?.zoomIn()
  }

  function zoomOut() {
    if (activeView === '2d') cyGraph?.zoomOut()
  }
</script>

<svelte:head>
  <title>Architecture | App Hub</title>
</svelte:head>

<div class="arch-page">
  <!-- Top bar -->
  <div class="topbar">
    <div class="topbar-left">
      <button
        class="settings-toggle"
        class:active={settingsOpen.value}
        onclick={() => (settingsOpen.value = !settingsOpen.value)}
        title="Toggle settings"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
      </button>
      <h2 class="page-title">Architecture</h2>
      <div class="stats-pills">
        <span class="pill">{data.stats.pages} pages</span>
        <span class="pill">{data.stats.apis} APIs</span>
        <span class="pill">{data.stats.modules} modules</span>
        <span class="pill">{data.stats.tables} tables</span>
        <span class="pill">{data.stats.edges} edges</span>
      </div>
    </div>
    <div class="topbar-right">
      <div class="view-toggle">
        <button class="vt-btn" class:active={archSettings.viewMode === '2d'} onclick={() => (archSettings.viewMode = '2d')}>2D</button>
        <button class="vt-btn" class:active={archSettings.viewMode === '3d'} onclick={() => (archSettings.viewMode = '3d')}>3D</button>
      </div>
      <button class="ctrl-btn" onclick={fitGraph} title="Fit to view">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/></svg>
      </button>
      {#if activeView === '2d'}
        <button class="ctrl-btn" onclick={zoomIn} title="Zoom in">+</button>
        <button class="ctrl-btn" onclick={zoomOut} title="Zoom out">&minus;</button>
      {/if}
    </div>
  </div>

  <div class="main-area">
    <!-- Settings panel (overlay) -->
    {#if settingsOpen.value}
      <SettingsPanel />
    {/if}

    <!-- Graph container -->
    <div class="graph-area">
      {#if activeView === '2d'}
        <CytoscapeGraph
          bind:this={cyGraph}
          graphData={data.graph}
          onselect={handleSelect}
          ondeselect={handleDeselect}
        />
      {:else}
        <ForceGraph3D
          bind:this={graph3d}
          graphData={data.graph}
          onselect={handleSelect}
          ondeselect={handleDeselect}
        />
      {/if}

      <!-- Detail panel -->
      {#if selectedNode}
        <DetailPanel
          node={selectedNode}
          connections={connectedNodes}
          onclose={handleClose}
          onconnectionclick={(id) => {
            if (activeView === '2d') cyGraph?.clickNode(id)
          }}
        />
      {/if}

      <!-- Legend -->
      <div class="legend">
        {#each Object.entries(EDGE_COLORS) as [type, color]}
          <span class="legend-item" class:inactive={!edgeFilters[type]}>
            <span class="legend-line" style="background: {color}"></span>
            {type}
          </span>
        {/each}
      </div>
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
    overflow: hidden;
  }

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
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
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
  .stats-pills {
    display: flex;
    gap: 0.35rem;
  }
  .pill {
    font-size: 0.62rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    background: var(--bg-inset);
    padding: 0.15rem 0.4rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  /* ── View toggle ── */
  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
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
    gap: 0.6rem;
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
    gap: 0.2rem;
    font-size: 0.6rem;
    color: var(--text-muted);
    transition: opacity 0.15s;
  }
  .legend-item.inactive { opacity: 0.3; }
  .legend-line {
    width: 14px;
    height: 2px;
    border-radius: 1px;
  }
</style>
