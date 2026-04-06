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

  // Board state — owned locally, initialized from server data
  // We use $state (not $derived from data.lanes) so we can update it
  // from SSE events and optimistic drag-and-drop without reactivity issues.
  let lanes = $state<Record<BoardLane, BoardIssue[]>>(structuredClone(data.lanes))

  function mutateLanes(
    fn: (current: Record<BoardLane, BoardIssue[]>) => Record<BoardLane, BoardIssue[]>,
  ) {
    lanes = fn(structuredClone(lanes))
  }

  // Drag state
  let draggedIssue = $state<BoardIssue | null>(null)
  let dragSourceLane = $state<BoardLane | null>(null)
  let dragOverLane = $state<BoardLane | null>(null)

  // Project scopes and filters from server
  let scopes = $derived(data.scopes)
  let projectFilters = $derived(data.projectFilters ?? [])

  // Project filter state — which projects to show (empty = show all)
  let activeProjectFilters = $state<Set<string>>(new Set())

  function toggleProjectFilter(slug: string) {
    const next = new Set(activeProjectFilters)
    if (next.has(slug)) {
      next.delete(slug)
    } else {
      next.add(slug)
    }
    activeProjectFilters = next
  }

  function clearProjectFilter() {
    activeProjectFilters = new Set()
  }

  // Filtered lanes — apply project filter
  let filteredLanes = $derived.by(() => {
    if (activeProjectFilters.size === 0) return lanes
    const filtered: Record<BoardLane, BoardIssue[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      claude: [],
      review: [],
      done: [],
    }
    for (const lane of laneOrder) {
      filtered[lane] = lanes[lane].filter((issue) =>
        activeProjectFilters.has(issue.project_scope || 'hub'),
      )
    }
    return filtered
  })

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
  let uploadProgress = $state('')
  let dragOver = $state(false)

  // Claude notes in edit modal
  let editNotes = $state<ClaudeNote[]>([])

  // Confirm delete
  let confirmDeleteId = $state('')

  // Check if an issue is locked (being worked on by Claude)
  function isLocked(issue: BoardIssue): boolean {
    return issue.assigned_to === 'claude-runner'
  }

  // Check if the detail drawer is in read-only mode
  let isEditingLocked = $derived(editingIssue ? isLocked(editingIssue) : false)

  // Claude runner status — polled from server
  let runnerStatus = $state<{
    state: 'idle' | 'running' | 'error'
    issueId?: string
    issueTitle?: string
    startedAt?: string
    error?: string
    output?: string
    elapsedMs?: number | null
    lastActivityAt?: string | null
    history?: Array<{
      issueId: string
      issueTitle: string
      scope: string
      startedAt: string
      finishedAt: string
      exitCode: number | null
      outcome: 'success' | 'partial' | 'failed' | 'error'
      commitCount: number
      branch?: string
    }>
  }>({ state: 'idle' })

  function formatElapsed(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    const mins = Math.floor(ms / 60000)
    const secs = Math.round((ms % 60000) / 1000)
    return `${mins}m ${secs}s`
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  // Combined Claude status — merges board state + runner process state
  let claudeStatus = $derived.by(() => {
    if (runnerStatus.state === 'running') {
      const elapsed = liveElapsed
      const elapsedStr = elapsed ? ` (${formatElapsed(elapsed)})` : ''
      return {
        state: 'working' as const,
        label: 'Working',
        detail: `${runnerStatus.issueTitle ?? 'Processing...'}${elapsedStr}`,
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

    // Show last activity info when idle
    const lastAct = runnerStatus.lastActivityAt
    const detail = lastAct ? `Last active ${timeAgo(lastAct)}` : 'No tasks assigned'
    return {
      state: 'idle' as const,
      label: 'Idle',
      detail,
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

  // --- Real-time updates via SSE ---
  let eventSource: EventSource | null = null

  async function invalidateBoard() {
    const res = await fetch('/api/board')
    if (res.ok) {
      const { data: boardData } = await res.json()
      lanes = boardData
    }
  }

  async function runClaude() {
    outputLines = []
    outputSeq = 0
    showOutput = true
    const res = await fetch('/api/board/claude/run', { method: 'POST' })
    if (res.ok) {
      const { data: d } = await res.json()
      runnerStatus = {
        ...runnerStatus,
        state: d.state,
        issueId: d.issueId,
        issueTitle: d.issueTitle,
        startedAt: d.startedAt,
        error: d.error,
      }
    }
  }

  function toggleOutput() {
    showOutput = !showOutput
    if (showOutput) scrollToBottom()
  }

  /** Fetch initial state (output + status + history) on mount */
  async function loadInitialState() {
    try {
      const res = await fetch('/api/board/claude/output?since=0')
      if (!res.ok) return
      const { data: d } = await res.json()
      runnerStatus = {
        state: d.state,
        issueId: d.issueId,
        issueTitle: d.issueTitle,
        startedAt: d.startedAt,
        error: d.error,
        elapsedMs: d.elapsedMs,
        lastActivityAt: d.lastActivityAt,
        history: d.history,
      }
      if (d.lines.length > 0) {
        outputLines = d.lines
        outputSeq = d.seq
      }
      if (d.state === 'running') {
        showOutput = true
      }
    } catch {
      /* ignore */
    }
  }

  /** Connect SSE stream for real-time updates */
  function connectSSE() {
    if (eventSource) eventSource.close()

    const es = new EventSource('/api/board/events')
    eventSource = es

    es.addEventListener('output', (e) => {
      const { seq, lines: newLines } = JSON.parse(e.data)
      if (newLines.length > 0) {
        outputLines = [...outputLines, ...newLines]
        outputSeq = seq
        // Keep client-side buffer reasonable
        if (outputLines.length > 2000) {
          outputLines = outputLines.slice(-1500)
        }
        scrollToBottom()
      }
    })

    es.addEventListener('status', (e) => {
      const d = JSON.parse(e.data)
      const wasRunning = runnerStatus.state === 'running'
      runnerStatus = {
        ...runnerStatus,
        state: d.state,
        issueId: d.issueId,
        issueTitle: d.issueTitle,
        startedAt: d.startedAt,
        error: d.error,
        elapsedMs: d.elapsedMs,
        lastActivityAt: d.lastActivityAt,
        history: d.history,
      }
      // Auto-open output panel when Claude starts running
      if (d.state === 'running' && !wasRunning) {
        outputLines = []
        outputSeq = 0
        showOutput = true
      }
    })

    es.addEventListener('board', () => {
      invalidateBoard()
    })

    es.onerror = () => {
      // Auto-reconnect is built into EventSource
    }
  }

  // Elapsed time live counter — updates every second while running
  let elapsedTick = $state(0)
  let elapsedInterval: ReturnType<typeof setInterval> | null = null

  $effect(() => {
    if (runnerStatus.state === 'running' && runnerStatus.startedAt) {
      if (!elapsedInterval) {
        elapsedInterval = setInterval(() => { elapsedTick++ }, 1000)
      }
    } else {
      if (elapsedInterval) {
        clearInterval(elapsedInterval)
        elapsedInterval = null
        elapsedTick = 0
      }
    }
  })

  // Update elapsed display reactively (elapsedTick triggers re-derive)
  let liveElapsed = $derived.by(() => {
    if (runnerStatus.state !== 'running' || !runnerStatus.startedAt) return null
    // Reference elapsedTick to re-derive every second
    void elapsedTick
    return Date.now() - new Date(runnerStatus.startedAt).getTime()
  })

  onMount(() => {
    loadInitialState().then(() => connectSSE())
    return () => {
      if (eventSource) eventSource.close()
      if (elapsedInterval) clearInterval(elapsedInterval)
    }
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

  async function uploadFiles(files: FileList | File[]) {
    if (!editingIssue || files.length === 0) return

    uploadingFile = true
    const fileArray = Array.from(files)
    let uploaded = 0

    for (const file of fileArray) {
      uploadProgress = fileArray.length > 1 ? `${uploaded + 1}/${fileArray.length}` : file.name
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`/api/board/${editingIssue.id}/attachments`, {
        method: 'POST',
        body: form,
      })

      if (res.ok) {
        const { data: att } = await res.json()
        editAttachments = [...editAttachments, att]
        uploaded++
      }
    }

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

    uploadingFile = false
    uploadProgress = ''
  }

  async function uploadAttachment(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) await uploadFiles(input.files)
    input.value = ''
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave() {
    dragOver = false
  }

  function handlePaste(e: ClipboardEvent) {
    if (!editingIssue) return
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      uploadFiles(files)
    }
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
    if (isLocked(issue)) {
      e.preventDefault()
      return
    }
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
      // Revert on failure — re-fetch from server
      await invalidateBoard()
    }
  }

  function priorityClass(p: string) {
    return `priority-${p}`
  }
</script>

<div class="board-page" class:sidebar-open={showOutput} class:drawer-open={!!editingIssue}>
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

  {#if projectFilters.length > 1}
    <div class="project-filter-bar">
      <span class="filter-label">Projects</span>
      <div class="filter-chips">
        <button
          class="filter-chip"
          class:active={activeProjectFilters.size === 0}
          onclick={clearProjectFilter}
        >
          All
        </button>
        {#each projectFilters as pf}
          <button
            class="filter-chip"
            class:active={activeProjectFilters.has(pf.slug)}
            onclick={() => toggleProjectFilter(pf.slug)}
          >
            {#if pf.color}
              <span class="filter-dot" style="background: {pf.color}"></span>
            {/if}
            {pf.icon || ''} {pf.name}
            <span class="filter-count">{pf.itemCount}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

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
          <span class="lane-count">{filteredLanes[lane].length}</span>
        </div>

        <div class="lane-cards">
          {#each filteredLanes[lane] as issue (issue.id)}
            <button
              type="button"
              class="issue-card"
              class:dragging={draggedIssue?.id === issue.id}
              class:locked={isLocked(issue)}
              draggable={!isLocked(issue)}
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
        {@const pendingIssues = lanes.claude.filter((i) => !i.assigned_to)}
        <div class="output-empty-state">
          {#if pendingIssues.length > 0}
            <div class="empty-icon">&#x2726;</div>
            <div class="empty-title">{pendingIssues.length} issue{pendingIssues.length > 1 ? 's' : ''} queued</div>
            <div class="queued-list">
              {#each pendingIssues as qi}
                <div class="queued-item">
                  <span class="priority-dot {priorityClass(qi.priority)}" title={qi.priority}></span>
                  <span class="queued-title">{qi.title}</span>
                  {#if qi.project_scope && qi.project_scope !== 'hub'}
                    <span class="scope-badge">{qi.project_scope}</span>
                  {/if}
                </div>
              {/each}
            </div>
            <button class="btn-primary btn-run-claude" onclick={runClaude}>
              &#x25B6; Run Claude
            </button>
          {:else if runnerStatus.state === 'error'}
            <div class="empty-icon error-icon">&#x26A0;</div>
            <div class="empty-title">Last run failed</div>
            <div class="empty-detail">{runnerStatus.error}</div>
          {:else}
            <div class="empty-icon">&#x2726;</div>
            <div class="empty-title">No output</div>
            <div class="empty-detail">Drag an issue to the Claude lane and hit Run.</div>
          {/if}
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
    {#if runnerStatus.history && runnerStatus.history.length > 0}
      <div class="history-section">
        <div class="history-header">Recent Runs</div>
        {#each runnerStatus.history as entry}
          <div class="history-entry">
            <span class="history-outcome outcome-{entry.outcome}">
              {#if entry.outcome === 'success'}&#x2713;{:else if entry.outcome === 'partial'}&#x25D0;{:else if entry.outcome === 'failed'}&#x2717;{:else}&#x26A0;{/if}
            </span>
            <div class="history-info">
              <span class="history-title">{entry.issueTitle}</span>
              <span class="history-meta">
                {entry.commitCount} commit{entry.commitCount !== 1 ? 's' : ''}
                &middot; {timeAgo(entry.finishedAt)}
                {#if entry.branch}
                  &middot; {entry.branch}
                {/if}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Detail Drawer -->
{#if editingIssue}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="drawer-backdrop" onclick={() => (editingIssue = null)} role="presentation"></div>
  <div class="detail-drawer" role="dialog" tabindex="-1">
    <div class="drawer-header">
      <div class="drawer-title-row">
        <h2>{isEditingLocked ? 'Issue Details' : 'Edit Issue'}</h2>
        {#if isEditingLocked}
          <span class="locked-badge">&#x1F512; Claude is working</span>
        {/if}
      </div>
      <div class="drawer-actions-top">
        {#if !isEditingLocked}
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
        {/if}
        <button class="btn-ghost-sm" onclick={() => (editingIssue = null)} title="Close">&larr;</button>
      </div>
    </div>

    <div class="drawer-body">
      <div class="drawer-field">
        <label class="drawer-label">Title</label>
        <input bind:value={editTitle} placeholder="Title" disabled={isEditingLocked} />
      </div>

      <div class="drawer-field">
        <label class="drawer-label">Description</label>
        <textarea
          bind:value={editDescription}
          placeholder="Description (markdown)..."
          rows="6"
          disabled={isEditingLocked}
        ></textarea>
      </div>

      <div class="drawer-field-row">
        <div class="drawer-field">
          <label class="drawer-label">Scope</label>
          <select bind:value={editScope} class="scope-select" disabled={isEditingLocked}>
            {#each scopes as s}
              <option value={s.slug}>
                {s.type === 'hub' ? '⬡' : s.type === 'project' ? '◈' : '▤'}
                {s.label}
              </option>
            {/each}
          </select>
        </div>
        <div class="drawer-field">
          <label class="drawer-label">Priority</label>
          <select bind:value={editPriority} disabled={isEditingLocked}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div class="drawer-field">
        <label class="drawer-label">Labels</label>
        <input
          bind:value={editLabels}
          placeholder="Labels (comma-separated)..."
          class="labels-input"
          disabled={isEditingLocked}
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

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="attachments-section"
        class:drag-over={dragOver}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        onpaste={handlePaste}
      >
        <div class="attachments-header">
          <span class="attachments-label">Attachments ({editAttachments.length})</span>
          {#if !isEditingLocked}
            <label class="btn-ghost-sm upload-btn">
              {#if uploadingFile}
                Uploading {uploadProgress}...
              {:else}
                + Add files
              {/if}
              <input
                type="file"
                onchange={uploadAttachment}
                hidden
                multiple
                accept="image/*,.pdf,.txt,.md,.csv,.html,.json"
              />
            </label>
          {/if}
        </div>

        {#if editAttachments.length > 0}
          <!-- Image previews grid -->
          {@const images = editAttachments.filter((a) => a.mime_type.startsWith('image/'))}
          {@const others = editAttachments.filter((a) => !a.mime_type.startsWith('image/'))}

          {#if images.length > 0}
            <div class="attachment-previews">
              {#each images as att (att.id)}
                <div class="preview-item">
                  <a
                    href="/api/board/{editingIssue.id}/attachments/{att.id}"
                    target="_blank"
                    rel="noopener"
                    class="preview-link"
                  >
                    <img
                      src="/api/board/{editingIssue.id}/attachments/{att.id}"
                      alt={att.filename}
                      class="preview-img"
                      loading="lazy"
                    />
                  </a>
                  <div class="preview-info">
                    <span class="att-name">{att.filename}</span>
                    <span class="att-size">{formatFileSize(att.size_bytes)}</span>
                  </div>
                  {#if !isEditingLocked}
                    <button
                      class="btn-ghost-sm preview-delete"
                      onclick={() => deleteAttachment(att.id)}
                      title="Remove attachment">&times;</button
                    >
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if others.length > 0}
            <div class="attachments-list">
              {#each others as att (att.id)}
                <div class="attachment-item">
                  <a
                    href="/api/board/{editingIssue.id}/attachments/{att.id}"
                    target="_blank"
                    rel="noopener"
                    class="attachment-link"
                  >
                    <span class="att-icon">
                      {#if att.mime_type === 'application/pdf'}&#x1F4C4;{:else if att.mime_type.startsWith('text/markdown')}&#x1F4DD;{:else}&#x1F4C3;{/if}
                    </span>
                    <span class="att-name">{att.filename}</span>
                    <span class="att-size">{formatFileSize(att.size_bytes)}</span>
                  </a>
                  {#if !isEditingLocked}
                    <button
                      class="btn-ghost-sm att-delete"
                      onclick={() => deleteAttachment(att.id)}
                      title="Remove attachment">&times;</button
                    >
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}

        {#if !isEditingLocked && !uploadingFile && editAttachments.length === 0}
          <div class="drop-zone-hint">
            Drop files here, paste images, or click "+ Add files"
          </div>
        {/if}

        {#if dragOver}
          <div class="drop-overlay">
            Drop files to attach
          </div>
        {/if}
      </div>
    </div>

    <div class="drawer-footer">
      <code class="issue-id">{editingIssue.id}</code>
      {#if !isEditingLocked}
        <div>
          <button class="btn-ghost" onclick={() => (editingIssue = null)}>Cancel</button>
          <button class="btn-primary" onclick={saveEdit}>Save</button>
        </div>
      {:else}
        <button class="btn-ghost" onclick={() => (editingIssue = null)}>Close</button>
      {/if}
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
  .board-page.drawer-open {
    margin-right: 480px;
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

  /* Project filter bar */
  .project-filter-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 0.5rem 0;
  }
  .filter-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }
  .filter-chips {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    font-size: 0.72rem;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font);
  }
  .filter-chip:hover {
    background: var(--bg-hover);
    color: var(--text);
    border-color: var(--text-muted);
  }
  .filter-chip.active {
    background: var(--accent-subtle);
    color: var(--accent);
    border-color: var(--accent);
  }
  .filter-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .filter-count {
    font-size: 0.62rem;
    opacity: 0.6;
    font-family: var(--font-mono);
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
  .issue-card.locked {
    cursor: pointer;
    border-color: var(--accent-muted);
    background: var(--accent-subtle);
    position: relative;
  }
  .issue-card.locked::after {
    content: '🔒';
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    font-size: 0.6rem;
    opacity: 0.7;
  }
  .issue-card.locked:hover {
    border-color: var(--accent);
    cursor: pointer;
  }
  .issue-card.locked:active {
    cursor: pointer;
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

  /* Detail Drawer */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    z-index: 99;
    animation: fadeIn 0.15s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .detail-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 480px;
    height: 100vh;
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 100;
    animation: drawerSlideIn 0.2s ease-out;
  }
  @keyframes drawerSlideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .drawer-title-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .drawer-header h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }
  .locked-badge {
    font-size: 0.68rem;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    animation: pulse 2s ease-in-out infinite;
  }
  .drawer-actions-top {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .drawer-body::-webkit-scrollbar {
    width: 6px;
  }
  .drawer-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .drawer-body::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  .drawer-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .drawer-field-row {
    display: flex;
    gap: 0.75rem;
  }
  .drawer-field-row .drawer-field {
    flex: 1;
  }
  .drawer-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .drawer-body input:disabled,
  .drawer-body textarea:disabled,
  .drawer-body select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--bg-inset);
  }
  .drawer-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .drawer-footer div {
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

  .output-empty-state {
    padding: 2rem 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font);
  }
  .empty-icon {
    font-size: 2rem;
    color: var(--accent);
    opacity: 0.5;
  }
  .empty-icon.error-icon {
    color: var(--danger);
  }
  .empty-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
  }
  .empty-detail {
    font-size: 0.78rem;
    color: var(--text-muted);
    text-align: center;
  }
  .queued-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .queued-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.78rem;
  }
  .queued-title {
    flex: 1;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btn-run-claude {
    margin-top: 0.5rem;
    padding: 0.5rem 1.5rem;
    font-size: 0.85rem;
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

  /* Run history in output sidebar */
  .history-section {
    border-top: 1px solid var(--border);
    padding: 0.5rem 0;
    flex-shrink: 0;
    max-height: 200px;
    overflow-y: auto;
  }
  .history-header {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.25rem 1rem 0.4rem;
  }
  .history-entry {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.3rem 1rem;
    font-size: 0.72rem;
  }
  .history-entry:hover {
    background: var(--bg-hover);
  }
  .history-outcome {
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
    font-size: 0.7rem;
    line-height: 1.4;
  }
  .outcome-success { color: var(--success); }
  .outcome-partial { color: var(--warning); }
  .outcome-failed { color: var(--danger); }
  .outcome-error { color: var(--danger); }
  .history-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .history-title {
    color: var(--text);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-meta {
    font-size: 0.62rem;
    color: var(--text-muted);
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
    position: relative;
    transition: border-color 0.15s;
  }
  .attachments-section.drag-over {
    border-color: var(--accent);
  }
  .attachments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .attachments-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  /* Image previews grid */
  .attachment-previews {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }
  .preview-item {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg);
    transition: border-color 0.12s;
  }
  .preview-item:hover {
    border-color: var(--accent);
  }
  .preview-link {
    display: block;
  }
  .preview-img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
  }
  .preview-info {
    padding: 0.2rem 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }
  .preview-info .att-name {
    font-size: 0.62rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }
  .preview-info .att-size {
    font-size: 0.58rem;
    color: var(--text-muted);
  }
  .preview-delete {
    position: absolute;
    top: 0.15rem;
    right: 0.15rem;
    font-size: 0.8rem;
    line-height: 1;
    padding: 0.1rem 0.25rem;
    background: rgba(0, 0, 0, 0.6);
    color: var(--text);
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .preview-item:hover .preview-delete {
    opacity: 1;
  }
  .preview-delete:hover {
    color: var(--danger);
    background: rgba(0, 0, 0, 0.8);
  }

  /* File list (non-images) */
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
    transition: border-color 0.12s;
  }
  .attachment-item:hover {
    border-color: var(--accent);
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

  /* Drop zone */
  .drop-zone-hint {
    text-align: center;
    padding: 0.75rem;
    color: var(--text-muted);
    font-size: 0.7rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
    margin-top: 0.25rem;
  }
  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--accent-rgb, 99, 102, 241), 0.08);
    border: 2px dashed var(--accent);
    border-radius: 6px;
    color: var(--accent);
    font-size: 0.8rem;
    font-weight: 600;
    z-index: 10;
    pointer-events: none;
  }
</style>
