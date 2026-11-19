<!--
  Node detail panel — glassmorphism overlay on the right side of the graph.
  Shows metadata and connections for the selected node.
-->
<script lang="ts">
  import { ARCH_PALETTE, type GraphPalette, type SelectedNodeInfo, type ConnectedNode } from './constants'

  let {
    node,
    connections = [],
    onclose,
    onconnectionclick,
    onread,
    palette = ARCH_PALETTE,
  }: {
    node: SelectedNodeInfo
    connections: ConnectedNode[]
    onclose: () => void
    onconnectionclick?: (id: string) => void
    /** Open the node's page in a reader — the button only shows when this is set */
    onread?: (pageId: string) => void
    palette?: GraphPalette
  } = $props()
</script>

<div class="detail-panel">
  <div class="detail-header">
    <span class="detail-badge" style="background: {palette.nodeColors[node.type] ?? '#888'}">
      {palette.nodeLabels[node.type] || node.type}
    </span>
    <button class="detail-close" onclick={onclose}>&times;</button>
  </div>

  <h3 class="detail-name">{node.label}</h3>

  {#if node.path}
    <div class="d-field">
      <span class="d-key">Path</span>
      <span class="d-val mono">{node.path}</span>
    </div>
  {/if}

  {#if node.route}
    <div class="d-field">
      <span class="d-key">Route</span>
      <span class="d-val mono">{node.route}</span>
    </div>
  {/if}

  {#if node.lines}
    <div class="d-field">
      <span class="d-key">Lines</span>
      <span class="d-val">{node.lines}</span>
    </div>
  {/if}

  {#if node.methods?.length}
    <div class="d-field">
      <span class="d-key">Methods</span>
      <div class="d-methods">
        {#each node.methods as method}
          <span class="d-method d-method-{method.toLowerCase()}">{method}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if node.exports?.length}
    <div class="d-field">
      <span class="d-key">Exports</span>
      <div class="d-chips">
        {#each node.exports as exp}
          <span class="d-chip mono">{exp}()</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if node.columns?.length}
    <div class="d-field">
      <span class="d-key">Columns</span>
      <div class="d-chips">
        {#each node.columns as col}
          <span class="d-chip col mono">{col}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if node.description}
    <div class="d-field">
      <span class="d-key">Description</span>
      <span class="d-val">{node.description}</span>
    </div>
  {/if}

  {#each node.details ?? [] as detail}
    <div class="d-field">
      <span class="d-key">{detail.key}</span>
      <span class="d-val">{detail.value}</span>
    </div>
  {/each}

  {#if node.tags?.length}
    <div class="d-field">
      <span class="d-key">Topics</span>
      <div class="d-chips">
        {#each node.tags as tag}
          <span class="d-chip">{tag}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if node.url || (node.pageId && onread)}
    <div class="d-actions">
      {#if node.pageId && onread}
        <button class="d-action primary" onclick={() => onread?.(node.pageId!)}>Read</button>
      {/if}
      {#if node.url}
        <a class="d-action" href={node.url} target="_blank" rel="noreferrer">Repository &#x2197;</a>
      {/if}
    </div>
  {/if}

  {#if connections.length > 0}
    <div class="d-section">
      <span class="d-key">Connections ({connections.length})</span>
      <div class="d-connections">
        {#each connections as conn}
          <button
            class="d-conn"
            onclick={() => onconnectionclick?.(conn.id)}
          >
            <span class="d-conn-dot" style="background: {palette.nodeColors[conn.type] ?? '#888'}"></span>
            {conn.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .detail-panel {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 280px;
    max-height: calc(100% - 24px);
    background: rgba(18, 18, 26, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.85rem;
    overflow-y: auto;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .detail-panel::-webkit-scrollbar { width: 3px; }
  .detail-panel::-webkit-scrollbar-track { background: transparent; }
  .detail-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detail-badge {
    font-size: 0.58rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.12rem 0.45rem;
    border-radius: 4px;
    color: #fff;
  }
  .detail-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.15rem;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .detail-close:hover {
    color: var(--text);
    background: rgba(255,255,255,0.06);
  }
  .detail-name {
    font-size: 0.88rem;
    font-weight: 600;
    margin: 0;
    word-break: break-all;
  }

  .d-field {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .d-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .d-key {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  .d-val {
    font-size: 0.76rem;
    color: var(--text);
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }

  .d-methods { display: flex; gap: 0.2rem; flex-wrap: wrap; }
  .d-method {
    font-size: 0.58rem;
    font-weight: 700;
    padding: 0.08rem 0.3rem;
    border-radius: 3px;
    font-family: var(--font-mono);
  }
  .d-method-get { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .d-method-post { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
  .d-method-patch { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
  .d-method-delete { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  .d-method-put { background: rgba(168, 85, 247, 0.2); color: #a855f7; }

  .d-chips { display: flex; flex-wrap: wrap; gap: 0.15rem; }
  .d-chip {
    font-size: 0.62rem;
    background: rgba(255,255,255,0.05);
    padding: 0.08rem 0.3rem;
    border-radius: 3px;
    color: var(--text-muted);
  }
  .d-chip.col {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }

  .d-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .d-action {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.28rem 0.6rem;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: var(--text);
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;
  }
  .d-action:hover { background: rgba(255,255,255,0.09); }
  .d-action.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .d-action.primary:hover { filter: brightness(1.1); }

  .d-connections {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    max-height: 180px;
    overflow-y: auto;
  }
  .d-conn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.35rem;
    border-radius: 4px;
    background: none;
    border: none;
    color: var(--text);
    font-size: 0.68rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .d-conn:hover { background: rgba(255,255,255,0.05); }
  .d-conn-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
