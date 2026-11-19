<!--
  Graph settings panel — floating glassmorphism overlay. Defaults to the
  architecture graph; another graph passes its palette, filters, settings and
  reset (see routes/map).

  Uses reusable snippets for control rows. To add a new setting:
  1. Add the field to architecture-settings.svelte.ts DEFAULTS
  2. Drop a {@render sliderRow(...)} or {@render switchRow(...)} in the right section
  3. Done — grid auto-aligns everything.
-->
<script lang="ts">
  import {
    archSettings,
    archFilters,
    openSections,
    resetSettings,
    toggleSection,
    type ArchSettings,
  } from '$lib/stores/architecture-settings.svelte'
  import { ARCH_PALETTE, type GraphFilters, type GraphPalette } from './constants'

  let {
    palette = ARCH_PALETTE,
    filters = archFilters,
    settings = archSettings,
    onreset = resetSettings,
  }: {
    palette?: GraphPalette
    filters?: GraphFilters
    settings?: ArchSettings
    onreset?: () => void
  } = $props()

  function selectAll(group: 'nodes' | 'edges', value: boolean) {
    const target = filters[group]
    Object.keys(target).forEach((type) => (target[type] = value))
  }
</script>

<!-- ── Reusable snippet components ─────────────────────────────── -->

{#snippet sliderRow(label: string, value: number, min: number, max: number, step: number, display: string, onchange: (v: number) => void)}
  <div class="s-row">
    <span class="s-label">{label}</span>
    <input type="range" class="s-slider" {min} {max} {step} {value}
      oninput={(e: Event) => onchange(Number((e.target as HTMLInputElement).value))} />
    <span class="s-value">{display}</span>
  </div>
{/snippet}

{#snippet switchRow(label: string, checked: boolean, onchange: (v: boolean) => void)}
  <div class="s-row">
    <span class="s-label">{label}</span>
    <label class="s-switch">
      <input type="checkbox" {checked}
        onchange={(e: Event) => onchange((e.target as HTMLInputElement).checked)} />
      <span class="s-switch-track"></span>
    </label>
  </div>
{/snippet}

{#snippet toggleRow(label: string, options: Array<{label: string, active: boolean, onclick: () => void, title?: string}>, compact?: boolean)}
  <div class="s-row">
    <span class="s-label">{label}</span>
    <div class="s-toggle-group">
      {#each options as opt}
        <button class="s-tog" class:sm={compact} class:active={opt.active}
          onclick={opt.onclick} title={opt.title}>{opt.label}</button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet filterChips(labels: Record<string, string>, colors: Record<string, string>, filters: Record<string, boolean>, style: 'dot' | 'line')}
  <div class="s-filter-grid">
    {#each Object.entries(labels) as [type, label]}
      <label class="s-filter-item" class:active={filters[type]}>
        <input type="checkbox" bind:checked={filters[type]} />
        {#if style === 'dot'}
          <span class="s-filter-dot" style="background: {colors[type]}"></span>
        {:else}
          <span class="s-filter-line" style="background: {colors[type]}"></span>
        {/if}
        <span class="s-filter-label">{label}</span>
      </label>
    {/each}
  </div>
{/snippet}

<!-- ── Panel markup ────────────────────────────────────────────── -->

<div class="settings-panel">
  <div class="settings-head">
    <span class="settings-title">Settings</span>
    <button class="reset-btn" onclick={onreset}>Reset</button>
  </div>
  <div class="settings-scroll">
    <div class="settings-body">

      <!-- Layout -->
      <div class="s-section" class:open={openSections.layout}>
        <button class="s-section-toggle" onclick={() => toggleSection('layout')}>
          <span class="s-chevron">{openSections.layout ? '\u25BE' : '\u25B8'}</span>
          Layout
        </button>
        {#if openSections.layout}
          <div class="s-section-body">
            {#if settings.viewMode === '2d'}
              {@render toggleRow('Mode', [
                { label: 'Hierarchy', active: settings.layoutMode === 'dagre', onclick: () => (settings.layoutMode = 'dagre') },
                { label: 'Force', active: settings.layoutMode === 'cose', onclick: () => (settings.layoutMode = 'cose') },
              ])}
              {#if settings.layoutMode === 'dagre'}
                {@render toggleRow('Direction', [
                  { label: '\u2193', active: settings.dagDirection === 'TB', onclick: () => (settings.dagDirection = 'TB'), title: 'Top to Bottom' },
                  { label: '\u2192', active: settings.dagDirection === 'LR', onclick: () => (settings.dagDirection = 'LR'), title: 'Left to Right' },
                  { label: '\u2191', active: settings.dagDirection === 'BT', onclick: () => (settings.dagDirection = 'BT'), title: 'Bottom to Top' },
                  { label: '\u2190', active: settings.dagDirection === 'RL', onclick: () => (settings.dagDirection = 'RL'), title: 'Right to Left' },
                ], true)}
              {/if}
            {/if}
            {@render sliderRow('Spacing', settings.spacing, 0.5, 5, 0.1, settings.spacing.toFixed(1), (v) => (settings.spacing = v))}
            {#if settings.viewMode === '2d' && settings.layoutMode === 'cose'}
              {@render sliderRow('Gravity', settings.gravity, 0.01, 1, 0.01, settings.gravity.toFixed(2), (v) => (settings.gravity = v))}
            {/if}
            {@render sliderRow('Repulsion', settings.repulsion, 1000, 20000, 500, (settings.repulsion / 1000).toFixed(1) + 'k', (v) => (settings.repulsion = v))}
            {#if settings.viewMode === '2d'}
              {@render switchRow('Animate', settings.animateLayout, (v) => (settings.animateLayout = v))}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Nodes -->
      <div class="s-section" class:open={openSections.nodes}>
        <button class="s-section-toggle" onclick={() => toggleSection('nodes')}>
          <span class="s-chevron">{openSections.nodes ? '\u25BE' : '\u25B8'}</span>
          Nodes
          <span class="s-section-actions">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <span class="s-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); selectAll('nodes', true) }}>all</span>
            <span class="s-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); selectAll('nodes', false) }}>none</span>
          </span>
        </button>
        {#if openSections.nodes}
          <div class="s-section-body">
            {@render filterChips(palette.nodeLabels, palette.nodeColors, filters.nodes, 'dot')}
            {@render sliderRow('Size', settings.nodeSize, 10, 60, 1, String(settings.nodeSize), (v) => (settings.nodeSize = v))}
            {@render switchRow('Labels', settings.showLabels, (v) => (settings.showLabels = v))}
            {#if settings.showLabels}
              {@render sliderRow('Label size', settings.labelSize, 6, 20, 1, String(settings.labelSize), (v) => (settings.labelSize = v))}
            {/if}
            {#if settings.viewMode === '2d'}
              {@render switchRow('Groups', settings.showGroups, (v) => (settings.showGroups = v))}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Edges -->
      <div class="s-section" class:open={openSections.edges}>
        <button class="s-section-toggle" onclick={() => toggleSection('edges')}>
          <span class="s-chevron">{openSections.edges ? '\u25BE' : '\u25B8'}</span>
          Edges
          <span class="s-section-actions">
            <span class="s-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); selectAll('edges', true) }}>all</span>
            <span class="s-link" role="button" tabindex="0" onclick={(e: MouseEvent) => { e.stopPropagation(); selectAll('edges', false) }}>none</span>
          </span>
        </button>
        {#if openSections.edges}
          <div class="s-section-body">
            {@render filterChips(palette.edgeLabels, palette.edgeColors, filters.edges, 'line')}
            {@render sliderRow('Opacity', settings.edgeOpacity, 0.05, 1, 0.05, (settings.edgeOpacity * 100).toFixed(0) + '%', (v) => (settings.edgeOpacity = v))}
            {@render sliderRow('Width', settings.edgeWidth, 0.5, 5, 0.25, settings.edgeWidth.toFixed(1), (v) => (settings.edgeWidth = v))}
            {@render switchRow('Arrows', settings.showArrows, (v) => (settings.showArrows = v))}
            {#if settings.viewMode === '2d'}
              {@render switchRow('Edge labels', settings.showEdgeLabels, (v) => (settings.showEdgeLabels = v))}
            {/if}
          </div>
        {/if}
      </div>

      <!-- 3D Effects -->
      {#if settings.viewMode === '3d'}
        <div class="s-section" class:open={openSections.effects}>
          <button class="s-section-toggle" onclick={() => toggleSection('effects')}>
            <span class="s-chevron">{openSections.effects ? '\u25BE' : '\u25B8'}</span>
            3D Effects
          </button>
          {#if openSections.effects}
            <div class="s-section-body">
              {@render switchRow('Particles', settings.showParticles, (v) => (settings.showParticles = v))}
              {#if settings.showParticles}
                {@render sliderRow('Speed', settings.particleSpeed, 0.001, 0.02, 0.001, String((settings.particleSpeed * 1000).toFixed(0)), (v) => (settings.particleSpeed = v))}
                {@render sliderRow('Density', settings.particleDensity, 1, 8, 1, String(settings.particleDensity), (v) => (settings.particleDensity = v))}
              {/if}
              {@render sliderRow('Link curve', settings.linkCurvature, 0, 0.5, 0.05, settings.linkCurvature.toFixed(2), (v) => (settings.linkCurvature = v))}
              {@render sliderRow('Glow', settings.glowStrength, 0, 1, 0.05, (settings.glowStrength * 100).toFixed(0) + '%', (v) => (settings.glowStrength = v))}
              {@render sliderRow('Resolution', settings.nodeResolution, 4, 32, 2, String(settings.nodeResolution), (v) => (settings.nodeResolution = v))}
              <div class="s-row">
                <span class="s-label">Background</span>
                <input type="color" class="s-color" bind:value={settings.bgColor} />
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>
</div>

<style>
  /* ── Settings panel (floating overlay) ── */
  .settings-panel {
    position: absolute;
    top: 8px;
    left: 8px;
    bottom: 8px;
    width: 310px;
    background: rgba(10, 10, 15, 0.88);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    z-index: 15;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* Fixed header */
  .settings-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .settings-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  .reset-btn {
    font-size: 0.62rem;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.15rem 0.35rem;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .reset-btn:hover { background: var(--accent-subtle); }

  /* Scroll container — no padding, scrollbar flush to edge */
  .settings-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .settings-scroll::-webkit-scrollbar { width: 5px; }
  .settings-scroll::-webkit-scrollbar-track { background: transparent; }
  .settings-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  .settings-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

  /* Inner body — no horizontal padding (children carry their own) */
  .settings-body {
    padding: 0.25rem 0 0.75rem;
    display: flex;
    flex-direction: column;
  }

  /* ── Accordion ── */
  .s-section {
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .s-section:last-child { border-bottom: none; }

  .s-section-toggle {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    padding: 0.55rem 1.25rem 0.55rem 1rem;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 0.15s;
  }
  .s-section-toggle:hover { color: var(--text); }
  .s-section.open .s-section-toggle { color: var(--text); }

  .s-chevron {
    font-size: 0.6rem;
    width: 10px;
    display: inline-flex;
    justify-content: center;
    color: var(--text-muted);
  }

  .s-section-actions {
    display: flex;
    gap: 0.4rem;
    margin-left: auto;
  }
  .s-link {
    font-size: 0.6rem;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    text-transform: lowercase;
    padding: 0.1rem 0.15rem;
  }
  .s-link:hover { text-decoration: underline; }

  .s-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1.25rem 0.5rem 1rem;
  }

  /* ── Row (CSS Grid — core layout primitive) ── */
  .s-row {
    display: grid;
    grid-template-columns: 80px 1fr 36px;
    align-items: center;
    gap: 0 0.6rem;
    min-height: 26px;
  }
  .s-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .s-value {
    font-size: 0.64rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    text-align: right;
    white-space: nowrap;
  }

  /* ── Slider ── */
  .s-slider {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: 3px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    outline: none;
  }
  .s-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--bg-card);
  }
  .s-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    border: 2px solid var(--bg-card);
  }

  /* ── Toggle group ── */
  .s-toggle-group {
    grid-column: 2 / -1;
    display: flex;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 5px;
    overflow: hidden;
  }
  .s-tog {
    flex: 1;
    padding: 0.25rem 0.45rem;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.66rem;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .s-tog.sm { flex: 0; padding: 0.25rem 0.55rem; font-size: 0.75rem; }
  .s-tog.active { background: var(--accent); color: #fff; }
  .s-tog:not(.active):hover { background: rgba(255,255,255,0.05); }

  /* ── Switch ── */
  .s-switch { position: relative; cursor: pointer; }
  .s-switch input { display: none; }
  .s-switch-track {
    display: block;
    width: 28px;
    height: 16px;
    border-radius: 8px;
    background: rgba(255,255,255,0.1);
    transition: background 0.2s;
    position: relative;
  }
  .s-switch-track::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }
  .s-switch input:checked + .s-switch-track { background: var(--accent); }
  .s-switch input:checked + .s-switch-track::after { transform: translateX(12px); }

  /* ── Filter chips ── */
  .s-filter-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }
  .s-filter-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 0.66rem;
    color: var(--text-muted);
  }
  .s-filter-item input { display: none; }
  .s-filter-item.active {
    border-color: rgba(255,255,255,0.15);
    color: var(--text);
    background: rgba(255,255,255,0.04);
  }
  .s-filter-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .s-filter-line {
    width: 12px;
    height: 2px;
    border-radius: 1px;
    flex-shrink: 0;
  }
  .s-filter-label { white-space: nowrap; }

  /* ── Color picker ── */
  .s-color {
    width: 32px;
    height: 24px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    background: none;
    cursor: pointer;
    padding: 0;
  }
  .s-color::-webkit-color-swatch-wrapper { padding: 1px; }
  .s-color::-webkit-color-swatch { border: none; border-radius: 3px; }
</style>
