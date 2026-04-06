<script lang="ts">
  import { onMount } from 'svelte'

  let { data } = $props()

  // Derive initial values from server data, then manage locally via fetch
  let initialLogs = $derived(data.logs)
  let initialTotal = $derived(data.total)

  // Filter state — derive from server data so Svelte tracks updates on navigation
  let level = $state('')
  let category = $state('')
  let search = $state('')
  // Sync filters when server data changes (e.g. URL navigation)
  $effect(() => {
    level = data.filters.level
    category = data.filters.category
    search = data.filters.search
  })
  let autoRefresh = $state(false)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  // Expanded rows
  let expandedIds = $state<Set<string>>(new Set())

  // Local logs state for live updates (falls back to server data)
  let localLogs = $state<typeof data.logs | null>(null)
  let localTotal = $state<number | null>(null)
  let logs = $derived(localLogs ?? initialLogs)
  let total = $derived(localTotal ?? initialTotal)
  let offset = $state(0)
  let limit = $state(100)

  const categories = ['', 'board', 'claude', 'project', 'sync', 'auth', 'system']
  const levels = ['', 'debug', 'info', 'warn', 'error']

  const levelIcons: Record<string, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  }

  const categoryColors: Record<string, string> = {
    board: 'var(--accent)',
    claude: 'var(--purple)',
    project: 'var(--success)',
    sync: 'var(--info)',
    auth: 'var(--warning)',
    system: 'var(--text-muted)',
  }

  async function fetchLogs() {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    params.set('limit', String(limit))
    params.set('offset', String(offset))

    const res = await fetch(`/api/logs?${params}`)
    if (res.ok) {
      const { data: d } = await res.json()
      localLogs = d.logs
      localTotal = d.total
    }
  }

  function applyFilters() {
    offset = 0
    fetchLogs()
  }

  function clearFilters() {
    level = ''
    category = ''
    search = ''
    offset = 0
    fetchLogs()
  }

  function nextPage() {
    if (offset + limit < total) {
      offset += limit
      fetchLogs()
    }
  }

  function prevPage() {
    if (offset > 0) {
      offset = Math.max(0, offset - limit)
      fetchLogs()
    }
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    expandedIds = next
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh
    if (autoRefresh) {
      refreshInterval = setInterval(fetchLogs, 3000)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  async function clearLogs() {
    if (!confirm('Clear all logs? This cannot be undone.')) return
    const res = await fetch('/api/logs', { method: 'DELETE' })
    if (res.ok) {
      localLogs = []
      localTotal = 0
      offset = 0
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('en', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  function tryParseMetadata(meta: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(meta)
      if (Object.keys(parsed).length === 0) return null
      return parsed
    } catch {
      return null
    }
  }

  onMount(() => {
    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
    }
  })
</script>

<div class="logs-page">
  <header class="page-header">
    <div>
      <h1>Activity Log</h1>
      <p class="subtitle">{total} entries</p>
    </div>
    <div class="header-actions">
      <button
        class="btn-toggle"
        class:active={autoRefresh}
        onclick={toggleAutoRefresh}
        title="Auto-refresh every 3s"
      >
        {autoRefresh ? '⏸ Pause' : '▶ Live'}
      </button>
      <button class="btn-ghost" onclick={fetchLogs}>↻ Refresh</button>
      <button class="btn-ghost btn-danger-text" onclick={clearLogs}>Clear All</button>
    </div>
  </header>

  <!-- Filters -->
  <div class="filters">
    <select bind:value={level} onchange={applyFilters}>
      <option value="">All Levels</option>
      {#each levels.slice(1) as l}
        <option value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
      {/each}
    </select>

    <select bind:value={category} onchange={applyFilters}>
      <option value="">All Categories</option>
      {#each categories.slice(1) as c}
        <option value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
      {/each}
    </select>

    <input
      type="text"
      bind:value={search}
      placeholder="Search logs..."
      class="search-input"
      onkeydown={(e) => {
        if (e.key === 'Enter') applyFilters()
      }}
    />

    <button class="btn-ghost btn-sm" onclick={applyFilters}>Search</button>

    {#if level || category || search}
      <button class="btn-ghost btn-sm" onclick={clearFilters}>✕ Clear</button>
    {/if}
  </div>

  <!-- Log table -->
  <div class="log-table-wrap">
    <table class="log-table">
      <thead>
        <tr>
          <th class="col-time">Time</th>
          <th class="col-level">Level</th>
          <th class="col-cat">Category</th>
          <th class="col-action">Action</th>
          <th class="col-msg">Message</th>
        </tr>
      </thead>
      <tbody>
        {#if logs.length === 0}
          <tr>
            <td colspan="5" class="empty-row">
              No log entries found.
              {#if level || category || search}Try adjusting the filters.{/if}
            </td>
          </tr>
        {/if}
        {#each logs as entry (entry.id)}
          {@const meta = tryParseMetadata(entry.metadata)}
          <tr
            class="log-row level-{entry.level}"
            class:expanded={expandedIds.has(entry.id)}
            onclick={() => meta && toggleExpand(entry.id)}
            class:clickable={!!meta}
          >
            <td class="col-time">
              <span class="date-label">{formatDate(entry.timestamp)}</span>
              <span class="time-label">{formatTime(entry.timestamp)}</span>
            </td>
            <td class="col-level">
              <span class="level-badge level-{entry.level}">
                {entry.level}
              </span>
            </td>
            <td class="col-cat">
              <span
                class="cat-badge"
                style="--cat-color: {categoryColors[entry.category] ?? 'var(--text-muted)'}"
              >
                {entry.category}
              </span>
            </td>
            <td class="col-action">
              <code class="action-code">{entry.action}</code>
            </td>
            <td class="col-msg">
              <span class="msg-text">{entry.message}</span>
              {#if meta}
                <span class="expand-hint">{expandedIds.has(entry.id) ? '▾' : '▸'}</span>
              {/if}
            </td>
          </tr>
          {#if expandedIds.has(entry.id) && meta}
            <tr class="meta-row">
              <td colspan="5">
                <div class="meta-content">
                  {#each Object.entries(meta) as [key, value]}
                    <div class="meta-item">
                      <span class="meta-key">{key}:</span>
                      <span class="meta-value"
                        >{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span
                      >
                    </div>
                  {/each}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if total > limit}
    <div class="pagination">
      <button class="btn-ghost btn-sm" onclick={prevPage} disabled={offset === 0}>
        ← Previous
      </button>
      <span class="page-info">
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <button class="btn-ghost btn-sm" onclick={nextPage} disabled={offset + limit >= total}>
        Next →
      </button>
    </div>
  {/if}
</div>

<style>
  .logs-page {
    max-width: 100%;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-toggle {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
    background: var(--bg-card);
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-toggle.active {
    background: var(--success);
    color: white;
    border-color: var(--success);
  }
  .btn-danger-text {
    color: var(--danger) !important;
  }
  .btn-danger-text:hover {
    background: var(--danger-subtle) !important;
  }

  .btn-sm {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }

  /* Filters */
  .filters {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .filters select {
    font-size: 0.8rem;
    padding: 0.35rem 0.5rem;
  }
  .search-input {
    flex: 1;
    min-width: 200px;
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
  }

  /* Table */
  .log-table-wrap {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .log-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  .log-table thead {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
  }
  .log-table th {
    text-align: left;
    padding: 0.6rem 0.75rem;
    font-weight: 600;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  .log-table td {
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border-subtle);
    vertical-align: top;
  }

  .col-time {
    width: 110px;
  }
  .col-level {
    width: 65px;
  }
  .col-cat {
    width: 80px;
  }
  .col-action {
    width: 150px;
  }
  .col-msg {
    flex: 1;
  }

  .log-row {
    transition: background 0.1s ease;
  }
  .log-row:hover {
    background: var(--bg-hover);
  }
  .log-row.clickable {
    cursor: pointer;
  }

  /* Level styles */
  .log-row.level-error {
    background: var(--danger-subtle);
  }
  .log-row.level-warn {
    background: var(--warning-subtle);
  }
  .log-row.level-error:hover {
    background: var(--danger-subtle);
    filter: brightness(1.2);
  }
  .log-row.level-warn:hover {
    background: var(--warning-subtle);
    filter: brightness(1.2);
  }

  .date-label {
    display: block;
    font-size: 0.62rem;
    color: var(--text-muted);
    line-height: 1.2;
  }
  .time-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text);
  }

  .level-badge {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }
  .level-badge.level-debug {
    color: var(--text-muted);
    background: var(--muted-subtle);
  }
  .level-badge.level-info {
    color: var(--info);
    background: var(--info-subtle);
  }
  .level-badge.level-warn {
    color: var(--warning);
    background: var(--warning-subtle);
  }
  .level-badge.level-error {
    color: var(--danger);
    background: var(--danger-subtle);
  }

  .cat-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 500;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: var(--cat-color);
    background: color-mix(in srgb, var(--cat-color) 12%, transparent);
  }

  .action-code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .msg-text {
    color: var(--text);
    line-height: 1.4;
  }
  .expand-hint {
    color: var(--text-muted);
    margin-left: 0.4rem;
    font-size: 0.7rem;
  }

  .empty-row {
    text-align: center;
    padding: 2rem !important;
    color: var(--text-muted);
  }

  /* Metadata expansion */
  .meta-row td {
    padding: 0 0.75rem 0.6rem !important;
    border-top: none !important;
  }
  .meta-content {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
  }
  .meta-item {
    display: flex;
    gap: 0.35rem;
    font-size: 0.7rem;
  }
  .meta-key {
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
  .meta-value {
    color: var(--accent);
    font-family: var(--font-mono);
    word-break: break-word;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    padding: 0.75rem;
  }
  .page-info {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
