import type { LayoutServerLoad } from './$types'
import { getSetting } from '$lib/server/settings'
import { DEFAULT_THEME_CONFIG, buildThemeCSS, type ThemeConfig } from '$lib/themes'

export const load: LayoutServerLoad = async () => {
  const raw = getSetting('themeConfig')
  let themeConfig: ThemeConfig = DEFAULT_THEME_CONFIG
  if (raw) {
    try {
      themeConfig = { ...DEFAULT_THEME_CONFIG, ...JSON.parse(raw) }
    } catch {
      /* use defaults */
    }
  }

  return {
    theme: themeConfig.mode,
    themeConfig,
    themeCSS: buildThemeCSS(themeConfig),
  }
}
