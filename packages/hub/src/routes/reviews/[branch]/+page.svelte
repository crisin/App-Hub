<script lang="ts">
  let { data } = $props()
  let review = $derived(data.review)
  let diff = $derived(data.diff)
  let diffStat = $derived(data.diffStat)
  let commits = $derived(data.commits)
  let merging = $state(false)
  let discarding = $state(false)

  async function mergeBranch() {
    merging = true
    const res = await fetch(`/api/branches/${encodeURIComponent(review.branch_name)}/merge`, {
      method: 'POST',
    })
    merging = false
    if (res.ok) {
      window.location.href = '/reviews'
    } else {
      const { error } = await res.json()
      alert(`Merge failed: ${error}`)
    }
  }

  async function discardBranch() {
    if (!confirm('Discard this branch? All commits will be lost.')) return
    discarding = true
    const res = await fetch(`/api/branches/${encodeURIComponent(review.branch_name)}`, {
      method: 'DELETE',
    })
    discarding = false
    if (res.ok) {
      window.location.href = '/reviews'
    }
  }

  function classifyLine(line: string): string {
    if (line.startsWith('+++') || line.startsWith('---')) return 'diff-file'
    if (line.startsWith('+')) return 'diff-add'
    if (line.startsWith('-')) return 'diff-del'
    if (line.startsWith('@@')) return 'diff-hunk'
    if (line.startsWith('diff --git')) return 'diff-header'
    return ''
  }
</script>

<div class="review-detail">
  <a href="/reviews" class="back-link">&larr; All Reviews</a>

  <header class="review-header">
    <div>
      <h1>{review.issue_title}</h1>
      <div class="review-meta">
        <code class="branch-name">{review.branch_name}</code>
        <span class="scope-badge">{review.project_scope}</span>
        <span class="base">into <code>{review.base_branch}</code></span>
        {#if review.status === 'pending'}
          <span class="status-badge status-pending">pending</span>
        {:else}
          <span class="status-badge status-{review.status}">{review.status}</span>
        {/if}
      </div>
    </div>
    {#if review.status === 'pending'}
      <div class="header-actions">
        <button class="btn-merge" onclick={mergeBranch} disabled={merging}>
          {merging ? 'Merging...' : 'Merge Branch'}
        </button>
        <button class="btn-ghost btn-discard" onclick={discardBranch} disabled={discarding}>
          {discarding ? 'Discarding...' : 'Discard'}
        </button>
      </div>
    {/if}
  </header>

  <!-- Commits -->
  {#if commits.length > 0}
    <section class="commits-section">
      <h2>Commits ({commits.length})</h2>
      <div class="commit-list">
        {#each commits as commit}
          <div class="commit-item">
            <code class="commit-hash">{commit.hash}</code>
            <span class="commit-msg">{commit.message}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Diff stat -->
  {#if diffStat}
    <section class="stat-section">
      <h2>Files Changed</h2>
      <pre class="diff-stat">{diffStat}</pre>
    </section>
  {/if}

  <!-- Diff -->
  {#if diff}
    <section class="diff-section">
      <h2>Diff</h2>
      <div class="diff-viewer">
        {#each diff.split('\n') as line}
          <div class="diff-line {classifyLine(line)}">{line}</div>
        {/each}
      </div>
    </section>
  {:else}
    <div class="empty-state">
      <p>No changes found on this branch.</p>
    </div>
  {/if}
</div>

<style>
  .review-detail {
    max-width: 1100px;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .back-link:hover {
    color: var(--text);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .review-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .branch-name {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--bg-inset);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
  }
  .scope-badge {
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    background: var(--success-subtle);
    color: var(--success);
  }
  .base code {
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .status-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }
  .status-pending {
    background: var(--warning-subtle);
    color: var(--warning);
  }
  .status-merged {
    background: var(--success-subtle);
    color: var(--success);
  }
  .status-discarded {
    background: var(--danger-subtle);
    color: var(--danger);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .btn-merge {
    background: var(--success);
    color: white;
    border: 1px solid var(--success);
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 600;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }
  .btn-merge:hover {
    filter: brightness(1.1);
  }
  .btn-merge:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-discard {
    color: var(--danger) !important;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }
  .btn-discard:hover {
    background: var(--danger-subtle) !important;
  }

  /* Commits */
  .commits-section {
    margin-bottom: 1.5rem;
  }
  .commits-section h2,
  .stat-section h2,
  .diff-section h2 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }
  .commit-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .commit-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.8rem;
  }
  .commit-hash {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--accent);
    flex-shrink: 0;
  }
  .commit-msg {
    color: var(--text);
  }

  /* Diff stat */
  .stat-section {
    margin-bottom: 1.5rem;
  }
  .diff-stat {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    overflow-x: auto;
    color: var(--text-muted);
  }

  /* Diff viewer */
  .diff-section {
    margin-bottom: 2rem;
  }
  .diff-viewer {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.5;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow-x: auto;
    max-height: 80vh;
    overflow-y: auto;
  }
  .diff-line {
    padding: 0 0.75rem;
    white-space: pre;
    min-height: 1.5em;
  }
  .diff-header {
    color: var(--text-muted);
    font-weight: 600;
    background: var(--bg-inset);
    padding-top: 0.5rem;
    padding-bottom: 0.25rem;
    border-top: 1px solid var(--border);
  }
  .diff-file {
    color: var(--text-muted);
    font-weight: 600;
  }
  .diff-hunk {
    color: var(--accent);
    background: var(--accent-subtle);
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
  .diff-add {
    color: var(--success);
    background: var(--success-subtle);
  }
  .diff-del {
    color: var(--danger);
    background: var(--danger-subtle);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--text-muted);
  }
</style>
