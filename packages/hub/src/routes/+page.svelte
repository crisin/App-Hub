<script lang="ts">
  let { data } = $props()
  let showNewProject = $state(false)
  let newName = $state('')
  let selectedTemplate = $state('')
  let search = $state('')
  let statusFilter = $state('all')
  let confirmDelete = $state('')

  const statusColors: Record<string, string> = {
    idea: 'badge-idea',
    active: 'badge-active',
    paused: 'badge-paused',
    completed: 'badge-completed',
    archived: 'badge-archived',
  }

  const statuses = ['all', 'idea', 'active', 'paused', 'completed', 'archived']

  let filteredProjects = $derived(
    data.projects.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    }),
  )

  async function createProject() {
    if (!newName.trim() || !selectedTemplate) return

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, template: selectedTemplate }),
    })

    if (res.ok) {
      showNewProject = false
      newName = ''
      selectedTemplate = ''
      window.location.reload()
    }
  }

  async function deleteProject(slug: string) {
    const res = await fetch(`/api/projects/${slug}`, { method: 'DELETE' })
    if (res.ok) {
      confirmDelete = ''
      window.location.reload()
    }
  }
</script>

<div class="dashboard">
  <header class="page-header">
    <div>
      <h1>Projects</h1>
      <p class="subtitle">{data.projects.length} project{data.projects.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="header-actions">
      <button
        class="btn-ghost"
        onclick={() => fetch('/api/sync', { method: 'POST' }).then(() => window.location.reload())}
      >
        Sync
      </button>
      <button class="btn-primary" onclick={() => (showNewProject = !showNewProject)}>
        + New Project
      </button>
    </div>
  </header>

  {#if showNewProject}
    <div class="new-project-form">
      <input bind:value={newName} placeholder="Project name..." />
      <select bind:value={selectedTemplate}>
        <option value="" disabled>Select template...</option>
        {#each data.templates as template}
          <option value={template.slug}>{template.name}</option>
        {/each}
      </select>
      <button class="btn-primary" onclick={createProject}>Create</button>
      <button class="btn-ghost" onclick={() => (showNewProject = false)}>Cancel</button>
    </div>
  {/if}

  {#if data.projects.length > 0}
    <div class="filters">
      <input class="search-input" bind:value={search} placeholder="Search projects..." />
      <div class="status-filters">
        {#each statuses as status}
          <button
            class="filter-btn"
            class:active={statusFilter === status}
            onclick={() => (statusFilter = status)}
          >
            {status === 'all' ? 'All' : status}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if data.projects.length === 0}
    <div class="empty-state">
      <p>No projects yet. Create one to get started!</p>
      <p class="hint">
        Or drop a project folder with a <code>.apphub.md</code> file into <code>projects/</code>
      </p>
    </div>
  {:else if filteredProjects.length === 0}
    <div class="empty-state">
      <p>No projects match your filters.</p>
    </div>
  {:else}
    <div class="project-grid">
      {#each filteredProjects as project}
        <div class="project-card-wrapper">
          <a href="/project/{project.slug}" class="project-card">
            <div class="card-header">
              <h3>{project.name}</h3>
              <span class="badge {statusColors[project.status] ?? ''}">{project.status}</span>
            </div>
            {#if project.description}
              <p class="card-desc">{project.description}</p>
            {/if}
            <div class="card-meta">
              <span class="template">{project.template}</span>
              <span class="tasks">
                {project.itemSummary.done}/{project.itemSummary.total} items
              </span>
            </div>
            {#if project.tags.length > 0}
              <div class="card-tags">
                {#each project.tags as tag}
                  <span class="tag">#{tag}</span>
                {/each}
              </div>
            {/if}
          </a>
          <div class="card-actions">
            {#if confirmDelete === project.slug}
              <span class="confirm-text">Delete?</span>
              <button class="btn-danger-sm" onclick={() => deleteProject(project.slug)}>Yes</button>
              <button class="btn-ghost-sm" onclick={() => (confirmDelete = '')}>No</button>
            {:else}
              <button
                class="btn-ghost-sm delete-btn"
                onclick={() => (confirmDelete = project.slug)}
                title="Delete project"
              >
                &times;
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1200px;
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
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .new-project-form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 2rem;
  }
  .new-project-form input {
    flex: 1;
  }

  .filters {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .search-input {
    flex: 0 1 280px;
    min-width: 180px;
  }
  .status-filters {
    display: flex;
    gap: 0.25rem;
  }
  .filter-btn {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
    text-transform: capitalize;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .filter-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .filter-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  .empty-state code {
    font-family: var(--font-mono);
    background: var(--bg-card);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }
  .project-card-wrapper {
    position: relative;
  }
  .project-card {
    display: block;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    transition: all 0.15s ease;
    color: var(--text);
  }
  .project-card:hover {
    border-color: var(--accent);
    background: var(--bg-hover);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .card-header h3 {
    font-size: 1rem;
    font-weight: 600;
  }
  .card-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .template {
    font-family: var(--font-mono);
  }
  .card-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }
  .tag {
    font-size: 0.7rem;
    color: var(--accent);
    background: var(--accent-subtle);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .card-actions {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .delete-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
    font-size: 1rem;
    padding: 0.15rem 0.4rem;
    line-height: 1;
  }
  .project-card-wrapper:hover .delete-btn {
    opacity: 0.6;
  }
  .delete-btn:hover {
    opacity: 1 !important;
    color: var(--danger);
  }
  .btn-ghost-sm {
    font-size: 0.7rem;
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
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: var(--danger);
    color: white;
  }
  .btn-danger-sm:hover {
    background: var(--danger);
  }
  .confirm-text {
    font-size: 0.7rem;
    color: var(--danger);
  }
</style>
