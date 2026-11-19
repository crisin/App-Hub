<!--
  Reader for one kosmos page — a drawer over the right side of the map.

  The page comes rendered from /api/kosmos/page. Links between kosmos pages
  stay inside the reader (and move the selection on the map); links to pages
  the map may not read are named instead of followed.
-->
<script lang="ts">
  interface KosmosPage {
    id: string
    title: string
    type: string
    html: string
  }

  let {
    pageId,
    isKnown,
    onclose,
    onnavigate,
  }: {
    pageId: string
    /** Is this page id on the map? */
    isKnown: (id: string) => boolean
    onclose: () => void
    onnavigate: (id: string) => void
  } = $props()

  let page = $state<KosmosPage | null>(null)
  let error = $state('')
  let notice = $state('')
  let body: HTMLDivElement | undefined = $state()

  $effect(() => {
    const id = pageId
    let stale = false
    error = ''
    notice = ''
    fetch(`/api/kosmos/page?id=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((res) => {
        if (stale) return
        if (res.ok) {
          page = res.data
          body?.scrollTo({ top: 0 })
        } else {
          page = null
          error = res.error ?? 'Could not load the page'
        }
      })
      .catch((e) => {
        if (!stale) error = String(e)
      })
    return () => {
      stale = true
    }
  })

  /** A link's href → kosmos page id, relative to the page that is open */
  function resolve(href: string): string {
    let clean = href.split('#')[0].split('?')[0]
    try {
      clean = decodeURIComponent(clean)
    } catch {
      // keep the raw href
    }
    const from = clean.startsWith('/') ? [] : pageId.split('/').slice(0, -1)
    const parts: string[] = [...from]
    for (const segment of clean.split('/')) {
      if (segment === '..') parts.pop()
      else if (segment && segment !== '.') parts.push(segment)
    }
    return parts.join('/')
  }

  function handleClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest('a')
    const href = link?.getAttribute('href') ?? ''
    if (!link || !href || href.startsWith('#')) return
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      link.target = '_blank'
      link.rel = 'noreferrer'
      return
    }
    event.preventDefault()
    const id = resolve(href)
    if (isKnown(id)) onnavigate(id)
    else notice = `Not on the map: ${id}`
  }
</script>

<aside class="reader">
  <div class="reader-head">
    <span class="reader-path">{pageId}</span>
    <button class="reader-close" onclick={onclose} title="Close">&times;</button>
  </div>

  {#if notice}
    <div class="reader-notice">{notice}</div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="reader-body" bind:this={body} onclick={handleClick}>
    {#if error}
      <p class="reader-error">{error}</p>
    {:else if page}
      {@html page.html}
    {:else}
      <p class="reader-muted">Loading…</p>
    {/if}
  </div>
</aside>

<style>
  .reader {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(620px, 62%);
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    z-index: 30;
    display: flex;
    flex-direction: column;
    box-shadow: -12px 0 32px rgba(0, 0, 0, 0.35);
  }
  .reader-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem 0.5rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .reader-path {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reader-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }
  .reader-close:hover {
    color: var(--text);
    background: var(--bg-hover);
  }
  .reader-notice {
    padding: 0.4rem 1.25rem;
    font-size: 0.75rem;
    color: var(--warning);
    background: var(--warning-subtle);
    border-bottom: 1px solid var(--border);
  }
  .reader-error {
    color: var(--danger);
  }
  .reader-muted {
    color: var(--text-muted);
  }

  .reader-body {
    overflow-y: auto;
    padding: 0.75rem 1.25rem 3rem;
    line-height: 1.6;
    font-size: 0.9rem;
  }
  .reader-body :global(h1) {
    font-size: 1.45rem;
    margin: 0.25rem 0 0.75rem;
  }
  .reader-body :global(h2) {
    font-size: 1.1rem;
    margin: 1.5rem 0 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .reader-body :global(h3) {
    font-size: 1rem;
    margin: 1.2rem 0 0.4rem;
  }
  .reader-body :global(a) {
    color: var(--accent-hover);
  }
  .reader-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg-inset);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }
  .reader-body :global(pre) {
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.45;
  }
  .reader-body :global(pre code) {
    background: none;
    padding: 0;
  }
  .reader-body :global(table) {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.85rem;
    margin: 0.75rem 0;
    display: block;
    overflow-x: auto;
  }
  .reader-body :global(th),
  .reader-body :global(td) {
    border: 1px solid var(--border);
    padding: 0.35rem 0.5rem;
    text-align: left;
    vertical-align: top;
  }
  .reader-body :global(th) {
    background: var(--bg-hover);
  }
  .reader-body :global(blockquote) {
    margin: 0.75rem 0;
    padding: 0.25rem 0.75rem;
    border-left: 3px solid var(--accent);
    color: var(--text-muted);
  }
  .reader-body :global(ul),
  .reader-body :global(ol) {
    padding-left: 1.3rem;
  }
</style>
