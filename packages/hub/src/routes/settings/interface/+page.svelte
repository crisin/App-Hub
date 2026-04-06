<script lang="ts">
  import { browser } from '$app/environment'

  let { data } = $props()
  let theme = $state('dark')
  $effect(() => {
    theme = data.theme
  })
  let saving = $state(false)

  function applyTheme(value: string) {
    if (browser) {
      document.documentElement.setAttribute('data-theme', value)
      localStorage.setItem('apphub-theme', value)
    }
  }

  async function setTheme(value: string) {
    theme = value
    applyTheme(value)
    saving = true
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: value }),
      })
    } finally {
      saving = false
    }
  }
</script>

<div class="interface-settings">
  <h2>Interface</h2>

  <div class="setting-group">
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">Theme</span>
        <span class="setting-desc">Choose the appearance of the application</span>
      </div>
      <div class="theme-options">
        <button
          class="theme-option"
          class:selected={theme === 'dark'}
          onclick={() => setTheme('dark')}
        >
          <span class="theme-preview dark-preview">
            <span class="preview-bar"></span>
            <span class="preview-line"></span>
            <span class="preview-line short"></span>
          </span>
          <span class="theme-name">Dark</span>
        </button>
        <button
          class="theme-option"
          class:selected={theme === 'light'}
          onclick={() => setTheme('light')}
        >
          <span class="theme-preview light-preview">
            <span class="preview-bar"></span>
            <span class="preview-line"></span>
            <span class="preview-line short"></span>
          </span>
          <span class="theme-name">Light</span>
        </button>
      </div>
    </div>
  </div>

  {#if saving}
    <p class="save-status">Saving...</p>
  {/if}
</div>

<style>
  .interface-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .setting-label {
    font-size: 0.9rem;
    font-weight: 500;
  }
  .setting-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .theme-options {
    display: flex;
    gap: 0.75rem;
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    background: none;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s ease;
  }
  .theme-option:hover {
    border-color: var(--text-muted);
  }
  .theme-option.selected {
    border-color: var(--accent);
  }

  .theme-preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100px;
    height: 64px;
    padding: 8px;
    border-radius: 0;
  }
  .dark-preview {
    background: #0a0a0f;
  }
  .light-preview {
    background: #f5f5f7;
  }

  .preview-bar {
    width: 100%;
    height: 6px;
    border-radius: 2px;
  }
  .dark-preview .preview-bar {
    background: #6366f1;
  }
  .light-preview .preview-bar {
    background: #4f46e5;
  }

  .preview-line {
    width: 100%;
    height: 4px;
    border-radius: 2px;
  }
  .preview-line.short {
    width: 60%;
  }
  .dark-preview .preview-line {
    background: #2a2a3a;
  }
  .light-preview .preview-line {
    background: #d1d1d6;
  }

  .theme-name {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.35rem 0;
  }

  .save-status {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
