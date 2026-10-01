<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'

  let name = $state('')
  let greeting = $state('')

  async function greet(event: SubmitEvent) {
    event.preventDefault()
    try {
      // UI → shell → crates/core: the UI only ever talks to Rust through commands
      greeting = await invoke<string>('greet', { name })
    } catch {
      greeting = 'Not running inside Tauri — start the app with `npm run dev`.'
    }
  }
</script>

<main>
  <h1>__APP_NAME__</h1>
  <p class="muted">Tauri 2 · Svelte 5 · Rust core crate</p>

  <form onsubmit={greet}>
    <input bind:value={name} placeholder="Your name" aria-label="Your name" />
    <button type="submit">Greet</button>
  </form>

  {#if greeting}
    <p class="greeting">{greeting}</p>
  {/if}
</main>

<style>
  main {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-3);
  }

  h1 {
    margin: 0 0 var(--space-1);
  }

  .muted {
    color: var(--color-text-muted);
    margin: 0 0 var(--space-4);
  }

  form {
    display: flex;
    gap: var(--space-2);
  }

  input {
    flex: 1;
  }

  .greeting {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }
</style>
