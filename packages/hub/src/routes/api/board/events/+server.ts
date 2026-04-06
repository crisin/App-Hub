import type { RequestHandler } from './$types'
import { runnerEvents } from '$lib/server/claude-runner'

/**
 * GET /api/board/events — Server-Sent Events stream.
 *
 * Pushes real-time updates to the client:
 *   event: output  — new Claude output lines
 *   event: status  — runner state changed
 *   event: board   — board data changed (issue moved/created/deleted)
 */
export const GET: RequestHandler = async () => {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(': connected\n\n'))

      const handler = ({ event, data }: { event: string; data: unknown }) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Controller may be closed
        }
      }

      runnerEvents.on('sse', handler)

      // Keepalive every 30s to prevent connection timeout
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(keepalive)
        }
      }, 30000)

      // Cleanup on cancel
      const cleanup = () => {
        runnerEvents.off('sse', handler)
        clearInterval(keepalive)
      }

      // Store cleanup for cancel signal
      ;(controller as any).__cleanup = cleanup
    },

    cancel(controller) {
      const cleanup = (controller as any)?.__cleanup
      if (typeof cleanup === 'function') cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
