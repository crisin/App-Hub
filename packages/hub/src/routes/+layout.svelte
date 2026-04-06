<script>
  import '../app.css'
  import { browser } from '$app/environment'

  let { children, data } = $props()

  $effect(() => {
    if (browser) {
      const theme = data.theme || localStorage.getItem('apphub-theme') || 'dark'
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('apphub-theme', theme)
    }
  })
</script>

<div class="layout">
  <nav class="sidebar">
    <div class="logo">
      <span class="logo-icon">&#x2B22;</span>
      <span class="logo-text">App Hub</span>
    </div>
    <div class="nav-links">
      <a href="/" class="nav-link">
        <span>&#x25A3;</span> Dashboard
      </a>
      <a href="/board" class="nav-link">
        <span>&#x25A7;</span> Board
      </a>
      <a href="/reviews" class="nav-link">
        <span>&#x2714;</span> Reviews
      </a>
      <a href="/templates" class="nav-link">
        <span>&#x2B9E;</span> Templates
      </a>
      <a href="/logs" class="nav-link">
        <span>&#x2630;</span> Logs
      </a>
      <a href="/settings" class="nav-link">
        <span>&#x2699;</span> Settings
      </a>
    </div>
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
  }
  .nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
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
</style>
