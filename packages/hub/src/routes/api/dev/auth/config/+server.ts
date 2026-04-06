import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getOrCreateJwtSecret, corsHeaders } from '$lib/server/auth'
import { HUB_PORT } from '@apphub/shared'

/**
 * GET /api/dev/auth/config
 *
 * Returns the JWT configuration that spawned projects need to verify tokens locally.
 * This lets sub-projects skip calling back to the hub for every token check.
 *
 * Response:
 *   {
 *     jwtSecret: string,   // HS256 shared secret
 *     issuer:    string,   // expected "iss" claim
 *     hubUrl:    string,   // base URL of the hub
 *     algorithm: "HS256"
 *   }
 */
export const GET: RequestHandler = async ({ request, url }) => {
  const origin = request.headers.get('origin')
  const hubUrl = `${url.protocol}//${url.hostname}:${HUB_PORT}`

  return json(
    {
      ok: true,
      data: {
        jwtSecret: getOrCreateJwtSecret(),
        issuer: 'apphub-dev',
        hubUrl,
        algorithm: 'HS256',
        accessTokenTtl: 3600,
        verifyUrl: `${hubUrl}/api/dev/auth`,
        refreshUrl: `${hubUrl}/api/dev/auth/refresh`,
        loginUrl: `${hubUrl}/api/dev/auth`,
      },
    },
    { headers: corsHeaders(origin) },
  )
}

export const OPTIONS: RequestHandler = async ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
