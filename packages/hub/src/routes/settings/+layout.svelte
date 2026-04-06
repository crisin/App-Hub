<script>
  import { page } from '$app/state'

  let { children } = $props()

  const sections = [
    { href: '/settings/interface', label: 'Interface', icon: '&#x25D1;' },
    { href: '/settings/auth', label: 'Auth & Users', icon: '&#x1F512;' },
  ]
</script>

<div class="settings-page">
  <header class="page-header">
    <h1>Settings</h1>
    <p class="subtitle">Configure your App Hub instance</p>
  </header>

  <div class="settings-layout">
    <nav class="settings-nav">
      {#each sections as section}
        <a
          href={section.href}
          class="settings-nav-link"
          class:active={page.url.pathname === section.href}
        >
          <span>{@html section.icon}</span>
          {section.label}
        </a>
      {/each}
    </nav>
    <div class="settings-content">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .settings-page {
    max-width: 1000px;
  }
  .page-header {
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

  .settings-layout {
    display: flex;
    gap: 2rem;
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 180px;
  }

  .settings-nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 0.875rem;
    transition: all 0.15s ease;
  }
  .settings-nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .settings-nav-link.active {
    background: var(--bg-hover);
    color: var(--text);
    font-weight: 500;
  }

  .settings-content {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
  }
</style>
