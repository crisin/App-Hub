import type { Handle } from '@sveltejs/kit'
import { corsHeaders } from '$lib/server/auth'
import { cleanupStaleAssignments } from '$lib/server/claude-runner'

// On server startup: reset any issues stuck with claude-runner assignment from a previous crash
const staleCount = cleanupStaleAssignments()
if (staleCount > 0) {
  console.log(`[startup] Cleaned up ${staleCount} stale claude-runner assignment(s)`)
}

/**
 * Global CORS handler for /api/dev/* routes.
 * Spawned projects (running on different ports) need cross-origin access.
 */
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/dev/')) {
    // Handle OPTIONS preflight at the hook level (some routes handle it themselves too)
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(event.request.headers.get('origin')),
      })
    }

    const response = await resolve(event)

    // Attach CORS headers to every /api/dev/* response
    const headers = new Headers(response.headers)
    const cors = corsHeaders(event.request.headers.get('origin'))
    for (const [k, v] of Object.entries(cors)) {
      headers.set(k, v)
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  return resolve(event)
}
