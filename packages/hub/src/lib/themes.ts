/**
 * Theme presets — each defines CSS custom property overrides for dark and light modes.
 * Only overridden values need to be specified; missing values fall back to the base theme in app.css.
 */

export interface ThemeMode {
  /** Backgrounds */
  bg: string
  'bg-card': string
  'bg-hover': string
  'bg-inset': string

  /** Borders */
  border: string

  /** Text */
  text: string
  'text-muted': string

  /** Accent */
  accent: string
  'accent-hover': string
}

export interface ThemePreset {
  id: string
  name: string
  description: string
  dark: ThemeMode
  light: ThemeMode
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue-black, the default',
    dark: {
      bg: '#0a0a0f',
      'bg-card': '#12121a',
      'bg-hover': '#1a1a26',
      'bg-inset': '#08080d',
      border: '#2a2a3a',
      text: '#e4e4ef',
      'text-muted': '#8888a0',
      accent: '#6366f1',
      'accent-hover': '#818cf8',
    },
    light: {
      bg: '#f5f5f7',
      'bg-card': '#ffffff',
      'bg-hover': '#e8e8ed',
      'bg-inset': '#eaeaef',
      border: '#d1d1d6',
      text: '#1a1a2e',
      'text-muted': '#6b6b80',
      accent: '#4f46e5',
      'accent-hover': '#6366f1',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blue tones',
    dark: {
      bg: '#0b1120',
      'bg-card': '#111827',
      'bg-hover': '#1e293b',
      'bg-inset': '#070d1a',
      border: '#1e3a5f',
      text: '#e2e8f0',
      'text-muted': '#64748b',
      accent: '#0ea5e9',
      'accent-hover': '#38bdf8',
    },
    light: {
      bg: '#f0f9ff',
      'bg-card': '#ffffff',
      'bg-hover': '#e0f2fe',
      'bg-inset': '#e8f4fd',
      border: '#bae6fd',
      text: '#0c4a6e',
      'text-muted': '#475569',
      accent: '#0284c7',
      'accent-hover': '#0ea5e9',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Earthy greens',
    dark: {
      bg: '#0a120a',
      'bg-card': '#111f11',
      'bg-hover': '#1a2e1a',
      'bg-inset': '#060d06',
      border: '#1e3d1e',
      text: '#dceedd',
      'text-muted': '#6b9b6b',
      accent: '#22c55e',
      'accent-hover': '#4ade80',
    },
    light: {
      bg: '#f0fdf4',
      'bg-card': '#ffffff',
      'bg-hover': '#dcfce7',
      'bg-inset': '#e8f8ed',
      border: '#bbf7d0',
      text: '#14532d',
      'text-muted': '#4b7a5b',
      accent: '#16a34a',
      'accent-hover': '#22c55e',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm amber and orange',
    dark: {
      bg: '#120d08',
      'bg-card': '#1c1510',
      'bg-hover': '#2a1f16',
      'bg-inset': '#0d0905',
      border: '#3d2e1e',
      text: '#f5e6d3',
      'text-muted': '#a08060',
      accent: '#f59e0b',
      'accent-hover': '#fbbf24',
    },
    light: {
      bg: '#fffbeb',
      'bg-card': '#ffffff',
      'bg-hover': '#fef3c7',
      'bg-inset': '#fef8e0',
      border: '#fde68a',
      text: '#451a03',
      'text-muted': '#78716c',
      accent: '#d97706',
      'accent-hover': '#f59e0b',
    },
  },
  {
    id: 'rose',
    name: 'Rosé',
    description: 'Soft pink and crimson',
    dark: {
      bg: '#120a0e',
      'bg-card': '#1c1118',
      'bg-hover': '#2a1a24',
      'bg-inset': '#0d070a',
      border: '#3d1e30',
      text: '#f5e0eb',
      'text-muted': '#a06080',
      accent: '#f43f5e',
      'accent-hover': '#fb7185',
    },
    light: {
      bg: '#fff1f2',
      'bg-card': '#ffffff',
      'bg-hover': '#ffe4e6',
      'bg-inset': '#fce8ea',
      border: '#fecdd3',
      text: '#4c0519',
      'text-muted': '#9f1239',
      accent: '#e11d48',
      'accent-hover': '#f43f5e',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Cyberpunk green on black',
    dark: {
      bg: '#050505',
      'bg-card': '#0a0a0a',
      'bg-hover': '#141414',
      'bg-inset': '#020202',
      border: '#1a3a1a',
      text: '#00ff88',
      'text-muted': '#00994d',
      accent: '#00ff88',
      'accent-hover': '#33ffaa',
    },
    light: {
      bg: '#f0fff4',
      'bg-card': '#ffffff',
      'bg-hover': '#d1ffe0',
      'bg-inset': '#e0fce8',
      border: '#86efac',
      text: '#052e16',
      'text-muted': '#166534',
      accent: '#059669',
      'accent-hover': '#10b981',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Pure grayscale',
    dark: {
      bg: '#0a0a0a',
      'bg-card': '#141414',
      'bg-hover': '#1e1e1e',
      'bg-inset': '#050505',
      border: '#2e2e2e',
      text: '#e0e0e0',
      'text-muted': '#808080',
      accent: '#a0a0a0',
      'accent-hover': '#c0c0c0',
    },
    light: {
      bg: '#f5f5f5',
      'bg-card': '#ffffff',
      'bg-hover': '#e8e8e8',
      'bg-inset': '#ebebeb',
      border: '#d0d0d0',
      text: '#1a1a1a',
      'text-muted': '#666666',
      accent: '#505050',
      'accent-hover': '#707070',
    },
  },
]

/** UI density presets */
export type UIDensity = 'compact' | 'default' | 'comfortable'

export const DENSITY_SCALES: Record<UIDensity, { fontSize: string; spacing: string }> = {
  compact: { fontSize: '13px', spacing: '0.85' },
  default: { fontSize: '14px', spacing: '1' },
  comfortable: { fontSize: '15px', spacing: '1.15' },
}

/** Full theme config stored in settings */
export interface ThemeConfig {
  preset: string
  mode: 'dark' | 'light'
  accentOverride?: string // hex color to override accent
  density: UIDensity
  radius: number // px
  translucent: boolean // frosted glass effect
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  preset: 'midnight',
  mode: 'dark',
  density: 'default',
  radius: 8,
  translucent: false,
}

/** Convert a theme config into CSS custom property overrides */
export function buildThemeCSS(config: ThemeConfig): string {
  const preset = THEME_PRESETS.find((p) => p.id === config.preset) ?? THEME_PRESETS[0]
  const vars = config.mode === 'light' ? preset.light : preset.dark

  const lines: string[] = []

  // Apply preset colors
  for (const [key, value] of Object.entries(vars)) {
    lines.push(`--${key}: ${value}`)
  }

  // Generate subtle/muted variants from accent
  const accent = config.accentOverride || vars.accent
  if (config.accentOverride) {
    lines.push(`--accent: ${accent}`)
    // Lighten for hover
    lines.push(`--accent-hover: ${lightenHex(accent, 20)}`)
  }
  lines.push(`--accent-subtle: ${hexToRgba(accent, 0.1)}`)
  lines.push(`--accent-muted: ${hexToRgba(accent, 0.25)}`)

  // Radius
  lines.push(`--radius: ${config.radius}px`)

  // Density
  const density = DENSITY_SCALES[config.density] ?? DENSITY_SCALES.default
  lines.push(`--font-size-base: ${density.fontSize}`)
  lines.push(`--spacing-scale: ${density.spacing}`)

  // Translucency
  if (config.translucent) {
    const cardAlpha = config.mode === 'dark' ? 0.6 : 0.7
    lines.push(`--bg-card: ${hexToRgba(vars['bg-card'], cardAlpha)}`)
    lines.push(`--glass-blur: 12px`)
    lines.push(`--glass-backdrop: blur(12px)`)
  } else {
    lines.push(`--glass-blur: 0px`)
    lines.push(`--glass-backdrop: none`)
  }

  return lines.join('; ')
}

/** Convert hex to rgba */
function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Lighten a hex color by a percentage */
function lightenHex(hex: string, percent: number): string {
  const c = hex.replace('#', '')
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + Math.round(255 * (percent / 100)))
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + Math.round(255 * (percent / 100)))
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + Math.round(255 * (percent / 100)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
