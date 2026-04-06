<script lang="ts">
  import { onMount } from 'svelte'
  import type { BoardIssue, BoardLane, IssueAttachment, ClaudeNote } from '@apphub/shared'

  let { data } = $props()

  const laneOrder: BoardLane[] = ['backlog', 'todo', 'in_progress', 'claude', 'review', 'done']
  const laneLabels: Record<BoardLane, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'In Progress',
    claude: 'Claude',
    review: 'Review',
    done: 'Done',
  }

  // Mutable board state — derived from server data, locally mutated for optimistic updates
  let serverLanes = $derived(data.lanes)
  let localOverrides = $state<Record<BoardLane, BoardIssue[]> | null>(null)
  let lanes = $derived(localOverrides ?? serverLanes)

  function mutateLanes(
    fn: (current: Record<BoardLane, BoardIssue[]>) => Record<BoardLane, BoardIssue[]>,
  ) {
    localOverrides = fn(structuredClone(lanes))
  }

  function resetOverrides() {
    localOverrides = null
  }

  // Drag state
  let draggedIssue = $state<BoardIssue | null>(null)
  let dragSourceLane = $state<BoardLane | null>(null)
  let dragOverLane = $state<BoardLane | null>(null)

  // Project scopes from server
  let scopes = $derived(data.scopes)

  // New issue form
  let showNewIssue = $state(false)
  let newTitle = $state('')
  let newDescription = $state('')
  let newPriority = $state('medium')
  let newLane = $state<BoardLane>('backlog')
  let newLabels = $state('')
  let newScope = $state('hub')

  // Edit modal
  let editingIssue = $state<BoardIssue | null>(null)
  let editTitle = $state('')
  let editDescription = $state('')
  let editPriority = $state('medium')
  let editLabels = $state('')
  let editScope = $state('hub')

  // Attachments in edit modal
  let editAttachments = $state<IssueAttachment[]>([])
  let uploadingFile = $state(false)

  // Claude notes in edit modal
  let editNotes = $state<ClaudeNote[]>([])

  // Confirm delete
  let confirmDeleteId = $state('')

  // Claude runner status — polled from server
  let runnerStatus = $state<{
    state: 'idle' | 'running' | 'error'
    issueId?: string
    issueTitle?: string
    startedAt?: string
    error?: string
    output?: string
  }>({ state: 'idle' })
  let runnerPolling = $state(false)

  // Combined Claude status — merges board state + runner process state
  let claudeStatus = $derived.by(() => {
    if (runnerStatus.state === 'running') {
      return {
        state: 'working' as const,
        label: 'Working',
        detail: runnerStatus.issueTitle ?? 'Processing...',
        count: 1,
      }
    }
    if (runnerStatus.state === 'error') {
      return {
        state: 'error' as const,
        label: 'Error',
        detail: runnerStatus.error ?? 'Unknown error',
        count: 0,
      }
    }

    const pendingIssues = lanes.claude.filter((i) => !i.assigned_to)
    if (pendingIssues.length > 0) {
      return {
        state: 'pending' as const,
        label: 'Pending',
        detail: `${pendingIssues.length} issue${pendingIssues.length > 1 ? 's' : ''} queued`,
        count: pendingIssues.length,
      }
    }
    return {
      state: 'idle' as const,
      label: 'Idle',
      detail: 'No tasks assigned',
      count: 0,
    }
  })

  // Output sidebar state
  interface OutputLine {
    ts: number
    ch: 'stdout' | 'stderr' | 'system'
    text: string
  }
  let showOutput = $state(false)
  let outputLines = $state<OutputLine[]>([])
  let outputSeq = $state(0)
  let outputEl: HTMLElement | undefined = $state()
  let autoScroll = $state(true)

  function scrollToBottom() {
    if (outputEl && autoScroll) {
      requestAnimationFrame(() => {
        outputEl!.scrollTop = outputEl!.scrollHeight
      })
    }
  }

  // Poll runner status + output while running
  async function pollRunnerStatus() {
    if (runnerPolling) return
    runnerPolling = true
    try {
      while (true) {
        const res = await fetch(`/api/board/claude/output?since=${outputSeq}`)
        if (res.ok) {
          const { data: d } = await res.json()
          runnerStatus = {
            state: d.state,
            issueId: d.issueId,
            issueTitle: d.issueTitle,
            startedAt: d.startedAt,
            error: d.error,
          }
          if (d.lines.length > 0) {
            outputLines = [...outputLines, ...d.lines]
            outputSeq = d.seq
            scrollToBottom()
          }
          if (d.state !== 'running') break
        } else {
          break
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    } finally {
      runnerPolling = false
      invalidateBoard()
    }
  }

  async function invalidateBoard() {
    const res = await fetch('/api/board')
    if (res.ok) {
      const { data: boardData } = await res.json()
      localOverrides = null
      data.lanes = boardData
    }
  }

  async function runClaude() {
    outputLines = []
    outputSeq = 0
    showOutput = true
    const res = await fetch('/api/board/claude/run', { method: 'POST' })
    if (res.ok) {
      const { data: d } = await res.json()
      runnerStatus = d
      if (d.state === 'running') {
        pollRunnerStatus()
      }
    }
  }

  function toggleOutput() {
    showOutput = !showOutput
    if (showOutput) scrollToBottom()
  }

  // Check initial runner status on mount and load existing output
  onMount(() => {
    fetch('/api/board/claude/output?since=0')
      .then((r) => r.json())
      .then(({ data: d }) => {
        runnerStatus = {
          state: d.state,
          issueId: d.issueId,
          issueTitle: d.issueTitle,
          startedAt: d.startedAt,
          error: d.error,
        }
        if (d.lines.length > 0) {
          outputLines = d.lines
          outputSeq = d.seq
        }
        if (d.state === 'running') {
          showOutput = true
          pollRunnerStatus()
        }
      })
      .catch(() => {})
  })

  async function createIssue() {
    if (!newTitle.trim()) return

    const res = await fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        lane: newLane,
        labels: newLabels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        project_scope: newScope,
      }),
    })

    if (res.ok) {
      const { data: issue } = await res.json()
      mutateLanes((l) => {
        l[issue.lane as BoardLane] = [...l[issue.lane as BoardLane], issue]
        return l
      })
      newTitle = ''
      newDescription = ''
      newPriority = 'medium'
      newLabels = ''
      showNewIssue = false
    }
  }

  function openEdit(issue: BoardIssue) {
    editingIssue = issue
    editTitle = issue.title
    editDescription = issue.description
    editPriority = issue.priority
    editLabels = issue.labels.join(', ')
    editScope = issue.project_scope || 'hub'
    editAttachments = []
    editNotes = []
    // Load attachments and notes in parallel
    fetch(`/api/board/${issue.id}/attachments`)
      .then((r) => r.json())
      .then(({ data }) => {
        editAttachments = data ?? []
      })
      .catch(() => {})
    fetch(`/api/board/${issue.id}/notes`)
      .then((r) => r.json())
      .then(({ data }) => {
        editNotes = data ?? []
      })
      .catch(() => {})
  }

  async function saveEdit() {
    if (!editingIssue || !editTitle.trim()) return

    const res = await fetch(`/api/board/${editingIssue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        labels: editLabels
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        project_scope: editScope,
      }),
    })

    if (res.ok) {
      const { data: updated } = await res.json()
      const lane = updated.lane as BoardLane
      mutateLanes((l) => {
        l[lane] = l[lane].map((i) => (i.id === updated.id ? updated : i))
        return l
      })
      editingIssue = null
    }
  }

  async function uploadAttachment(e: Event) {
    if (!editingIssue) return
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    uploadingFile = true
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`/api/board/${editingIssue.id}/attachments`, {
      method: 'POST',
      body: form,
    })

    if (res.ok) {
      const { data: att } = await res.json()
      editAttachments = [...editAttachments, att]
      // Update attachment count on card
      mutateLanes((l) => {
        const lane = editingIssue!.lane
        l[lane] = l[lane].map((i) =>
          i.id === editingIssue!.id
            ? ({ ...i, attachment_count: editAttachments.length } as any)
            : i,
        )
        return l
      })
    }
    uploadingFile = false
    input.value = ''
  }

  async function deleteAttachment(attId: string) {
    if (!editingIssue) return
    const res = await fetch(`/api/board/${editingIssue.id}/attachments/${attId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      editAttachments = editAttachments.filter((a) => a.id !== attId)
      mutateLanes((l) => {
        const lane = editingIssue!.lane
        l[lane] = l[lane].map((i) =>
          i.id === editingIssue!.id
            ? ({ ...i, attachment_count: editAttachments.length } as any)
            : i,
        )
        return l
      })
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function deleteIssue(id: string, lane: BoardLane) {
    const res = await fetch(`/api/board/${id}`, { method: 'DELETE' })
    if (res.ok) {
      mutateLanes((l) => {
        l[lane] = l[lane].filter((i) => i.id !== id)
        return l
      })
      confirmDeleteId = ''
    }
  }

  // --- Drag and Drop ---

  function onDragStart(e: DragEvent, issue: BoardIssue, lane: BoardLane) {
    draggedIssue = issue
    dragSourceLane = lane
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', issue.id)
  }

  function onDragEnd() {
    draggedIssue = null
    dragSourceLane = null
    dragOverLane = null
  }

  function onDragOver(e: DragEvent, lane: BoardLane) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dragOverLane = lane
  }

  function onDragLeave(e: DragEvent, lane: BoardLane) {
    // Only clear if leaving the lane container itself
    const related = e.relatedTarget as HTMLElement
    const current = e.currentTarget as HTMLElement
    if (!current.contains(related)) {
      if (dragOverLane === lane) dragOverLane = null
    }
  }

  async function onDrop(e: DragEvent, targetLane: BoardLane) {
    e.preventDefault()
    dragOverLane = null

    if (!draggedIssue || !dragSourceLane) return
    if (dragSourceLane === targetLane) return

    const issue = draggedIssue
    const sourceLane = dragSourceLane

    // Optimistic update
    mutateLanes((l) => {
      l[sourceLane] = l[sourceLane].filter((i) => i.id !== issue.id)
      const movedIssue = { ...issue, lane: targetLane, position: l[targetLane].length }
      l[targetLane] = [...l[targetLane], movedIssue]
      return l
    })

    // Build moves array from current state
    const currentLanes = lanes
    const moves = [
      ...currentLanes[sourceLane].map((item, idx) => ({
        id: item.id,
        lane: sourceLane,
        position: idx,
      })),
      ...currentLanes[targetLane].map((item, idx) => ({
        id: item.id,
        lane: targetLane,
        position: idx,
      })),
    ]

    draggedIssue = null
    dragSourceLane = null

    const res = await fetch('/api/board/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moves }),
    })

    if (!res.ok) {
      // Revert on failure
      resetOverrides()
    }
  }

  function priorityClass(p: string) {
    return `priority-${p}`
  }
</script>

<div class="board-page" class:sidebar-open={showOutput}>
  <header class="page-header">
    <div>
      <h1>Board</h1>
      <p class="subtitle">Hub tasks and issues</p>
    </div>
    <div class="header-right">
      <div class="claude-controls">
        <button
          class="claude-status status-{claudeStatus.state}"
          onclick={toggleOutput}
          title="Toggle Claude output panel"
        >
          <span class="status-dot"></span>
          <div class="status-info">
            <span class="status-label">Claude: {claudeStatus.label}</span>
            <span class="status-detail">{claudeStatus.detail}</span>
          </div>
        </button>
        {#if claudeStatus.state === 'pending' || claudeStatus.state === 'error'}
          <button class="btn-claude" onclick={runClaude} title="Run Claude on queued issues">
            &#x25B6; Run
          </button>
        {:else if claudeStatus.state === 'working'}
          <button class="claude-running-badge" onclick={toggleOutput} title="View output">
            Running...
          </button>
        {/if}
      </div>
      <button class="btn-primary" onclick={() => (showNewIssue = !showNewIssue)}>
        + New Issue
      </button>
    </div>
  </header>

  {#if showNewIssue}
    <div class="new-issue-form">
      <div class="form-row">
        <input bind:value={newTitle} placeholder="Issue title..." class="title-input" />
        <select bind:value={newScope} class="scope-select">
          {#each scopes as s}
            <option value={s.slug}>
              {s.type === 'hub' ? '⬡' : s.type === 'project' ? '◈' : '▤'}
              {s.label}
            </option>
          {/each}
        </select>
        <select bind:value={newPriority}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select bind:value={newLane}>
          {#each laneOrder as lane}
            <option value={lane}>{laneLabels[lane]}</option>
          {/each}
        </select>
      </div>
      <textarea bind:value={newDescription} placeholder="Description (markdown)..." rows="3"
      ></textarea>
      <div class="form-row">
        <input
          bind:value={newLabels}
          placeholder="Labels (comma-separated)..."
          class="labels-input"
        />
        <button class="btn-primary" onclick={createIssue}>Create</button>
        <button class="btn-ghost" onclick={() => (showNewIssue = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  <div class="kanban">
    {#each laneOrder as lane}
      <div
        class="lane"
        class:lane-claude={lane === 'claude'}
        class:lane-done={lane === 'done'}
        class:drag-over={dragOverLane === lane && dragSourceLane !== lane}
        role="list"
        ondragover={(e) => onDragOver(e, lane)}
        ondragleave={(e) => onDragLeave(e, lane)}
        ondrop={(e) => onDrop(e, lane)}
      >
        <div class="lane-header">
          <h2>
            {#if lane === 'claude'}<span class="claude-icon">&#x2726;</span>{/if}
            {laneLabels[lane]}
          </h2>
          <span class="lane-count">{lanes[lane].length}</span>
        </div>

        <div class="lane-cards">
          {#each lanes[lane] as issue (issue.id)}
            <button
              type="button"
              class="issue-card"
              class:dragging={draggedIssue?.id === issue.id}
              draggable="true"
              ondragstart={(e) => onDragStart(e, issue, lane)}
              ondragend={onDragEnd}
              onclick={() => openEdit(issue)}
            >
              <div class="issue-top">
                <span class="issue-title">{issue.title}</span>
                <span class="priority-dot {priorityClass(issue.priority)}" title={issue.priority}
                ></span>
              </div>
              {#if issue.description}
                <p class="issue-desc">
                  {issue.description.slice(0, 80)}{issue.description.length > 80 ? '...' : ''}
                </p>
              {/if}
              {#if issue.project_scope && issue.project_scope !== 'hub'}
                <div class="scope-badge-row">
                  <span class="scope-badge">{issue.project_scope}</span>
                </div>
              {/if}
              {#if issue.labels.length > 0}
                <div class="issue-labels">
                  {#each issue.labels as label}
                    <span class="label">{label}</span>
                  {/each}
                </div>
              {/if}
              {#if (issue as any).attachment_count > 0}
                <div class="attachment-indicator">
                  <span class="attachment-icon">&#x1F4CE;</span>
                  <span class="attachment-count">{(issue as any).attachment_count}</span>
                </div>
              {/if}
              {#if issue.assigned_to}
                <div class="assigned">
                  <span class="assigned-badge">&#x2726; {issue.assigned_to}</span>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- Claude Output Sidebar -->
{#if showOutput}
  <div class="output-sidebar" class:sidebar-wide={claudeStatus.state === 'working'}>
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="claude-icon">&#x2726;</span>
        <h3>Claude Output</h3>
        {#if runnerStatus.state === 'running'}
          <span class="live-badge">LIVE</span>
        {/if}
      </div>
      <div class="sidebar-actions">
        <label class="autoscroll-toggle">
          <input type="checkbox" bind:checked={autoScroll} />
          <span>Auto-scroll</span>
        </label>
        <button
          class="btn-ghost-sm"
          onclick={() => {
            outputLines = []
            outputSeq = 0
          }}
          title="Clear output"
        >
          Clear
        </button>
        <button class="btn-ghost-sm" onclick={() => (showOutput = false)} title="Close panel">
          &times;
        </button>
      </div>
    </div>
    {#if runnerStatus.issueTitle}
      <div class="sidebar-issue-info">
        <span class="issue-badge">{runnerStatus.issueId}</span>
        <span class="issue-name">{runnerStatus.issueTitle}</span>
      </div>
    {/if}
    <div
      class="output-terminal"
      bind:this={outputEl}
      onscroll={() => {
        if (outputEl) {
          const atBottom = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight < 40
          autoScroll = atBottom
        }
      }}
    >
      {#if outputLines.length === 0}
        <div class="output-empty">
          No output yet. Run Claude on a queued issue to see output here.
        </div>
      {:else}
        {#each outputLines as line}
          <div class="output-line line-{line.ch}">
            <span class="line-time"
              >{new Date(line.ts).toLocaleTimeString('en', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}</span
            >
            <span class="line-text">{line.text}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if editingIssue}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onclick={() => (editingIssue = null)} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
      <div class="modal-header">
        <h2>Edit Issue</h2>
        <div class="modal-actions-top">
          {#if confirmDeleteId === editingIssue.id}
            <span class="confirm-text">Delete?</span>
            <button
              class="btn-danger-sm"
              onclick={() => {
                deleteIssue(editingIssue!.id, editingIssue!.lane)
                editingIssue = null
              }}>Yes</button
            >
            <button class="btn-ghost-sm" onclick={() => (confirmDeleteId = '')}>No</button>
          {:else}
            <button
              class="btn-ghost-sm delete-modal-btn"
              onclick={() => (confirmDeleteId = editingIssue!.id)}>&times;</button
            >
          {/if}
        </div>
      </div>
      <input bind:value={editTitle} placeholder="Title" />
      <textarea bind:value={editDescription} placeholder="Description (markdown)..." rows="6"
      ></textarea>
      <div class="form-row">
        <select bind:value={editScope} class="scope-select">
          {#each scopes as s}
            <option value={s.slug}>
              {s.type === 'hub' ? '⬡' : s.type === 'project' ? '◈' : '▤'}
              {s.label}
            </option>
          {/each}
        </select>
        <select bind:value={editPriority}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input
          bind:value={editLabels}
          placeholder="Labels (comma-separated)..."
          class="labels-input"
        />
      </div>
      {#if editNotes.length > 0}
        <div class="notes-section">
          <div class="notes-header">
            <span class="notes-label">Claude Notes ({editNotes.length})</span>
          </div>
          <div class="notes-timeline">
            {#each editNotes as note (note.id)}
              <div class="note-entry note-{note.type}">
                <span class="note-icon">
                  {#if note.type === 'commit'}&#x2713;{:else if note.type === 'progress'}&#x25B6;{:else if note.type === 'error'}&#x2717;{:else}&#x2139;{/if}
                </span>
                <span class="note-msg">{note.message}</span>
                <span class="note-time"
                  >{new Date(note.created).toLocaleTimeString('en', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <div class="attachments-section">
        <div class="attachments-header">
          <span class="attachments-label">Attachments ({editAttachments.length})</span>
          <label class="btn-ghost-sm upload-btn">
            {uploadingFile ? 'Uploading...' : '+ Add file'}
            <input
              type="file"
              onchange={uploadAttachment}
              hidden
              accept="image/*,.pdf,.txt,.md,.csv,.html,.json"
            />
          </label>
        </div>
        {#if editAttachments.length > 0}
          <div class="attachments-list">
            {#each editAttachments as att (att.id)}
              <div class="attachment-item">
                <a
                  href="/api/board/{editingIssue.id}/attachments/{att.id}"
                  target="_blank"
                  rel="noopener"
                  class="attachment-link"
                >
                  <span class="att-icon">
                    {#if att.mime_type.startsWith('image/')}&#x1F5BC;{:else if att.mime_type === 'application/pdf'}&#x1F4C4;{:else}&#x1F4DD;{/if}
                  </span>
                  <span class="att-name">{att.filename}</span>
                  <span class="att-size">{formatFileSize(att.size_bytes)}</span>
                </a>
                <button
                  class="btn-ghost-sm att-delete"
                  onclick={() => deleteAttachment(att.id)}
                  title="Remove attachment">&times;</button
                >
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <code class="issue-id">{editingIssue.id}</code>
        <div>
          <button class="btn-ghost" onclick={() => (editingIssue = null)}>Cancel</button>
          <button class="btn-primary" onclick={saveEdit}>Save</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .board-page {
    max-width: 100%;
    transition: margin-right 0.2s ease;
  }
  .board-page.sidebar-open {
    margin-right: 420px;
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

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* Claude status indicator */
  .claude-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    color: var(--text);
    font-family: var(--font);
    transition: border-color 0.15s ease;
  }
  .claude-status:hover {
    border-color: var(--accent);
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-idle .status-dot {
    background: var(--text-muted);
  }
  .status-pending .status-dot {
    background: var(--warning);
    animation: pulse 2s ease-in-out infinite;
  }
  .status-working .status-dot {
    background: var(--success);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .status-error .status-dot {
    background: var(--danger);
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .status-info {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .status-label {
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .status-idle .status-label {
    color: var(--text-muted);
  }
  .status-pending .status-label {
    color: var(--warning);
  }
  .status-working .status-label {
    color: var(--success);
  }
  .status-error .status-label {
    color: var(--danger);
  }
  .status-detail {
    font-size: 0.62rem;
    color: var(--text-muted);
    line-height: 1.2;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Claude controls */
  .claude-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-claude {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-claude:hover {
    background: var(--accent-hover);
  }
  .claude-running-badge {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--success);
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--success);
    border-radius: var(--radius);
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* New issue form */
  .new-issue-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
  }
  .form-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .title-input {
    flex: 1;
  }
  .labels-input {
    flex: 1;
  }
  textarea {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s ease;
  }
  textarea:focus {
    border-color: var(--accent);
  }

  /* Kanban layout */
  .kanban {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 1rem;
    min-height: calc(100vh - 200px);
  }

  .lane {
    flex: 1 1 0;
    min-width: 180px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .lane.drag-over {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .lane-claude {
    border-color: var(--accent-muted);
    background: var(--accent-subtle);
  }
  .lane-claude .lane-header h2 {
    color: var(--accent);
  }
  .lane-done {
    opacity: 0.7;
  }

  .lane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .lane-header h2 {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .claude-icon {
    color: var(--accent);
    font-size: 0.9rem;
  }
  .lane-count {
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg);
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    min-width: 1.2rem;
    text-align: center;
  }

  .lane-cards {
    flex: 1;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    overflow-y: auto;
  }

  /* Issue cards */
  .issue-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.6rem 0.7rem;
    cursor: grab;
    transition: all 0.12s ease;
    user-select: none;
    color: var(--text);
    font-family: var(--font);
  }
  .issue-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }
  .issue-card:active {
    cursor: grabbing;
  }
  .issue-card.dragging {
    opacity: 0.35;
  }

  .issue-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.35rem;
  }
  .issue-title {
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.3;
  }
  .priority-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .priority-low {
    background: var(--info);
  }
  .priority-medium {
    background: var(--warning);
  }
  .priority-high {
    background: var(--orange);
  }
  .priority-critical {
    background: var(--danger);
  }

  .issue-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.3rem;
    line-height: 1.4;
  }
  .scope-badge-row {
    margin-top: 0.3rem;
  }
  .scope-badge {
    font-size: 0.58rem;
    font-weight: 600;
    color: var(--success);
    background: var(--success-subtle);
    padding: 0.08rem 0.35rem;
    border-radius: 3px;
    letter-spacing: 0.02em;
  }
  .scope-select {
    min-width: 120px;
  }
  .issue-labels {
    display: flex;
    gap: 0.2rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }
  .label {
    font-size: 0.62rem;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 0.05rem 0.35rem;
    border-radius: 3px;
  }
  .assigned {
    margin-top: 0.35rem;
  }
  .assigned-badge {
    font-size: 0.62rem;
    color: var(--accent);
    font-weight: 500;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    width: 90%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .modal-actions-top {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }
  .modal-footer div {
    display: flex;
    gap: 0.5rem;
  }
  .issue-id {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .btn-ghost-sm {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .btn-ghost-sm:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .btn-danger-sm {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    background: var(--danger);
    color: white;
  }
  .delete-modal-btn {
    font-size: 1rem;
    line-height: 1;
  }
  .delete-modal-btn:hover {
    color: var(--danger);
  }
  .confirm-text {
    font-size: 0.75rem;
    color: var(--danger);
  }

  /* Output Sidebar */
  .output-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    background: var(--bg-inset);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 90;
    animation: slideIn 0.2s ease-out;
  }
  .output-sidebar.sidebar-wide {
    width: 520px;
  }
  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    flex-shrink: 0;
  }
  .sidebar-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sidebar-title h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .sidebar-title .claude-icon {
    color: var(--accent);
    font-size: 1rem;
  }
  .live-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--success);
    background: var(--success-subtle);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    animation: pulse 1.5s ease-in-out infinite;
    letter-spacing: 0.05em;
  }
  .sidebar-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .autoscroll-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.68rem;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
  }
  .autoscroll-toggle input {
    width: 12px;
    height: 12px;
    accent-color: var(--accent);
  }

  .sidebar-issue-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    flex-shrink: 0;
  }
  .issue-badge {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .issue-name {
    font-size: 0.75rem;
    color: var(--text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .output-terminal {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.72rem;
    line-height: 1.55;
    scroll-behavior: smooth;
  }
  .output-terminal::-webkit-scrollbar {
    width: 6px;
  }
  .output-terminal::-webkit-scrollbar-track {
    background: transparent;
  }
  .output-terminal::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  .output-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.8rem;
  }

  .output-line {
    display: flex;
    padding: 0 1rem;
    gap: 0.6rem;
    min-height: 1.3em;
  }
  .output-line:hover {
    background: var(--bg-hover);
  }
  .line-time {
    color: var(--text-muted);
    flex-shrink: 0;
    user-select: none;
  }
  .line-text {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .line-stdout .line-text {
    color: var(--text);
  }
  .line-stderr .line-text {
    color: var(--warning);
  }
  .line-system .line-text {
    color: var(--accent);
    font-weight: 500;
  }

  /* Attachment indicator on cards */
  .attachment-indicator {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin-top: 0.3rem;
  }
  .attachment-icon {
    font-size: 0.68rem;
    opacity: 0.7;
  }
  .attachment-count {
    font-size: 0.62rem;
    color: var(--text-muted);
  }

  /* Attachments section in edit modal */
  /* Claude notes in edit modal */
  .notes-section {
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }
  .notes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .notes-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .notes-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-height: 180px;
    overflow-y: auto;
  }
  .note-entry {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    font-size: 0.72rem;
    background: var(--border-subtle);
  }
  .note-entry:hover {
    background: var(--bg-hover);
  }
  .note-icon {
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
    font-size: 0.65rem;
    line-height: 1.4;
  }
  .note-commit .note-icon {
    color: var(--success);
  }
  .note-progress .note-icon {
    color: var(--accent);
  }
  .note-error .note-icon {
    color: var(--danger);
  }
  .note-info .note-icon {
    color: var(--text-muted);
  }
  .note-msg {
    flex: 1;
    color: var(--text);
    line-height: 1.4;
    word-break: break-word;
  }
  .note-time {
    flex-shrink: 0;
    font-size: 0.62rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .attachments-section {
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }
  .attachments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .attachments-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
  }
  .upload-btn {
    cursor: pointer;
    font-size: 0.72rem;
    color: var(--accent);
    border-color: var(--accent);
  }
  .upload-btn:hover {
    background: var(--accent-subtle);
  }

  .attachments-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .attachment-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.5rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.75rem;
  }
  .attachment-link {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: 1;
    min-width: 0;
    color: var(--text);
    text-decoration: none;
  }
  .attachment-link:hover .att-name {
    color: var(--accent);
  }
  .att-icon {
    font-size: 0.85rem;
    flex-shrink: 0;
  }
  .att-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.12s;
  }
  .att-size {
    color: var(--text-muted);
    font-size: 0.65rem;
    flex-shrink: 0;
  }
  .att-delete {
    font-size: 0.9rem;
    line-height: 1;
    padding: 0.1rem 0.3rem;
    flex-shrink: 0;
  }
  .att-delete:hover {
    color: var(--danger);
  }
</style>
