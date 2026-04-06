import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const db = getDb()
  const users = db
    .prepare('SELECT id, email, name, role, created FROM dev_users ORDER BY created ASC')
    .all() as Array<{ id: string; email: string; name: string; role: string; created: string }>

  return { users }
}
