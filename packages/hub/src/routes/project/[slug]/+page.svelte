<script lang="ts">
  import type { Task } from '@apphub/shared'

  let { data } = $props()
  let project = $derived(data.project)
  let newTaskTitle = $state('')
  let newTaskPriority = $state('medium')

  const statusColors: Record<string, string> = {
    idea: 'badge-idea',
    active: 'badge-active',
    paused: 'badge-paused',
    completed: 'badge-completed',
    archived: 'badge-archived',
  }

  const taskStatusLabels: Record<string, string> = {
    todo: 'Todo',
    in_progress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    const res = await fetch(`/api/projects/${project.slug}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle, priority: newTaskPriority }),
    })
    if (res.ok) {
      newTaskTitle = ''
      window.location.reload()
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/projects/${project.slug}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status }),
    })
    window.location.reload()
  }

  async function updateProjectStatus(status: string) {
    await fetch(`/api/projects/${project.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    window.location.reload()
  }
</script>

<div class="project-detail">
  <a href="/" class="back-link">&larr; All Projects</a>

  <header class="project-header">
    <div>
      <h1>{project.name}</h1>
      <p class="project-meta">
        <span class="badge {statusColors[project.status]}">{project.status}</span>
        <span class="template">{project.template}</span>
        <span class="date">Created {new Date(project.created).toLocaleDateString()}</span>
      </p>
    </div>
    <div class="status-actions">
      {#each ['idea', 'active', 'paused', 'completed', 'archived'] as status}
        <button
          class="btn-ghost status-btn"
          class:active={project.status === status}
          onclick={() => updateProjectStatus(status)}
        >
          {status}
        </button>
      {/each}
    </div>
  </header>

  {#if project.description}
    <p class="description">{project.description}</p>
  {/if}

  <section class="tasks-section">
    <h2>
      Tasks <span class="task-count">{project.taskSummary.done}/{project.taskSummary.total}</span>
    </h2>

    <div class="add-task">
      <input
        bind:value={newTaskTitle}
        placeholder="New task..."
        onkeydown={(e) => e.key === 'Enter' && addTask()}
      />
      <select bind:value={newTaskPriority}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
      <button class="btn-primary" onclick={addTask}>Add</button>
    </div>

    {#each ['todo', 'in_progress', 'done', 'blocked'] as status}
      {@const statusTasks = project.tasks.filter((t: Task) => t.status === status)}
      {#if statusTasks.length > 0}
        <div class="task-group">
          <h3>{taskStatusLabels[status]} <span class="count">({statusTasks.length})</span></h3>
          {#each statusTasks as task}
            <div class="task-item">
              <div class="task-info">
                <span class="task-title">{task.title}</span>
                <span class="badge badge-{task.priority}">{task.priority}</span>
              </div>
              <select
                value={task.status}
                onchange={(e) => updateTaskStatus(task.id, e.currentTarget.value)}
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </section>

  <section class="path-section">
    <code>{project.path}</code>
  </section>
</div>

<style>
  .project-detail {
    max-width: 900px;
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

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .project-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .template {
    font-family: var(--font-mono);
  }
  .status-actions {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .status-btn {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
    text-transform: capitalize;
  }
  .status-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .description {
    color: var(--text-muted);
    margin-bottom: 2rem;
    font-size: 0.9rem;
  }

  .tasks-section {
    margin-bottom: 2rem;
  }
  .tasks-section h2 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
  }
  .task-count {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 0.9rem;
  }

  .add-task {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .add-task input {
    flex: 1;
  }

  .task-group {
    margin-bottom: 1.5rem;
  }
  .task-group h3 {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  .count {
    font-weight: 400;
  }

  .task-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 0.35rem;
  }
  .task-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .task-title {
    font-size: 0.875rem;
  }

  .badge-low {
    background: var(--info-subtle);
    color: var(--info);
  }
  .badge-medium {
    background: var(--warning-subtle);
    color: var(--warning);
  }
  .badge-high {
    background: var(--danger-subtle);
    color: var(--danger);
  }
  .badge-critical {
    background: var(--danger);
    color: var(--text-inverse);
  }

  .path-section {
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .path-section code {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
