<script lang="ts">
  import { onMount } from 'svelte'
  import { invalidateAll } from '$app/navigation'
  import type { ItemStage } from '@apphub/shared'
  import { ITEM_STAGES, ITEM_STAGE_LABELS } from '@apphub/shared'
  import type { ProjectItem } from './+page.server'

  let { data } = $props()
  let project = $derived(data.project)
  let allProjects = $derived(data.allProjects)

  // Derive counts from our owned $state(stages) so they update reactively
  let stageCounts = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const stage of ITEM_STAGES) {
      counts[stage] = (stages[stage] ?? []).length
    }
    return counts
  })
  let totalItems = $derived(Object.values(stageCounts).reduce((a, b) => a + b, 0))

  // Board state — owned locally, initialized from server data.
  // Using $state instead of $derived(data.stages) so SSE and optimistic
  // updates can write to it and trigger reactivity correctly.
  let stages = $state<Record<ItemStage, ProjectItem[]>>(JSON.parse(JSON.stringify(data.stages)))

  function mutateStages(
    fn: (current: Record<ItemStage, ProjectItem[]>) => Record<ItemStage, ProjectItem[]>,
  ) {
    stages = fn(JSON.parse(JSON.stringify(stages)))
  }

  // Stage colors/icons
  const stageConfig: Record<ItemStage, { icon: string; color: string }> = {
    idea: { icon: '💡', color: 'var(--purple)' },
    plan: { icon: '📋', color: 'var(--info)' },
    build: { icon: '🔨', color: 'var(--warning)' },
    claude: { icon: '✦', color: 'var(--accent)' },
    review: { icon: '🔍', color: 'var(--accent)' },
    done: { icon: '✅', color: 'var(--success)' },
  }

  // Drag state
  let draggedItem = $state<ProjectItem | null>(null)
  let dragSourceStage = $state<ItemStage | null>(null)
  let dragOverStage = $state<ItemStage | null>(null)

  // Quick-add state per stage
  let quickAddStage = $state<ItemStage | null>(null)
  let quickAddTitle = $state('')
  let quickAddType = $state('task')

  // Detail drawer
  let selectedItem = $state<ProjectItem | null>(null)
  let editTitle = $state('')
  let editDescription = $state('')
  let editPriority = $state('medium')
  let editLabels = $state('')
  let editType = $state('task')
  let saving = $state(false)

  // Confirm delete
  let confirmDeleteId = $state('')

  // New item modal
  let showNewItem = $state(false)
  let newTitle = $state('')
  let newDescription = $state('')
  let newPriority = $state('medium')
  let newStage = $state<ItemStage>('idea')
  let newType = $state('task')
  let newLabels = $state('')

  // SSE for real-time updates
  let eventSource: EventSource | null = null

  onMount(() => {
    connectSSE()
    return () => {
      eventSource?.close()
    }
  })

  function connectSSE() {
    if (eventSource) eventSource.close()
    eventSource = new EventSource('/api/board/events')
    eventSource.addEventListener('board', () => {
      refreshItems()
    })
    eventSource.onerror = () => {
      eventSource?.close()
      setTimeout(connectSSE, 3000)
    }
  }

  async function refreshItems() {
    const res = await fetch(`/api/projects/${project.slug}/items`)
    if (res.ok) {
      const { data: itemData } = await res.json()
      stages = itemData
      // stageCounts and totalItems auto-update via $derived
    }
  }

  // --- Drag and drop ---
  function onDragStart(e: DragEvent, item: ProjectItem, stage: ItemStage) {
    draggedItem = item
    dragSourceStage = stage
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', item.id)
    }
  }

  function onDragOver(e: DragEvent, stage: ItemStage) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dragOverStage = stage
  }

  function onDragLeave(stage: ItemStage) {
    if (dragOverStage === stage) dragOverStage = null
  }

  async function onDrop(e: DragEvent, targetStage: ItemStage) {
    e.preventDefault()
    dragOverStage = null
    if (!draggedItem || !dragSourceStage) return
    if (dragSourceStage === targetStage) {
      draggedItem = null
      dragSourceStage = null
      return
    }

    const item = draggedItem
    const fromStage = dragSourceStage
    draggedItem = null
    dragSourceStage = null

    // Optimistic update
    mutateStages((s) => {
      s[fromStage] = s[fromStage].filter((i) => i.id !== item.id)
      item.stage = targetStage
      item.position = s[targetStage].length
      s[targetStage].push(item)
      return s
    })

    // Server sync
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage, position: stages[targetStage].length - 1 }),
    })

    if (!res.ok) {
      // Revert on failure
      await refreshItems()
    }
  }

  function onDragEnd() {
    draggedItem = null
    dragSourceStage = null
    dragOverStage = null
  }

  // --- Quick add ---
  function startQuickAdd(stage: ItemStage) {
    quickAddStage = stage
    quickAddTitle = ''
    quickAddType = 'task'
    // Focus input after render
    requestAnimationFrame(() => {
      const el = document.querySelector('.quick-add-input') as HTMLInputElement
      el?.focus()
    })
  }

  async function submitQuickAdd() {
    if (!quickAddTitle.trim() || !quickAddStage) return
    const stage = quickAddStage
    const title = quickAddTitle.trim()
    const type = quickAddType
    quickAddStage = null
    quickAddTitle = ''

    await fetch(`/api/projects/${project.slug}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, stage, item_type: type }),
    })
    await refreshItems()
  }

  function cancelQuickAdd() {
    quickAddStage = null
    quickAddTitle = ''
  }

  // --- New item (full form) ---
  async function createItem() {
    if (!newTitle.trim()) return
    await fetch(`/api/projects/${project.slug}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDescription.trim(),
        stage: newStage,
        priority: newPriority,
        item_type: newType,
        labels: newLabels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    })
    showNewItem = false
    newTitle = ''
    newDescription = ''
    newPriority = 'medium'
    newStage = 'idea'
    newType = 'task'
    newLabels = ''
    await refreshItems()
  }

  // --- Detail drawer ---
  function openItem(item: ProjectItem) {
    selectedItem = item
    editTitle = item.title
    editDescription = item.description
    editPriority = item.priority
    editType = item.item_type
    editLabels = item.labels.join(', ')
  }

  function closeDrawer() {
    selectedItem = null
    confirmDeleteId = ''
  }

  async function saveItem() {
    if (!selectedItem) return
    saving = true
    await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        item_type: editType,
        labels: editLabels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      }),
    })
    saving = false
    await refreshItems()
    // Update selected item reference
    for (const stage of ITEM_STAGES) {
      const found = stages[stage]?.find((i) => i.id === selectedItem!.id)
      if (found) {
        selectedItem = found
        break
      }
    }
  }

  async function moveItemToStage(stage: ItemStage) {
    if (!selectedItem) return
    await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    await refreshItems()
    selectedItem = { ...selectedItem, stage }
  }

  async function deleteItem() {
    if (!selectedItem) return
    await fetch(`/api/items/${selectedItem.id}`, { method: 'DELETE' })
    closeDrawer()
    await refreshItems()
  }

  // --- Project status ---
  async function updateProjectStatus(status: string) {
    await fetch(`/api/projects/${project.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await invalidateAll()
  }

  // --- Helpers ---
  const priorityDot: Record<string, string> = {
    critical: 'var(--danger)',
    high: 'var(--warning)',
    medium: 'var(--text-muted)',
    low: 'var(--border)',
  }

  const typeIcon: Record<string, string> = {
    task: '◻',
    idea: '💡',
    bug: '🐛',
    plan: '📋',
    note: '📝',
  }

  function isLocked(item: ProjectItem): boolean {
    return item.assigned_to === 'claude-runner'
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }
</script>

<div class="project-flow" class:drawer-open={selectedItem !== null}>
  <!-- Header -->
  <header class="flow-header">
    <div class="header-left">
      <a href="/" class="back-link">← Projects</a>
      <div class="project-title-row">
        {#if project.icon}
          <span class="project-icon" style="color: {project.color || 'var(--accent)'}"
            >{project.icon}</span
          >
        {/if}
        <h1>{project.name}</h1>
        <span
          class="badge badge-{project.status}"
          style="border-color: {project.color || 'var(--accent)'}">{project.status}</span
        >
      </div>
      {#if project.description}
        <p class="project-desc">{project.description}</p>
      {/if}
    </div>
    <div class="header-right">
      <div class="stage-summary">
        {#each ITEM_STAGES as stage}
          <span class="stage-pill" title={ITEM_STAGE_LABELS[stage]}>
            <span class="pill-icon">{stageConfig[stage].icon}</span>
            <span class="pill-count">{stageCounts[stage] ?? 0}</span>
          </span>
        {/each}
        <span class="total-count">{totalItems} items</span>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick={() => (showNewItem = true)}>+ New Item</button>
        <div class="status-switcher">
          {#each ['idea', 'active', 'paused', 'completed', 'archived'] as status}
            <button
              class="btn-ghost status-btn"
              class:active={project.status === status}
              onclick={() => updateProjectStatus(status)}
              title="Set project status to {status}"
            >
              {status}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </header>

  <!-- Flow Pipeline -->
  <div class="pipeline">
    {#each ITEM_STAGES as stage}
      {@const stageItems = stages[stage] ?? []}
      {@const config = stageConfig[stage]}
      <div
        class="stage-column"
        class:drag-over={dragOverStage === stage}
        class:is-done={stage === 'done'}
        role="list"
        ondragover={(e) => onDragOver(e, stage)}
        ondragleave={() => onDragLeave(stage)}
        ondrop={(e) => onDrop(e, stage)}
      >
        <div class="stage-header">
          <span class="stage-label">
            <span class="stage-icon">{config.icon}</span>
            {ITEM_STAGE_LABELS[stage]}
          </span>
          <span class="stage-count">{stageItems.length}</span>
        </div>

        <div class="stage-items">
          {#each stageItems as item (item.id)}
            <div
              class="item-card"
              class:locked={isLocked(item)}
              class:selected={selectedItem?.id === item.id}
              draggable={!isLocked(item)}
              role="listitem"
              ondragstart={(e) => onDragStart(e, item, stage)}
              ondragend={onDragEnd}
              onclick={() => openItem(item)}
              onkeydown={(e) => e.key === 'Enter' && openItem(item)}
              tabindex="0"
            >
              <div class="card-top">
                <span
                  class="priority-dot"
                  style="background: {priorityDot[item.priority]}"
                  title={item.priority}
                ></span>
                <span class="card-title">{item.title}</span>
              </div>
              {#if item.description}
                <p class="card-desc">
                  {item.description.length > 100
                    ? item.description.slice(0, 100) + '…'
                    : item.description}
                </p>
              {/if}
              <div class="card-footer">
                <span class="card-type" title={item.item_type}>{typeIcon[item.item_type] ?? '◻'}</span>
                {#if item.labels.length > 0}
                  <span class="card-labels">{item.labels.join(', ')}</span>
                {/if}
                {#if item.child_count > 0}
                  <span class="card-children" title="{item.child_count} sub-items"
                    >⊟ {item.child_count}</span
                  >
                {/if}
                {#if item.attachment_count > 0}
                  <span class="card-attachments" title="{item.attachment_count} attachments"
                    >📎 {item.attachment_count}</span
                  >
                {/if}
                {#if isLocked(item)}
                  <span class="card-locked" title="Claude is working on this">🔒</span>
                {/if}
              </div>
            </div>
          {/each}

          <!-- Quick add -->
          {#if quickAddStage === stage}
            <div class="quick-add-form">
              <input
                class="quick-add-input"
                bind:value={quickAddTitle}
                placeholder="Item title..."
                onkeydown={(e) => {
                  if (e.key === 'Enter') submitQuickAdd()
                  if (e.key === 'Escape') cancelQuickAdd()
                }}
              />
              <div class="quick-add-actions">
                <select bind:value={quickAddType} class="quick-add-type">
                  <option value="task">Task</option>
                  <option value="idea">Idea</option>
                  <option value="bug">Bug</option>
                  <option value="plan">Plan</option>
                  <option value="note">Note</option>
                </select>
                <button class="btn-primary btn-sm" onclick={submitQuickAdd}>Add</button>
                <button class="btn-ghost btn-sm" onclick={cancelQuickAdd}>✕</button>
              </div>
            </div>
          {:else}
            <button class="add-item-btn" onclick={() => startQuickAdd(stage)}>+ Add</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Detail Drawer -->
  {#if selectedItem}
    <div class="drawer-backdrop" onclick={closeDrawer} role="presentation"></div>
    <aside class="detail-drawer">
      <div class="drawer-header">
        <div class="drawer-title-row">
          <span class="drawer-type">{typeIcon[selectedItem.item_type] ?? '◻'}</span>
          <span class="drawer-id">{selectedItem.id}</span>
          {#if isLocked(selectedItem)}
            <span class="badge badge-locked">🔒 Claude working</span>
          {/if}
        </div>
        <button class="btn-ghost btn-close" onclick={closeDrawer}>✕</button>
      </div>

      <div class="drawer-body">
        <!-- Stage flow indicator -->
        <div class="stage-flow">
          {#each ITEM_STAGES as stage}
            <button
              class="flow-step"
              class:active={selectedItem.stage === stage}
              class:past={ITEM_STAGES.indexOf(stage) < ITEM_STAGES.indexOf(selectedItem.stage)}
              disabled={isLocked(selectedItem)}
              onclick={() => moveItemToStage(stage)}
              title="Move to {ITEM_STAGE_LABELS[stage]}"
            >
              <span class="flow-icon">{stageConfig[stage].icon}</span>
              <span class="flow-label">{ITEM_STAGE_LABELS[stage]}</span>
            </button>
            {#if stage !== 'done'}
              <span class="flow-arrow">→</span>
            {/if}
          {/each}
        </div>

        <!-- Title -->
        <label class="field-label">Title</label>
        <input
          class="field-input"
          bind:value={editTitle}
          disabled={isLocked(selectedItem)}
          onblur={saveItem}
        />

        <!-- Description -->
        <label class="field-label">Description</label>
        <textarea
          class="field-textarea"
          bind:value={editDescription}
          disabled={isLocked(selectedItem)}
          rows="4"
          placeholder="Add a description..."
          onblur={saveItem}
        ></textarea>

        <!-- Fields row -->
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Priority</label>
            <select
              class="field-select"
              bind:value={editPriority}
              disabled={isLocked(selectedItem)}
              onchange={saveItem}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Type</label>
            <select
              class="field-select"
              bind:value={editType}
              disabled={isLocked(selectedItem)}
              onchange={saveItem}
            >
              <option value="task">Task</option>
              <option value="idea">Idea</option>
              <option value="bug">Bug</option>
              <option value="plan">Plan</option>
              <option value="note">Note</option>
            </select>
          </div>
        </div>

        <!-- Labels -->
        <label class="field-label">Labels</label>
        <input
          class="field-input"
          bind:value={editLabels}
          disabled={isLocked(selectedItem)}
          placeholder="comma-separated labels"
          onblur={saveItem}
        />

        <!-- Meta info -->
        <div class="drawer-meta">
          <span>Created {formatDate(selectedItem.created)}</span>
          <span>Updated {formatDate(selectedItem.updated)}</span>
        </div>

        <!-- Actions -->
        <div class="drawer-actions">
          {#if confirmDeleteId === selectedItem.id}
            <span class="delete-confirm">
              Delete this item?
              <button class="btn-ghost btn-sm btn-danger" onclick={deleteItem}>Yes, delete</button>
              <button class="btn-ghost btn-sm" onclick={() => (confirmDeleteId = '')}>Cancel</button
              >
            </span>
          {:else}
            <button
              class="btn-ghost btn-sm btn-danger"
              onclick={() => (confirmDeleteId = selectedItem!.id)}>Delete</button
            >
          {/if}
        </div>
      </div>
    </aside>
  {/if}

  <!-- New Item Modal -->
  {#if showNewItem}
    <div class="modal-backdrop" onclick={() => (showNewItem = false)} role="presentation"></div>
    <div class="modal">
      <div class="modal-header">
        <h2>New Item</h2>
        <button class="btn-ghost btn-close" onclick={() => (showNewItem = false)}>✕</button>
      </div>
      <div class="modal-body">
        <label class="field-label">Title</label>
        <input
          class="field-input"
          bind:value={newTitle}
          placeholder="What needs to happen?"
          onkeydown={(e) => e.key === 'Enter' && createItem()}
        />

        <label class="field-label">Description</label>
        <textarea
          class="field-textarea"
          bind:value={newDescription}
          rows="3"
          placeholder="Add details..."
        ></textarea>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Stage</label>
            <select class="field-select" bind:value={newStage}>
              {#each ITEM_STAGES as stage}
                <option value={stage}>{stageConfig[stage].icon} {ITEM_STAGE_LABELS[stage]}</option>
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Priority</label>
            <select class="field-select" bind:value={newPriority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Type</label>
            <select class="field-select" bind:value={newType}>
              <option value="task">Task</option>
              <option value="idea">Idea</option>
              <option value="bug">Bug</option>
              <option value="plan">Plan</option>
              <option value="note">Note</option>
            </select>
          </div>
        </div>

        <label class="field-label">Labels</label>
        <input class="field-input" bind:value={newLabels} placeholder="feature, frontend, ..." />
      </div>
      <div class="modal-footer">
        <button class="btn-ghost" onclick={() => (showNewItem = false)}>Cancel</button>
        <button class="btn-primary" onclick={createItem}>Create Item</button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Layout */
  .project-flow {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 2rem);
    padding: 1rem;
    transition: margin-right 0.3s ease;
  }
  .project-flow.drawer-open {
    margin-right: 460px;
  }

  /* Header */
  .flow-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .back-link {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-decoration: none;
    margin-bottom: 0.25rem;
    display: inline-block;
  }
  .back-link:hover {
    color: var(--text);
  }
  .project-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .project-icon {
    font-size: 1.5rem;
  }
  h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }
  .project-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .stage-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .stage-pill {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.75rem;
  }
  .pill-icon {
    font-size: 0.7rem;
  }
  .pill-count {
    font-family: var(--font-mono);
    color: var(--text-muted);
  }
  .total-count {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-left: 0.25rem;
    padding-left: 0.5rem;
    border-left: 1px solid var(--border);
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .status-switcher {
    display: flex;
    gap: 0.15rem;
  }
  .status-btn {
    font-size: 0.65rem;
    padding: 0.2rem 0.45rem;
    text-transform: capitalize;
  }
  .status-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  /* Pipeline */
  .pipeline {
    display: flex;
    gap: 0.6rem;
    flex: 1;
    min-height: 0;
    overflow-x: auto;
  }

  .stage-column {
    flex: 1 1 0;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .stage-column.drag-over {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent-subtle);
  }
  .stage-column.is-done {
    opacity: 0.8;
  }

  .stage-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }
  .stage-label {
    font-size: 0.8rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .stage-icon {
    font-size: 0.85rem;
  }
  .stage-count {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background: var(--bg-card);
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
  }

  .stage-items {
    flex: 1;
    overflow-y: auto;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  /* Item card */
  .item-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 0.55rem 0.65rem;
    cursor: pointer;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
  }
  .item-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }
  .item-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-subtle);
  }
  .item-card.locked {
    border-left: 3px solid var(--accent);
    background: var(--accent-subtle);
    cursor: default;
  }
  .item-card[draggable='true'] {
    cursor: grab;
  }
  .item-card[draggable='true']:active {
    cursor: grabbing;
  }

  .card-top {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
  }
  .priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 0.35rem;
  }
  .card-title {
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.35;
    word-break: break-word;
  }
  .card-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin: 0.25rem 0 0 0.65rem;
    line-height: 1.35;
  }
  .card-footer {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.35rem;
    font-size: 0.65rem;
    color: var(--text-muted);
  }
  .card-type {
    font-size: 0.7rem;
  }
  .card-labels {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 120px;
  }
  .card-locked {
    margin-left: auto;
  }

  /* Quick add */
  .quick-add-form {
    padding: 0.35rem;
  }
  .quick-add-input {
    width: 100%;
    font-size: 0.8rem;
    padding: 0.4rem 0.5rem;
    margin-bottom: 0.3rem;
  }
  .quick-add-actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  .quick-add-type {
    font-size: 0.7rem;
    padding: 0.2rem 0.3rem;
    flex: 1;
  }

  .add-item-btn {
    background: none;
    border: 1px dashed var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s;
    text-align: center;
  }
  .add-item-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-sm {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }
  .btn-danger {
    color: var(--danger) !important;
  }
  .btn-danger:hover {
    background: var(--danger-subtle) !important;
  }
  .btn-close {
    font-size: 1rem;
    padding: 0.2rem 0.4rem;
    line-height: 1;
  }

  /* Detail Drawer */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
  }
  .detail-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 460px;
    height: 100vh;
    background: var(--bg);
    border-left: 1px solid var(--border);
    z-index: 50;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.25s ease;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
  }
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0.5;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .drawer-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .drawer-type {
    font-size: 1.1rem;
  }
  .drawer-id {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .badge-locked {
    background: var(--accent-subtle);
    color: var(--accent);
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 9999px;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Stage flow indicator */
  .stage-flow {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0;
    margin-bottom: 0.25rem;
  }
  .flow-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    background: var(--bg-inset);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 0.3rem 0.45rem;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    flex: 1;
  }
  .flow-step:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--bg-hover);
  }
  .flow-step.active {
    background: var(--accent-subtle);
    border-color: var(--accent);
  }
  .flow-step.past {
    opacity: 0.5;
  }
  .flow-step:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
  .flow-icon {
    font-size: 0.85rem;
  }
  .flow-label {
    font-size: 0.55rem;
    font-weight: 500;
    color: var(--text-muted);
  }
  .flow-arrow {
    color: var(--text-muted);
    font-size: 0.7rem;
    flex-shrink: 0;
  }

  /* Form fields */
  .field-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .field-input {
    width: 100%;
    font-size: 0.85rem;
    padding: 0.45rem 0.6rem;
  }
  .field-textarea {
    width: 100%;
    font-size: 0.85rem;
    padding: 0.45rem 0.6rem;
    resize: vertical;
    min-height: 80px;
  }
  .field-select {
    font-size: 0.85rem;
    padding: 0.4rem 0.5rem;
    width: 100%;
  }
  .field-row {
    display: flex;
    gap: 0.75rem;
  }
  .field-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .drawer-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.7rem;
    color: var(--text-muted);
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }
  .drawer-actions {
    padding-top: 0.5rem;
  }
  .delete-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--danger);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    z-index: 99;
  }
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 520px;
    max-width: 95vw;
    max-height: 85vh;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h2 {
    font-size: 1rem;
    font-weight: 600;
  }
  .modal-body {
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
  }

  /* Badge overrides for project status */
  .badge-idea {
    background: var(--purple-subtle, rgba(139, 92, 246, 0.1));
    color: var(--purple, #8b5cf6);
  }
  .badge-active {
    background: var(--success-subtle, rgba(34, 197, 94, 0.1));
    color: var(--success, #22c55e);
  }
  .badge-paused {
    background: var(--warning-subtle, rgba(245, 158, 11, 0.1));
    color: var(--warning, #f59e0b);
  }
  .badge-completed {
    background: var(--info-subtle, rgba(59, 130, 246, 0.1));
    color: var(--info, #3b82f6);
  }
  .badge-archived {
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  /* Scrollbar styling */
  .stage-items::-webkit-scrollbar {
    width: 4px;
  }
  .stage-items::-webkit-scrollbar-track {
    background: transparent;
  }
  .stage-items::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }
</style>
