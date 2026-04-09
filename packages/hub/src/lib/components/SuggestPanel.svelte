<!--
  AI Suggestion Panel — slide-down panel on the board page.
  Asks Claude to propose tasks for a project, displays them as cards,
  and lets the user accept (create item), edit, or dismiss each one.
-->
<script lang="ts">
  import { ITEM_STAGE_LABELS } from '@apphub/shared'
  import type { ItemStage } from '@apphub/shared'

  let {
    scopes = [],
    projectSlug,
    onaccept,
    onclose,
  }: {
    scopes?: Array<{ slug: string; label: string; type: string; color?: string; icon?: string }>
    projectSlug?: string
    onaccept: (suggestion: Suggestion) => void
    onclose: () => void
  } = $props()

  interface Suggestion {
    title: string
    description: string
    priority: string
    labels: string[]
    stage: string
    rationale: string
  }

  // ── State ─────────────────────────────────────────────────────
  let selectedScope = $state(projectSlug ?? scopes[0]?.slug ?? 'hub')
  let showScopeSelector = scopes.length > 0 && !projectSlug
  let focus = $state('')
  let count = $state(5)
  let loading = $state(false)
  let error = $state('')
  let suggestions = $state<Suggestion[]>([])
  let accepted = $state<Set<number>>(new Set())
  let dismissed = $state<Set<number>>(new Set())
  let editingIndex = $state<number | null>(null)

  // Edit state
  let editTitle = $state('')
  let editDescription = $state('')
  let editPriority = $state('medium')
  let editStage = $state('idea')
  let editLabels = $state('')

  const priorityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#6366f1',
    low: '#64748b',
  }

  const stageLabels: Record<string, string> = {
    idea: 'Idea',
    plan: 'Plan',
    build: 'Build',
    claude: 'Claude',
    review: 'Review',
    done: 'Done',
  }

  // ── Generate ──────────────────────────────────────────────────
  async function generate() {
    loading = true
    error = ''
    suggestions = []
    accepted = new Set()
    dismissed = new Set()
    editingIndex = null

    try {
      const res = await fetch('/api/board/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_slug: selectedScope,
          focus: focus.trim() || undefined,
          count,
        }),
      })

      const data = await res.json()

      if (!data.ok) {
        error = data.error || 'Failed to generate suggestions'
        return
      }

      suggestions = data.data
    } catch (err: any) {
      error = err.message || 'Network error'
    } finally {
      loading = false
    }
  }

  // ── Actions ───────────────────────────────────────────────────
  function acceptSuggestion(index: number) {
    const s = suggestions[index]
    if (!s) return
    onaccept(s)
    accepted = new Set([...accepted, index])
  }

  function dismissSuggestion(index: number) {
    dismissed = new Set([...dismissed, index])
  }

  function startEdit(index: number) {
    const s = suggestions[index]
    if (!s) return
    editingIndex = index
    editTitle = s.title
    editDescription = s.description
    editPriority = s.priority
    editStage = s.stage
    editLabels = s.labels.join(', ')
  }

  function saveEdit() {
    if (editingIndex === null) return
    suggestions[editingIndex] = {
      ...suggestions[editingIndex],
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      stage: editStage,
      labels: editLabels.split(',').map((l) => l.trim()).filter(Boolean),
    }
    editingIndex = null
  }

  function cancelEdit() {
    editingIndex = null
  }

  function acceptAll() {
    suggestions.forEach((s, i) => {
      if (!accepted.has(i) && !dismissed.has(i)) {
        acceptSuggestion(i)
      }
    })
  }

  // ── Derived ───────────────────────────────────────────────────
  let visibleSuggestions = $derived(
    suggestions
      .map((s, i) => ({ ...s, index: i }))
      .filter((_, i) => !dismissed.has(i)),
  )

  let pendingCount = $derived(
    suggestions.filter((_, i) => !accepted.has(i) && !dismissed.has(i)).length,
  )

  let scopeLabel = $derived(
    scopes.find((s) => s.slug === selectedScope)?.label ?? selectedScope,
  )
</script>

<div class="suggest-panel">
  <div class="suggest-header">
    <div class="suggest-title">
      <span class="suggest-icon">&#x2728;</span>
      AI Suggestions
    </div>
    <button class="suggest-close" onclick={onclose}>&times;</button>
  </div>

  <!-- Input bar -->
  <div class="suggest-form">
    <div class="form-row">
      {#if showScopeSelector}
        <select class="s-select" bind:value={selectedScope}>
          {#each scopes as s}
            <option value={s.slug}>
              {s.type === 'hub' ? '\u2B21' : s.type === 'project' ? '\u25C8' : '\u25A4'}
              {s.label}
            </option>
          {/each}
        </select>
      {/if}
      <input
        class="s-input focus-input"
        type="text"
        bind:value={focus}
        placeholder="Focus area (optional)... e.g. testing, UX, API"
      />
      <select class="s-select count-select" bind:value={count}>
        <option value={3}>3</option>
        <option value={5}>5</option>
        <option value={8}>8</option>
        <option value={10}>10</option>
      </select>
      <button class="btn-generate" onclick={generate} disabled={loading}>
        {#if loading}
          <span class="spinner"></span>
          Thinking...
        {:else}
          Generate
        {/if}
      </button>
    </div>
  </div>

  <!-- Results -->
  <div class="suggest-body">
    {#if loading}
      <div class="loading-state">
        <div class="loading-pulse"></div>
        <p>Claude is analyzing <strong>{scopeLabel}</strong> and crafting suggestions{focus ? ` focused on "${focus}"` : ''}...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <span class="error-icon">&#x26A0;</span>
        <p>{error}</p>
        <button class="btn-ghost btn-sm" onclick={generate}>Try again</button>
      </div>
    {:else if suggestions.length > 0}
      <!-- Action bar -->
      {#if pendingCount > 0}
        <div class="action-bar">
          <span class="result-count">{suggestions.length} suggestions &middot; {pendingCount} pending</span>
          <div class="action-buttons">
            <button class="btn-ghost btn-sm" onclick={acceptAll}>Accept all ({pendingCount})</button>
          </div>
        </div>
      {:else}
        <div class="action-bar">
          <span class="result-count all-done">All suggestions processed</span>
        </div>
      {/if}

      <!-- Cards -->
      <div class="suggestion-list">
        {#each visibleSuggestions as s (s.index)}
          <div
            class="suggestion-card"
            class:accepted={accepted.has(s.index)}
            class:editing={editingIndex === s.index}
          >
            {#if editingIndex === s.index}
              <!-- Edit mode -->
              <div class="edit-form">
                <input class="edit-title" bind:value={editTitle} placeholder="Title" />
                <textarea class="edit-desc" bind:value={editDescription} rows="3" placeholder="Description"></textarea>
                <div class="edit-row">
                  <select class="s-select" bind:value={editPriority}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select class="s-select" bind:value={editStage}>
                    <option value="idea">Idea</option>
                    <option value="plan">Plan</option>
                    <option value="build">Build</option>
                    <option value="claude">Claude</option>
                  </select>
                  <input class="s-input" bind:value={editLabels} placeholder="Labels (comma-separated)" />
                </div>
                <div class="edit-actions">
                  <button class="btn-ghost btn-sm" onclick={cancelEdit}>Cancel</button>
                  <button class="btn-primary btn-sm" onclick={saveEdit}>Save</button>
                </div>
              </div>
            {:else}
              <!-- Display mode -->
              <div class="card-top">
                <div class="card-meta">
                  <span class="priority-dot" style="background: {priorityColors[s.priority] ?? '#64748b'}"></span>
                  <span class="priority-label">{s.priority}</span>
                  <span class="stage-badge">{stageLabels[s.stage] ?? s.stage}</span>
                  {#each s.labels as label}
                    <span class="label-tag">{label}</span>
                  {/each}
                </div>
                {#if !accepted.has(s.index)}
                  <div class="card-actions">
                    <button class="act-btn edit" onclick={() => startEdit(s.index)} title="Edit before accepting">&#x270E;</button>
                    <button class="act-btn dismiss" onclick={() => dismissSuggestion(s.index)} title="Dismiss">&times;</button>
                  </div>
                {/if}
              </div>
              <h4 class="card-title">{s.title}</h4>
              {#if s.description}
                <p class="card-desc">{s.description}</p>
              {/if}
              {#if s.rationale}
                <p class="card-rationale">{s.rationale}</p>
              {/if}
              <div class="card-bottom">
                {#if accepted.has(s.index)}
                  <span class="accepted-badge">&#x2713; Created</span>
                {:else}
                  <button class="btn-accept" onclick={() => acceptSuggestion(s.index)}>
                    + Accept &amp; Create
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <p>Choose a project and click <strong>Generate</strong> to get AI-powered task suggestions.</p>
        <p class="hint">Optionally set a focus area to narrow the suggestions.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .suggest-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin: 0 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    overflow: hidden;
  }

  .suggest-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .suggest-title {
    font-size: 0.8rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .suggest-icon {
    font-size: 0.9rem;
  }
  .suggest-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    line-height: 1;
  }
  .suggest-close:hover {
    color: var(--text);
    background: rgba(255,255,255,0.06);
  }

  /* ── Form ── */
  .suggest-form {
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .form-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .s-select {
    font-size: 0.75rem;
    padding: 0.35rem 0.5rem;
    background: var(--bg-inset);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .s-input {
    font-size: 0.75rem;
    padding: 0.35rem 0.5rem;
    background: var(--bg-inset);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .focus-input {
    flex: 1;
    min-width: 150px;
  }
  .count-select {
    width: 55px;
  }

  .btn-generate {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.35rem 0.85rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
  }
  .btn-generate:hover:not(:disabled) { background: var(--accent-hover); }
  .btn-generate:disabled { opacity: 0.6; cursor: not-allowed; }

  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Body ── */
  .suggest-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.6rem 0.85rem;
  }
  .suggest-body::-webkit-scrollbar { width: 4px; }
  .suggest-body::-webkit-scrollbar-track { background: transparent; }
  .suggest-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  /* ── States ── */
  .loading-state {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .loading-pulse {
    width: 40px;
    height: 40px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.4;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(0.8); opacity: 0.4; }
    50% { transform: scale(1.1); opacity: 0.7; }
  }

  .error-state {
    text-align: center;
    padding: 1.5rem 1rem;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .error-icon { font-size: 1.5rem; color: #ef4444; }
  .error-state p { margin: 0.5rem 0; }

  .empty-state {
    text-align: center;
    padding: 1.5rem 1rem;
    color: var(--text-muted);
    font-size: 0.8rem;
  }
  .empty-state p { margin: 0.3rem 0; }
  .hint { font-size: 0.72rem; opacity: 0.7; }

  /* ── Action bar ── */
  .action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .result-count {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .all-done { color: var(--success); }

  .btn-sm {
    font-size: 0.68rem;
    padding: 0.2rem 0.5rem;
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-ghost:hover { background: var(--bg-hover); color: var(--text); }
  .btn-primary {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
  }

  /* ── Suggestion cards ── */
  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .suggestion-card {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.65rem 0.75rem;
    transition: all 0.2s;
  }
  .suggestion-card:hover { border-color: rgba(255,255,255,0.12); }
  .suggestion-card.accepted {
    opacity: 0.55;
    border-color: var(--success);
  }
  .suggestion-card.editing {
    border-color: var(--accent);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.3rem;
  }
  .card-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .priority-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .priority-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .stage-badge {
    font-size: 0.6rem;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent);
    padding: 0.08rem 0.35rem;
    border-radius: 3px;
  }
  .label-tag {
    font-size: 0.58rem;
    background: rgba(255,255,255,0.05);
    color: var(--text-muted);
    padding: 0.06rem 0.3rem;
    border-radius: 3px;
  }

  .card-actions {
    display: flex;
    gap: 0.15rem;
    flex-shrink: 0;
  }
  .act-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.1rem 0.25rem;
    border-radius: 3px;
    line-height: 1;
    transition: all 0.15s;
  }
  .act-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
  .act-btn.dismiss:hover { color: #ef4444; }

  .card-title {
    font-size: 0.82rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
    line-height: 1.3;
  }
  .card-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0 0 0.25rem;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .card-rationale {
    font-size: 0.68rem;
    color: var(--accent);
    font-style: italic;
    margin: 0 0 0.35rem;
    line-height: 1.3;
  }

  .card-bottom {
    display: flex;
    justify-content: flex-end;
  }

  .btn-accept {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-accept:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .accepted-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--success);
  }

  /* ── Edit form ── */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .edit-title {
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.3rem 0.5rem;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .edit-desc {
    font-size: 0.72rem;
    padding: 0.3rem 0.5rem;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    resize: vertical;
    font-family: inherit;
  }
  .edit-row {
    display: flex;
    gap: 0.4rem;
  }
  .edit-row .s-input { flex: 1; }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.3rem;
  }
</style>
