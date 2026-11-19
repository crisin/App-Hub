import type { PageServerLoad } from './$types'
import { buildKosmosGraph, getKosmosLocation } from '$lib/server/kosmos'

export const load: PageServerLoad = async () => {
  const location = getKosmosLocation()
  return { location, graph: location.exists ? buildKosmosGraph(location) : null }
}
