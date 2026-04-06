<script>
  import '../app.css'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'

  let { children, data } = $props()

  let currentPath = $derived($page.url.pathname)

  $effect(() => {
    if (browser) {
      const mode = data.theme || localStorage.getItem('apphub-theme') || 'dark'
      document.documentElement.setAttribute('data-theme', mode)
      localStorage.setItem('apphub-theme', mode)

      // Apply theme CSS overrides
      if (data.themeCSS) {
        document.documentElement.style.cssText = data.themeCSS
      }
    }
  })

  let projects = $derived(data.sidebarProjects ?? [])
  let showAllProjects = $state(false)
  let visibleProjects = $derived(showAllProjects ? projects : projects.slice(0, 6))
</script>

<div class="layout">
  <nav class="sidebar glass">
    <div class="logo">
      <span class="logo-icon">&#x2B22;</span>
      <span class="logo-text">App Hub</span>
    </div>
    <div class="nav-links">
      <a href="/" class="nav-link" class:active={currentPath === '/'}>
        <span>&#x25A3;</span> Dashboard
      </a>
      <a href="/board" class="nav-link" class:active={currentPath === '/board'}>
        <span>&#x25A7;</span> Board
      </a>
      <a href="/reviews" class="nav-link" class:active={currentPath === '/reviews'}>
        <span>&#x2714;</span> Reviews
      </a>
      <a href="/templates" class="nav-link" class:active={currentPath === '/templates'}>
        <span>&#x2B9E;</span> Templates
      </a>
      <a href="/logs" class="nav-link" class:active={currentPath === '/logs'}>
        <span>&#x2630;</span> Logs
      </a>
      <a href="/architecture" class="nav-link" class:active={currentPath === '/architecture'}>
        <span>&#x2B1F;</span> Architecture
      </a>
      <a href="/settings" class="nav-link" class:active={currentPath.startsWith('/settings')}>
        <span>&#x2699;</span> Settings
      </a>
    </div>

    {#if projects.length > 0}
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-title">Projects</span>
          <span class="section-count">{projects.length}</span>
        </div>
        {#each visibleProjects as proj}
          <a
            href="/project/{proj.slug}"
            class="nav-link project-link"
            class:active={currentPath === `/project/${proj.slug}`}
          >
            <span class="project-dot" style="background: {proj.color || 'var(--text-muted)'}"></span>
            <span class="project-name">{proj.icon || ''} {proj.name}</span>
            <span class="project-status-dot badge-{proj.status}"></span>
          </a>
        {/each}
        {#if projects.length > 6}
          <button class="show-all-btn" onclick={() => (showAllProjects = !showAllProjects)}>
            {showAllProjects ? 'Show less' : `+${projects.length - 6} more`}
          </button>
        {/if}
      </div>
    {/if}

    <div class="nav-footer">
      <span class="version">v0.1.0</span>
    </div>
  </nav>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .layout {
    display: flex;
    min-height: 100vh;
  }
  .sidebar {
    width: 220px;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem;
    margin-bottom: 2rem;
  }
  .logo-icon {
    font-size: 1.5rem;
    color: var(--accent);
  }
  .logo-text {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 0.875rem;
    transition: all 0.15s ease;
    text-decoration: none;
  }
  .nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .nav-link.active {
    background: var(--accent-subtle);
    color: var(--text);
  }

  /* Projects section */
  .sidebar-section {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.75rem;
    margin-bottom: 0.25rem;
  }
  .section-title {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .section-count {
    font-size: 0.6rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    background: var(--bg-inset);
    padding: 0.05rem 0.3rem;
    border-radius: 9999px;
  }

  .project-link {
    font-size: 0.8rem;
    padding: 0.35rem 0.75rem;
    gap: 0.4rem;
  }
  .project-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .project-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .project-status-dot.badge-active {
    background: var(--success);
  }
  .project-status-dot.badge-idea {
    background: var(--purple, #8b5cf6);
  }
  .project-status-dot.badge-paused {
    background: var(--warning);
  }
  .project-status-dot.badge-completed {
    background: var(--info);
  }
  .project-status-dot.badge-archived {
    background: var(--text-muted);
  }

  .show-all-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.7rem;
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    text-align: left;
  }
  .show-all-btn:hover {
    color: var(--accent);
  }

  .nav-footer {
    margin-top: auto;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .version {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .content {
    flex: 1;
    margin-left: 220px;
    padding: 2rem;
  }

  /* Scrollbar for sidebar */
  .sidebar::-webkit-scrollbar {
    width: 3px;
  }
  .sidebar::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }
</style>
