<script lang="ts">
  let { data } = $props()
  let pending = $derived(data.pending)
  let recent = $derived(data.recent)
  let merging = $state('')
  let discarding = $state('')

  async function mergeBranch(branchName: string) {
    merging = branchName
    const res = await fetch(`/api/branches/${encodeURIComponent(branchName)}/merge`, {
      method: 'POST',
    })
    merging = ''
    if (res.ok) {
      window.location.reload()
    } else {
      const { error } = await res.json()
      alert(`Merge failed: ${error}`)
    }
  }

  async function discardBranch(branchName: string) {
    if (!confirm(`Discard branch "${branchName}"? This deletes the branch and all its commits.`))
      return
    discarding = branchName
    const res = await fetch(`/api/branches/${encodeURIComponent(branchName)}`, {
      method: 'DELETE',
    })
    discarding = ''
    if (res.ok) {
      window.location.reload()
    }
  }

  function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(ms / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }
</script>

<div class="reviews-page">
  <header class="page-header">
    <div>
      <h1>Reviews</h1>
      <p class="subtitle">
        {pending.length} pending review{pending.length !== 1 ? 's' : ''}
      </p>
    </div>
  </header>

  {#if pending.length === 0 && recent.length === 0}
    <div class="empty-state">
      <p>No branch reviews yet.</p>
      <p class="hint">
        When Claude works on an issue, it creates a branch. Completed branches appear here for
        review.
      </p>
    </div>
  {/if}

  {#if pending.length > 0}
    <section class="review-section">
      <h2>Pending</h2>
      <div class="review-list">
        {#each pending as review (review.id)}
          <div class="review-card">
            <div class="review-main">
              <div class="review-info">
                <a href="/reviews/{encodeURIComponent(review.branch_name)}" class="review-title">
                  {review.issue_title}
                </a>
                <div class="review-meta">
                  <code class="branch-name">{review.branch_name}</code>
                  <span class="commit-count"
                    >{review.commit_count} commit{review.commit_count !== 1 ? 's' : ''}</span
                  >
                  <span class="scope-badge">{review.project_scope}</span>
                  <span class="time">{timeAgo(review.created)}</span>
                </div>
              </div>
              <div class="review-actions">
                <a
                  href="/reviews/{encodeURIComponent(review.branch_name)}"
                  class="btn-ghost btn-sm"
                >
                  View Diff
                </a>
                <button
                  class="btn-merge btn-sm"
                  onclick={() => mergeBranch(review.branch_name)}
                  disabled={merging === review.branch_name}
                >
                  {merging === review.branch_name ? 'Merging...' : 'Merge'}
                </button>
                <button
                  class="btn-ghost btn-sm btn-discard"
                  onclick={() => discardBranch(review.branch_name)}
                  disabled={discarding === review.branch_name}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if recent.length > 0}
    <section class="review-section">
      <h2>Recent</h2>
      <div class="review-list">
        {#each recent as review (review.id)}
          <div class="review-card review-{review.status}">
            <div class="review-main">
              <div class="review-info">
                <span class="review-title-text">{review.issue_title}</span>
                <div class="review-meta">
                  <code class="branch-name">{review.branch_name}</code>
                  <span class="status-badge status-{review.status}">{review.status}</span>
                  <span class="time">
                    {timeAgo(review.merged_at || review.discarded_at || review.created)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .reviews-page {
    max-width: 900px;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
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

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  .hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }

  .review-section {
    margin-bottom: 2rem;
  }
  .review-section h2 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .review-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .review-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
  }
  .review-card.review-merged {
    opacity: 0.6;
  }
  .review-card.review-discarded {
    opacity: 0.4;
  }

  .review-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .review-info {
    flex: 1;
    min-width: 0;
  }
  .review-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text);
  }
  .review-title:hover {
    color: var(--accent);
  }
  .review-title-text {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text);
  }

  .review-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .branch-name {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    background: var(--bg-inset);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }

  .commit-count {
    font-weight: 500;
    color: var(--accent);
  }

  .scope-badge {
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    background: var(--success-subtle);
    color: var(--success);
  }

  .status-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }
  .status-merged {
    background: var(--success-subtle);
    color: var(--success);
  }
  .status-discarded {
    background: var(--danger-subtle);
    color: var(--danger);
  }

  .review-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .btn-sm {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }

  .btn-merge {
    background: var(--success);
    color: white;
    border: 1px solid var(--success);
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 500;
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
  }
  .btn-discard:hover {
    background: var(--danger-subtle) !important;
  }
</style>
