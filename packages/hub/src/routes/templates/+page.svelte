<script lang="ts">
  let { data } = $props();

  // Tag colors using CSS variable names — resolved at render time
  const tagColorVar: Record<string, string> = {
    mobile: 'var(--warning)',
    web: 'var(--info)',
    fullstack: 'var(--purple)',
    'react-native': 'var(--info)',
    expo: 'var(--text-muted)',
    nextjs: 'var(--text)',
    react: 'var(--info)',
    sveltekit: 'var(--danger)',
    svelte: 'var(--danger)',
    'local-first': 'var(--success)',
  };
</script>

<div class="templates-page">
  <header class="page-header">
    <div>
      <h1>Templates</h1>
      <p class="subtitle">{data.templates.length} available template{data.templates.length !== 1 ? 's' : ''}</p>
    </div>
  </header>

  {#if data.templates.length === 0}
    <div class="empty-state">
      <p>No templates found.</p>
      <p class="hint">Add template directories to <code>templates/</code> with a <code>template.json</code> config.</p>
    </div>
  {:else}
    <div class="template-grid">
      {#each data.templates as template}
        <div class="template-card">
          <div class="card-header">
            <h3>{template.name}</h3>
            <code class="slug">{template.slug}</code>
          </div>
          {#if template.description}
            <p class="card-desc">{template.description}</p>
          {/if}
          {#if template.tags.length > 0}
            <div class="card-tags">
              {#each template.tags as tag}
                <span class="tag" style="color: {tagColorVar[tag] ?? 'var(--accent)'}">#{tag}</span>
              {/each}
            </div>
          {/if}
          {#if template.postCreate}
            <div class="post-create">
              <span class="label">Post-create:</span>
              <code>{template.postCreate}</code>
            </div>
          {/if}
          <div class="card-footer">
            <code class="source">{template.source.includes('/') ? template.source.split('/').slice(-2).join('/') : template.source}</code>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .templates-page { max-width: 1200px; }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }
  h1 { font-size: 1.75rem; font-weight: 700; }
  .subtitle { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem; }

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
  .hint { margin-top: 0.5rem; font-size: 0.85rem; }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1rem;
  }
  .template-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-header h3 { font-size: 1.05rem; font-weight: 600; }
  .slug {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }
  .card-desc {
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .card-tags {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 0.7rem;
    background: var(--accent-subtle);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }
  .post-create {
    font-size: 0.75rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .post-create code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    background: var(--bg);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    color: var(--success);
  }
  .label { font-weight: 500; }
  .card-footer {
    margin-top: auto;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .source {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }
</style>
