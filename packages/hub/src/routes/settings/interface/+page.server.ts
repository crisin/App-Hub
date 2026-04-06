import type { PageServerLoad } from './$types'
import { getSetting } from '$lib/server/settings'

export const load: PageServerLoad = async () => {
  return {
    theme: getSetting('theme'),
  }
}
