import type { PageServerLoad } from './$types'
import { getSetting } from '$lib/server/settings'
import { DEFAULT_THEME_CONFIG, type ThemeConfig } from '$lib/themes'

export const load: PageServerLoad = async () => {
  const raw = getSetting('themeConfig')
  let themeConfig: ThemeConfig = DEFAULT_THEME_CONFIG
  if (raw) {
    try {
      themeConfig = { ...DEFAULT_THEME_CONFIG, ...JSON.parse(raw) }
    } catch {
      /* use defaults */
    }
  }

  return { themeConfig }
}
