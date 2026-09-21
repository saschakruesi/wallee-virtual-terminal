/**
 * Self-update endpoints of the Go helper (same origin, not the wallee proxy).
 * When the frontend runs without the helper these calls fail and the banner stays hidden.
 */

export type UpdateCheck = {
  current: string
  latest?: string
  updateAvailable: boolean
  reason?: string
  releaseUrl?: string
  publishedAt?: string
  assetName?: string
  assetSize?: number
  notes?: string
  platform: string
}

export type UpdateState =
  'idle' | 'downloading' | 'verifying' | 'installing' | 'restarting' | 'error'

export type UpdateStatus = {
  state: UpdateState
  target?: string
  received: number
  total: number
  message?: string
  current: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'omit', cache: 'no-store' })
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = { message: text }
  }
  if (!res.ok) {
    const message = (body as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`
    throw new Error(message)
  }
  return body as T
}

export function checkForUpdate(force = false): Promise<UpdateCheck> {
  return call<UpdateCheck>(`/update/check${force ? '?force=1' : ''}`)
}

export function startUpdate(tag: string): Promise<{ state: UpdateState; target: string }> {
  return call('/update/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  })
}

export function getUpdateStatus(): Promise<UpdateStatus> {
  return call<UpdateStatus>('/update/status')
}

/** Empty string when the helper answers but has no version endpoint (a release older than the updater). */
export function getHelperVersion(): Promise<string> {
  return call<{ version?: string } | undefined>('/update/version').then((r) =>
    r && typeof r.version === 'string' ? r.version : '',
  )
}

/** POST /quit: stops the helper (the app bundle / GUI build has no window to close). */
export async function quitHelper(): Promise<void> {
  const res = await fetch('/quit', { method: 'POST', credentials: 'omit', cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}
