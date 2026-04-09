<script lang="ts">
  import type { Phase } from '@apphub/shared'

  interface Props {
    phases: Phase[]
    projectSlug: string
    activePhaseFilter: string | null
    onfilter: (phaseId: string | null) => void
    onupdate: () => void
  }

  let { phases, projectSlug, activePhaseFilter, onfilter, onupdate }: Props = $props()

  // Inline editing state
  let editingId = $state<string | null>(null)
  let editName = $state('')
  let editDate = $state('')
  let addingPhase = $state(false)
  let newPhaseName = $state('')

  function startEdit(phase: Phase) {
    editingId = phase.id
    editName = phase.name
    editDate = phase.target_date ?? ''
  }

  function cancelEdit() {
    editingId = null
    editName = ''
    editDate = ''
  }

  async function saveEdit(phase: Phase) {
    if (!editName.trim()) return
    const updates: Record<string, unknown> = {}
    if (editName.trim() !== phase.name) updates.name = editName.trim()
    const newDate = editDate || null
    if (newDate !== phase.target_date) updates.target_date = newDate

    if (Object.keys(updates).length > 0) {
      await fetch(`/api/projects/${projectSlug}/phases/${phase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      onupdate()
    }
    cancelEdit()
  }

  async function toggleStatus(phase: Phase) {
    const next = phase.status === 'completed' ? 'upcoming'
      : phase.status === 'active' ? 'completed'
      : 'active'
    await fetch(`/api/projects/${projectSlug}/phases/${phase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    onupdate()
  }

  async function movePhase(phase: Phase, direction: -1 | 1) {
    const idx = phases.findIndex(p => p.id === phase.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= phases.length) return

    const moves = [
      { id: phases[idx].id, position: phases[swapIdx].position },
      { id: phases[swapIdx].id, position: phases[idx].position },
    ]
    await fetch(`/api/projects/${projectSlug}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: moves }),
    })
    onupdate()
  }

  async function deletePhase(phase: Phase) {
    await fetch(`/api/projects/${projectSlug}/phases/${phase.id}`, {
      method: 'DELETE',
    })
    if (activePhaseFilter === phase.id) onfilter(null)
    onupdate()
  }

  async function addPhase() {
    if (!newPhaseName.trim()) return
    await fetch(`/api/projects/${projectSlug}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPhaseName.trim() }),
    })
    newPhaseName = ''
    addingPhase = false
    onupdate()
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
</script>

<div class="phase-timeline">
  <div class="timeline-header">
    <span class="timeline-title">Phases</span>
    {#if activePhaseFilter}
      <button class="btn-clear-filter" onclick={() => onfilter(null)}>Clear filter</button>
    {/if}
    <button class="btn-add-phase" onclick={() => { addingPhase = true; requestAnimationFrame(() => { const el = document.querySelector('.new-phase-input') as HTMLInputElement; el?.focus() }) }}>+</button>
  </div>

  {#if phases.length === 0 && !addingPhase}
    <div class="empty-state">
      <p>No phases yet.</p>
      <button class="btn-seed" onclick={() => { addingPhase = true; requestAnimationFrame(() => { const el = document.querySelector('.new-phase-input') as HTMLInputElement; el?.focus() }) }}>Add your first phase</button>
    </div>
  {:else}
    <div class="timeline-track">
      {#each phases as phase, i (phase.id)}
        {@const isActive = phase.status === 'active'}
        {@const isCompleted = phase.status === 'completed'}
        {@const isFiltered = activePhaseFilter === phase.id}

        <div
          class="phase-node"
          class:active={isActive}
          class:completed={isCompleted}
          class:filtered={isFiltered}
        >
          {#if editingId === phase.id}
            <!-- Inline edit mode -->
            <div class="phase-edit">
              <input
                class="phase-name-input"
                bind:value={editName}
                onkeydown={(e) => { if (e.key === 'Enter') saveEdit(phase); if (e.key === 'Escape') cancelEdit() }}
              />
              <input
                type="date"
                class="phase-date-input"
                bind:value={editDate}
              />
              <div class="phase-edit-actions">
                <button class="btn-sm btn-save" onclick={() => saveEdit(phase)}>Save</button>
                <button class="btn-sm btn-cancel" onclick={cancelEdit}>Cancel</button>
              </div>
            </div>
          {:else}
            <!-- Status indicator -->
            <button
              class="phase-status-btn"
              class:active={isActive}
              class:completed={isCompleted}
              title={isCompleted ? 'Mark upcoming' : isActive ? 'Mark completed' : 'Mark active'}
              onclick={() => toggleStatus(phase)}
            >
              {#if isCompleted}
                <span class="check">&#10003;</span>
              {:else if isActive}
                <span class="dot"></span>
              {:else}
                <span class="ring"></span>
              {/if}
            </button>

            <!-- Phase content — click to filter -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="phase-content" onclick={() => onfilter(isFiltered ? null : phase.id)}>
              <span class="phase-name">{phase.name}</span>
              <div class="phase-meta">
                <span class="phase-count">{phase.item_count ?? 0} items</span>
                {#if phase.target_date}
                  <span class="phase-date">{formatDate(phase.target_date)}</span>
                {/if}
              </div>
              <!-- Progress bar -->
              <div class="progress-track">
                <div
                  class="progress-fill"
                  class:complete={phase.completion_pct === 100}
                  style="width: {phase.completion_pct ?? 0}%"
                ></div>
              </div>
            </div>

            <!-- Actions -->
            <div class="phase-actions">
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <button class="btn-icon" title="Edit" onclick={() => startEdit(phase)}>&#9998;</button>
              {#if i > 0}
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button class="btn-icon" title="Move left" onclick={() => movePhase(phase, -1)}>&larr;</button>
              {/if}
              {#if i < phases.length - 1}
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button class="btn-icon" title="Move right" onclick={() => movePhase(phase, 1)}>&rarr;</button>
              {/if}
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <button class="btn-icon btn-icon-danger" title="Delete" onclick={() => deletePhase(phase)}>&#10005;</button>
            </div>
          {/if}

          <!-- Connector line -->
          {#if i < phases.length - 1}
            <div class="connector"></div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Add phase inline form -->
  {#if addingPhase}
    <div class="add-phase-form">
      <input
        class="new-phase-input"
        bind:value={newPhaseName}
        placeholder="Phase name..."
        onkeydown={(e) => { if (e.key === 'Enter') addPhase(); if (e.key === 'Escape') { addingPhase = false; newPhaseName = '' } }}
      />
      <button class="btn-sm btn-save" onclick={addPhase}>Add</button>
      <button class="btn-sm btn-cancel" onclick={() => { addingPhase = false; newPhaseName = '' }}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .phase-timeline {
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.6rem;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .timeline-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .btn-clear-filter {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    background: var(--accent-subtle);
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 9999px;
    cursor: pointer;
  }

  .btn-add-phase {
    margin-left: auto;
    width: 22px;
    height: 22px;
    font-size: 0.85rem;
    line-height: 1;
    background: none;
    border: 1px dashed var(--border);
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s;
  }
  .btn-add-phase:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Track */
  .timeline-track {
    display: flex;
    gap: 0;
    align-items: stretch;
    overflow-x: auto;
  }

  .phase-node {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-card);
    min-width: 140px;
    flex: 1 1 0;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    margin-right: 1.25rem;
  }
  .phase-node:last-child {
    margin-right: 0;
  }
  .phase-node.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-subtle);
  }
  .phase-node.completed {
    border-color: var(--success);
    opacity: 0.8;
  }
  .phase-node.filtered {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }

  /* Connector between phases */
  .connector {
    position: absolute;
    right: -1.25rem;
    top: 50%;
    width: 1.25rem;
    height: 1px;
    background: var(--border);
  }

  /* Status button */
  .phase-status-btn {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .check {
    font-size: 0.75rem;
    color: var(--success);
    font-weight: 700;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
  }
  .ring {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--border);
  }

  /* Content */
  .phase-content {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }
  .phase-name {
    font-size: 0.8rem;
    font-weight: 600;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .phase-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
  }
  .phase-count {
    font-family: var(--font-mono);
  }
  .phase-date {
    opacity: 0.8;
  }

  /* Progress bar */
  .progress-track {
    height: 3px;
    background: var(--border-subtle);
    border-radius: 2px;
    margin-top: 0.3rem;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .progress-fill.complete {
    background: var(--success);
  }

  /* Phase actions */
  .phase-actions {
    display: flex;
    gap: 0.1rem;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .phase-node:hover .phase-actions {
    opacity: 1;
  }
  .btn-icon {
    width: 20px;
    height: 20px;
    font-size: 0.65rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .btn-icon:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .btn-icon-danger:hover {
    color: var(--danger);
  }

  /* Inline edit */
  .phase-edit {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
  }
  .phase-name-input,
  .phase-date-input {
    font-size: 0.75rem;
    padding: 0.25rem 0.4rem;
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-family: inherit;
  }
  .phase-name-input:focus,
  .phase-date-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .phase-date-input {
    width: 130px;
  }
  .phase-edit-actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-sm {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
  }
  .btn-save {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .btn-cancel:hover {
    background: var(--bg-hover);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 0.75rem;
    color: var(--text-muted);
    font-size: 0.75rem;
  }
  .empty-state p {
    margin: 0 0 0.4rem;
  }
  .btn-seed {
    font-size: 0.7rem;
    padding: 0.3rem 0.6rem;
    background: none;
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    color: var(--accent);
    cursor: pointer;
  }
  .btn-seed:hover {
    border-color: var(--accent);
  }

  /* Add phase form */
  .add-phase-form {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    margin-top: 0.5rem;
  }
  .new-phase-input {
    flex: 1;
    font-size: 0.75rem;
    padding: 0.3rem 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-family: inherit;
  }
  .new-phase-input:focus {
    outline: none;
    border-color: var(--accent);
  }
</style>
