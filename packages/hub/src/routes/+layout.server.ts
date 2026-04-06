import type { LayoutServerLoad } from './$types'
import { getSetting } from '$lib/server/settings'

export const load: LayoutServerLoad = async () => {
  return {
    theme: getSetting('theme'),
  }
}
