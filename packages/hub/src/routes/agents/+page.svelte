<script lang="ts">
  let { data } = $props()

  let selectedSlug = $state<string | null>(null)
  let prompt = $state('')
  let running = $state(false)
  let result = $state<{ text: string; model: string; durationMs: number } | null>(null)
  let error = $state<string | null>(null)
  let showPrompt = $state(false)

  let selected = $derived(data.agents.find((a) => a.slug === selectedSlug) ?? null)

  function selectAgent(slug: string) {
    if (selectedSlug === slug) {
      selectedSlug = null
    } else {
      selectedSlug = slug
      result = null
      error = null
      showPrompt = false
    }
  }

  async function runAgent() {
    if (!selected || !prompt.trim() || running) return
    running = true
    result = null
    error = null
    try {
      const res = await fetch(`/api/agents/${selected.slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
      result = json.data
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      running = false
    }
  }
</script>

<div class="agents-page">
  <header class="page-header">
    <div>
      <h1>Agents</h1>
      <p class="subtitle">
        {data.agents.length} agent{data.agents.length !== 1 ? 's' : ''} — defined as markdown in
        <code>agents/</code>
      </p>
    </div>
  </header>

  <div class="providers-row">
    {#each data.providers as p}
      <div class="provider-chip" class:online={p.available}>
        <span class="dot"></span>
        <span class="provider-name">{p.name}</span>
        {#if p.available && p.models.length > 0}
          <span class="model-count">{p.models.length} models</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if data.agents.length === 0}
    <div class="empty-state">
      <p>No agents found.</p>
      <p class="hint">
        Add markdown files to <code>agents/</code> with frontmatter (provider, model) and a system
        prompt body.
      </p>
    </div>
  {:else}
    <div class="agent-grid">
      {#each data.agents as agent}
        <button
          class="agent-card"
          class:selected={selectedSlug === agent.slug}
          onclick={() => selectAgent(agent.slug)}
        >
          <div class="card-header">
            <h3>{agent.name}</h3>
            <code class="slug">{agent.slug}</code>
          </div>
          <p class="card-desc">{agent.description}</p>
          <div class="card-footer">
            <code class="model">{agent.provider}/{agent.model}</code>
          </div>
        </button>
      {/each}
    </div>

    {#if selected}
      <div class="run-panel">
        <div class="panel-header">
          <h2>Test run: {selected.name}</h2>
          <button class="link-btn" onclick={() => (showPrompt = !showPrompt)}>
            {showPrompt ? 'Hide' : 'Show'} system prompt
          </button>
        </div>
        {#if showPrompt}
          <pre class="system-prompt">{selected.systemPrompt}</pre>
        {/if}
        <textarea
          bind:value={prompt}
          placeholder="Prompt for {selected.name}..."
          rows="4"
          disabled={running}
        ></textarea>
        <div class="panel-actions">
          <button class="run-btn" onclick={runAgent} disabled={running || !prompt.trim()}>
            {running ? 'Running…' : 'Run'}
          </button>
          {#if running}
            <span class="hint">Local inference can take a while depending on the model…</span>
          {/if}
        </div>

        {#if error}
          <div class="result error">{error}</div>
        {/if}
        {#if result}
          <div class="result">
            <div class="result-meta">
              {result.model} · {Math.round(result.durationMs / 1000)}s
            </div>
            <pre class="result-text">{result.text}</pre>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .agents-page {
    max-width: 1200px;
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

  .providers-row {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .provider-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 9999px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .provider-chip .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  .provider-chip.online .dot {
    background: var(--success);
  }
  .provider-chip.online .provider-name {
    color: var(--text);
  }
  .model-count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .agent-card {
    text-align: left;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--text);
    font: inherit;
  }
  .agent-card:hover {
    border-color: var(--accent);
  }
  .agent-card.selected {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .card-header h3 {
    font-size: 1rem;
    font-weight: 600;
  }
  .slug {
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .card-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex: 1;
  }
  .card-footer .model {
    font-size: 0.7rem;
    color: var(--accent);
  }

  .run-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .panel-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
  }
  .link-btn:hover {
    color: var(--accent);
  }
  .system-prompt {
    background: var(--bg-inset);
    border-radius: var(--radius);
    padding: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: pre-wrap;
    max-height: 240px;
    overflow-y: auto;
  }
  textarea {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    padding: 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }
  .panel-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .run-btn {
    background: var(--accent);
    color: var(--bg, #fff);
    border: none;
    border-radius: var(--radius);
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .run-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .result {
    background: var(--bg-inset);
    border-radius: var(--radius);
    padding: 0.75rem;
  }
  .result.error {
    color: var(--danger);
    font-size: 0.85rem;
  }
  .result-meta {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    margin-bottom: 0.5rem;
  }
  .result-text {
    font-size: 0.85rem;
    white-space: pre-wrap;
    font-family: inherit;
  }
</style>
