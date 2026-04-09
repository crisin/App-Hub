import { HUB_PORT } from '@apphub/shared'

const HUB_URL = process.env.APPHUB_URL ?? `http://localhost:${HUB_PORT}`

export async function hubFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${HUB_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch (err) {
    throw new Error(
      `Could not connect to hub at ${HUB_URL}. Is it running? (npm run dev)`,
    )
  }

  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Hub returned non-JSON response (${res.status}): ${text.slice(0, 200)}`)
  }

  if (!data.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`)
  }

  return data.data
}
