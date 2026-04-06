const HUB_URL = process.env.APPHUB_URL ?? 'http://localhost:5174'

export async function hubFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${HUB_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const data = await res.json()

  if (!data.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`)
  }

  return data.data
}
