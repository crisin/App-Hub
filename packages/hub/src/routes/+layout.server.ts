import type { LayoutServerLoad } from './$types'
import { getSetting } from '$lib/server/settings'
import { DEFAULT_THEME_CONFIG, buildThemeCSS, type ThemeConfig } from '$lib/themes'
import { getDb } from '$lib/server/db'

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

  // Load projects for sidebar navigation
  const db = getDb()
  const sidebarProjects = db
    .prepare(
      `SELECT slug, name, color, icon, status FROM projects
       WHERE archived_at IS NULL
       ORDER BY CASE WHEN slug = 'hub' THEN 0 ELSE 1 END, name`,
    )
    .all() as { slug: string; name: string; color: string; icon: string; status: string }[]

  return {
    theme: themeConfig.mode,
    themeConfig,
    themeCSS: buildThemeCSS(themeConfig),
    sidebarProjects,
  }
}
