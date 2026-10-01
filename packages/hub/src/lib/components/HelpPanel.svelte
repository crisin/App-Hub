<script lang="ts">
  /**
   * Help panel — renders the repo's docs/ folder as an in-app wiki.
   * Opens on the article that explains the current page (frontmatter `routes`),
   * follows relative .md links in place, keeps a back stack.
   */
  interface DocMeta {
    path: string
    title: string
    section: string
    order: number
    summary: string
    routes: string[]
  }
  interface DocPage extends DocMeta {
    html: string
  }

  let { open = $bindable(false), route = '/' }: { open?: boolean; route?: string } = $props()

  let sections = $state<string[]>([])
  let docs = $state<DocMeta[]>([])
  let page = $state<DocPage | null>(null)
  let view = $state<'article' | 'contents'>('article')
  let query = $state('')
  let backStack = $state<string[]>([])
  let error = $state('')
  let articleEl = $state<HTMLElement | null>(null)

  const STORAGE_KEY = 'apphub-help-doc'

  let grouped = $derived.by(() => {
    const q = query.trim().toLowerCase()
    const hits = q
      ? docs.filter((d) => `${d.title} ${d.summary} ${d.path}`.toLowerCase().includes(q))
      : docs
    const order = [...sections, ...new Set(hits.map((d) => d.section).filter((s) => !sections.includes(s)))]
    return order
      .map((section) => ({ section, items: hits.filter((d) => d.section === section) }))
      .filter((g) => g.items.length > 0)
  })

  async function api<T>(url: string): Promise<T> {
    const res = await fetch(url)
    const body = await res.json()
    if (!body.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
    return body.data as T
  }

  async function loadIndex(): Promise<string | null> {
    const data = await api<{ sections: string[]; docs: DocMeta[]; forRoute: string | null }>(
      `/api/docs?route=${encodeURIComponent(route)}`,
    )
    sections = data.sections
    docs = data.docs
    return data.forRoute
  }

  async function openDoc(path: string, pushHistory = true, anchor = '') {
    try {
      error = ''
      const next = await api<DocPage>(`/api/docs/${path}`)
      if (pushHistory && page && page.path !== next.path) backStack = [...backStack, page.path]
      page = next
      view = 'article'
      try {
        localStorage.setItem(STORAGE_KEY, path)
      } catch {
        /* storage unavailable — fine */
      }
      queueMicrotask(() => {
        if (!articleEl) return
        const target = anchor ? articleEl.querySelector(`#${CSS.escape(anchor)}`) : null
        if (target) target.scrollIntoView()
        else articleEl.scrollTop = 0
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  async function openForCurrentPage() {
    try {
      const forRoute = await loadIndex()
      if (forRoute) await openDoc(forRoute)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  function goBack() {
    const prev = backStack.at(-1)
    if (!prev) return
    backStack = backStack.slice(0, -1)
    openDoc(prev, false)
  }

  /** Follow links inside an article: relative .md → in the panel, external → new tab */
  function onArticleClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest('a')
    const href = link?.getAttribute('href')
    if (!link || !href) return
    if (/^https?:\/\//.test(href)) {
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      return
    }
    event.preventDefault()
    if (href.startsWith('#')) {
      articleEl?.querySelector(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView()
      return
    }
    const [file, anchor = ''] = href.split('#')
    if (!file.endsWith('.md')) return
    const resolved = new URL(file, `http://docs/${page?.path ?? ''}`).pathname.slice(1)
    openDoc(decodeURIComponent(resolved), true, anchor)
  }

  // First open: load the index, then the remembered article or the one for this page
  $effect(() => {
    if (!open || docs.length > 0) return
    ;(async () => {
      try {
        const forRoute = await loadIndex()
        let remembered: string | null = null
        try {
          remembered = localStorage.getItem(STORAGE_KEY)
        } catch {
          /* storage unavailable */
        }
        const start = forRoute ?? remembered
        if (start) await openDoc(start, false)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }
    })()
  })
</script>

{#if open}
  <aside class="help-panel" aria-label="Help">
    <header class="help-header">
      <div class="help-actions">
        <button class="icon-btn" onclick={goBack} disabled={backStack.length === 0} title="Back">&#x2190;</button>
        <button
          class="icon-btn"
          class:active={view === 'contents'}
          onclick={() => (view = view === 'contents' ? 'article' : 'contents')}
          title="Contents"
        >&#x2630;</button>
        <button class="text-btn" onclick={openForCurrentPage} title="Article for the page you are on">This page</button>
      </div>
      <button class="icon-btn" onclick={() => (open = false)} title="Close (Esc)">&times;</button>
    </header>

    {#if error}
      <p class="help-error">{error}</p>
    {/if}

    {#if view === 'contents'}
      <div class="help-contents">
        <input class="help-search" bind:value={query} placeholder="Search docs…" />
        {#each grouped as group (group.section)}
          <h4 class="toc-section">{group.section}</h4>
          {#each group.items as doc (doc.path)}
            <button class="toc-item" class:current={page?.path === doc.path} onclick={() => openDoc(doc.path)}>
              <span class="toc-title">{doc.title}</span>
              {#if doc.summary}<span class="toc-summary">{doc.summary}</span>{/if}
            </button>
          {/each}
        {/each}
      </div>
    {:else if page}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <article class="doc-body" bind:this={articleEl} onclick={onArticleClick}>
        <div class="doc-crumb">{page.section} · <code>docs/{page.path}</code></div>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML rendered server-side from the repo's own docs/, not user input -->
        {@html page.html}
      </article>
    {:else}
      <p class="help-empty">Loading…</p>
    {/if}
  </aside>
{/if}

<style>
  .help-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(500px, 100vw);
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    z-index: 60;
  }
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  .help-actions {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }
  .icon-btn,
  .text-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius);
    padding: 0.25rem 0.55rem;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .icon-btn.active,
  .icon-btn:not(:disabled):hover,
  .text-btn:hover {
    background: var(--accent-subtle);
    border-color: var(--accent);
  }
  .help-error {
    color: var(--danger);
    padding: 0.5rem 1rem;
    margin: 0;
  }
  .help-empty {
    color: var(--text-muted);
    padding: 1rem;
  }
  .help-contents {
    overflow-y: auto;
    padding: 0.75rem 1rem 2rem;
  }
  .help-search {
    width: 100%;
    margin-bottom: 0.5rem;
  }
  .toc-section {
    margin: 1rem 0 0.35rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .toc-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius);
    padding: 0.45rem 0.6rem;
    color: var(--text);
    cursor: pointer;
  }
  .toc-item:hover,
  .toc-item.current {
    background: var(--bg-hover);
    border-color: var(--border);
  }
  .toc-title {
    font-weight: 600;
  }
  .toc-summary {
    color: var(--text-muted);
    font-size: 0.82rem;
  }
  .doc-body {
    overflow-y: auto;
    padding: 0.75rem 1.25rem 3rem;
    line-height: 1.6;
  }
  .doc-crumb {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .doc-body :global(h1) {
    font-size: 1.45rem;
    margin: 0.25rem 0 0.75rem;
  }
  .doc-body :global(h2) {
    font-size: 1.1rem;
    margin: 1.5rem 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .doc-body :global(h3) {
    font-size: 1rem;
    margin: 1.2rem 0 0.4rem;
  }
  .doc-body :global(a) {
    color: var(--accent-hover);
  }
  .doc-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg-inset);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .doc-body :global(pre) {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.45;
  }
  .doc-body :global(pre code) {
    background: none;
    padding: 0;
  }
  .doc-body :global(table) {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.85rem;
    margin: 0.75rem 0;
    display: block;
    overflow-x: auto;
  }
  .doc-body :global(th),
  .doc-body :global(td) {
    border: 1px solid var(--border);
    padding: 0.35rem 0.5rem;
    text-align: left;
    vertical-align: top;
  }
  .doc-body :global(th) {
    background: var(--bg-hover);
  }
  .doc-body :global(blockquote) {
    margin: 0.75rem 0;
    padding: 0.25rem 0.75rem;
    border-left: 3px solid var(--accent);
    color: var(--text-muted);
  }
  .doc-body :global(ul),
  .doc-body :global(ol) {
    padding-left: 1.3rem;
  }
</style>
