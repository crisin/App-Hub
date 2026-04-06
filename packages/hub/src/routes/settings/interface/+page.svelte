<script lang="ts">
  import { browser } from '$app/environment'
  import { invalidateAll } from '$app/navigation'
  import {
    THEME_PRESETS,
    DENSITY_SCALES,
    DEFAULT_THEME_CONFIG,
    buildThemeCSS,
    type ThemeConfig,
    type UIDensity,
  } from '$lib/themes'

  let { data } = $props()
  let config = $state<ThemeConfig>({ ...DEFAULT_THEME_CONFIG })
  $effect(() => {
    config = { ...DEFAULT_THEME_CONFIG, ...data.themeConfig }
  })
  let saving = $state(false)

  function applyLive() {
    if (!browser) return
    document.documentElement.setAttribute('data-theme', config.mode)
    document.documentElement.style.cssText = buildThemeCSS(config)
    localStorage.setItem('apphub-theme', config.mode)
  }

  async function save() {
    saving = true
    applyLive()
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig: JSON.stringify(config) }),
      })
      await invalidateAll()
    } finally {
      saving = false
    }
  }

  function setPreset(presetId: string) {
    config = { ...config, preset: presetId }
    save()
  }

  function setMode(mode: 'dark' | 'light') {
    config = { ...config, mode }
    save()
  }

  function setDensity(density: UIDensity) {
    config = { ...config, density }
    save()
  }

  function setRadius(e: Event) {
    const value = parseInt((e.target as HTMLInputElement).value)
    config = { ...config, radius: value }
    applyLive()
  }

  function saveRadius() {
    save()
  }

  function setAccent(e: Event) {
    const value = (e.target as HTMLInputElement).value
    config = { ...config, accentOverride: value }
    applyLive()
  }

  function saveAccent() {
    save()
  }

  function clearAccent() {
    config = { ...config, accentOverride: undefined }
    save()
  }

  function toggleTranslucent() {
    config = { ...config, translucent: !config.translucent }
    save()
  }

  function resetAll() {
    config = { ...DEFAULT_THEME_CONFIG }
    save()
  }

  let activePreset = $derived(THEME_PRESETS.find((p) => p.id === config.preset) ?? THEME_PRESETS[0])
</script>

<div class="interface-settings">
  <div class="section-header">
    <h2>Interface</h2>
    <button class="btn-ghost btn-xs" onclick={resetAll}>Reset to Defaults</button>
  </div>

  <!-- Theme Presets -->
  <div class="setting-group">
    <div class="setting-label">Theme</div>
    <div class="setting-desc">Color palette for the interface</div>
    <div class="preset-grid">
      {#each THEME_PRESETS as preset}
        {@const colors = config.mode === 'dark' ? preset.dark : preset.light}
        <button
          class="preset-card"
          class:selected={config.preset === preset.id}
          onclick={() => setPreset(preset.id)}
        >
          <div class="preset-preview" style="background: {colors.bg}">
            <div class="preview-bar" style="background: {colors.accent}"></div>
            <div class="preview-lines">
              <div class="preview-line" style="background: {colors.border}"></div>
              <div class="preview-line short" style="background: {colors.border}"></div>
            </div>
            <div class="preview-dot" style="background: {colors.text}"></div>
          </div>
          <span class="preset-name">{preset.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Mode -->
  <div class="setting-group">
    <div class="setting-label">Mode</div>
    <div class="setting-desc">Dark or light appearance for the active theme</div>
    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={config.mode === 'dark'}
        onclick={() => setMode('dark')}
      >
        <span class="mode-icon">&#x263E;</span> Dark
      </button>
      <button
        class="mode-btn"
        class:active={config.mode === 'light'}
        onclick={() => setMode('light')}
      >
        <span class="mode-icon">&#x2600;</span> Light
      </button>
    </div>
  </div>

  <!-- Accent Color -->
  <div class="setting-group">
    <div class="setting-label">Accent Color</div>
    <div class="setting-desc">Override the theme's accent color</div>
    <div class="accent-row">
      <input
        type="color"
        class="color-picker"
        value={config.accentOverride || activePreset[config.mode].accent}
        oninput={setAccent}
        onchange={saveAccent}
      />
      <code class="accent-value">{config.accentOverride || activePreset[config.mode].accent}</code>
      {#if config.accentOverride}
        <button class="btn-ghost btn-xs" onclick={clearAccent}>Reset</button>
      {/if}
    </div>
  </div>

  <!-- UI Density -->
  <div class="setting-group">
    <div class="setting-label">Density</div>
    <div class="setting-desc">Adjust spacing and font size</div>
    <div class="density-options">
      {#each Object.keys(DENSITY_SCALES) as d}
        <button
          class="density-btn"
          class:active={config.density === d}
          onclick={() => setDensity(d as UIDensity)}
        >
          {d}
        </button>
      {/each}
    </div>
  </div>

  <!-- Border Radius -->
  <div class="setting-group">
    <div class="setting-label">Border Radius</div>
    <div class="setting-desc">Roundness of UI elements — {config.radius}px</div>
    <div class="slider-row">
      <span class="slider-label">0</span>
      <input
        type="range"
        min="0"
        max="20"
        step="1"
        value={config.radius}
        oninput={setRadius}
        onchange={saveRadius}
        class="slider"
      />
      <span class="slider-label">20</span>
      <div class="radius-preview" style="border-radius: {config.radius}px"></div>
    </div>
  </div>

  <!-- Translucency -->
  <div class="setting-group">
    <div class="setting-label">Translucency</div>
    <div class="setting-desc">Frosted glass effect on sidebar and cards</div>
    <button class="toggle-btn" class:active={config.translucent} onclick={toggleTranslucent}>
      <span class="toggle-track">
        <span class="toggle-thumb"></span>
      </span>
      <span>{config.translucent ? 'On' : 'Off'}</span>
    </button>
  </div>

  {#if saving}
    <p class="save-status">Saving...</p>
  {/if}
</div>

<style>
  .interface-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 1.15rem;
    font-weight: 600;
    margin: 0;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .setting-label {
    font-size: 0.9rem;
    font-weight: 500;
  }
  .setting-desc {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  /* Preset grid */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }
  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    background: none;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s ease;
  }
  .preset-card:hover {
    border-color: var(--text-muted);
  }
  .preset-card.selected {
    border-color: var(--accent);
  }
  .preset-preview {
    width: 100%;
    height: 56px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }
  .preview-bar {
    width: 100%;
    height: 5px;
    border-radius: 2px;
  }
  .preview-lines {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .preview-line {
    width: 100%;
    height: 3px;
    border-radius: 1px;
    opacity: 0.5;
  }
  .preview-line.short {
    width: 55%;
  }
  .preview-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    opacity: 0.4;
  }
  .preset-name {
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 0.25rem 0;
  }

  /* Mode toggle */
  .mode-toggle {
    display: flex;
    gap: 0.35rem;
  }
  .mode-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .mode-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .mode-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .mode-icon {
    font-size: 1rem;
  }

  /* Accent color */
  .accent-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .color-picker {
    width: 36px;
    height: 36px;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    padding: 2px;
    background: var(--bg);
  }
  .color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color-picker::-webkit-color-swatch {
    border: none;
    border-radius: calc(var(--radius) - 4px);
  }
  .accent-value {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* Density */
  .density-options {
    display: flex;
    gap: 0.35rem;
  }
  .density-btn {
    padding: 0.35rem 0.7rem;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.78rem;
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .density-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .density-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  /* Slider */
  .slider-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .slider-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    min-width: 1.5rem;
    text-align: center;
  }
  .slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--bg-card);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .radius-preview {
    width: 32px;
    height: 32px;
    background: var(--accent);
    flex-shrink: 0;
    transition: border-radius 0.1s ease;
  }

  /* Toggle */
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .toggle-track {
    display: inline-flex;
    align-items: center;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--border);
    padding: 2px;
    transition: background 0.2s ease;
  }
  .toggle-btn.active .toggle-track {
    background: var(--accent);
  }
  .toggle-thumb {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s ease;
  }
  .toggle-btn.active .toggle-thumb {
    transform: translateX(16px);
  }

  /* Misc */
  .btn-xs {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }

  .save-status {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
