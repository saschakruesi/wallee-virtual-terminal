import { createJwt } from './jwt'
import type { IatUnit } from './jwt'
import type { RestApiErrorBody } from './types'

/** Where requests go: the helper proxy by default, or the API directly (VITE_API_BASE). */
export const API_BASE: string = (import.meta.env.VITE_API_BASE || '/wallee').replace(/\/+$/, '')
/** The path prefix wallee sees and that the JWT must sign. */
export const SIGNED_PATH_PREFIX = '/api/v2.0'

export const DEFAULT_TIMEOUT_MS = 20_000

export type ApiCredentials = {
  userId: string
  authKey: string
  spaceId: string
  iatUnit?: IatUnit
}

export type QueryValue = string | number | boolean | undefined | null
export type Query = Record<string, QueryValue>

export type RequestOptions = {
  query?: Query
  /** Joined with commas into `?expand=`. */
  expand?: string[]
  body?: unknown
  /** `json` (default) or `text` for the `text/plain` endpoints (payment page URLs). */
  accept?: 'json' | 'text'
  signal?: AbortSignal
  timeoutMs?: number
  /** Set to false for the only endpoint that does not need the `space` header. */
  spaceHeader?: boolean
}

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'validation'
  | 'rateLimited'
  | 'server'
  | 'aborted'
  | 'unknown'

export class WalleeApiError extends Error {
  readonly status: number
  readonly kind: ErrorKind
  readonly code?: string
  readonly requestId?: string
  readonly details?: unknown
  readonly body?: RestApiErrorBody | string

  constructor(init: {
    status: number
    kind: ErrorKind
    message: string
    code?: string
    requestId?: string
    details?: unknown
    body?: RestApiErrorBody | string
  }) {
    super(init.message)
    this.name = 'WalleeApiError'
    this.status = init.status
    this.kind = init.kind
    this.code = init.code
    this.requestId = init.requestId
    this.details = init.details
    this.body = init.body
  }
}

export function isWalleeApiError(err: unknown): err is WalleeApiError {
  return err instanceof WalleeApiError
}

export function kindForStatus(status: number): ErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422 || status === 442) return 'validation'
  if (status === 429) return 'rateLimited'
  if (status === 502 || status === 503 || status === 504) return 'network'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * Builds `path?query` exactly once with URLSearchParams. The same string is signed in the
 * JWT (prefixed with /api/v2.0) and sent (prefixed with API_BASE), so both always match.
 */
export function buildRequestPath(path: string, query?: Query, expand?: string[]): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const params = new URLSearchParams()
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      params.append(key, String(value))
    }
  }
  if (expand && expand.length > 0) params.append('expand', expand.join(','))
  const search = params.toString()
  return search ? `${normalized}?${search}` : normalized
}

async function parseErrorBody(res: Response): Promise<RestApiErrorBody | string | undefined> {
  const text = await res.text().catch(() => '')
  if (!text) return undefined
  try {
    return JSON.parse(text) as RestApiErrorBody
  } catch {
    return text
  }
}

function messageFromBody(body: RestApiErrorBody | string | undefined, status: number): string {
  if (typeof body === 'string') return body.slice(0, 300) || `HTTP ${status}`
  return body?.message || body?.defaultMessage || `HTTP ${status}`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new WalleeApiError({ status: 0, kind: 'aborted', message: 'aborted' }))
      },
      { once: true },
    )
  })
}

/**
 * Signed request against the wallee API. Throws `WalleeApiError` for any non-2xx response,
 * network failure or timeout. GET requests are retried (twice) on 429; nothing else is retried.
 */
export async function request<T>(
  creds: ApiCredentials,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const requestPath = buildRequestPath(path, options.query, options.expand)
  const maxAttempts = method === 'GET' ? 3 : 1

  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController()
    const onOuterAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onOuterAbort, { once: true })
    const timer = setTimeout(
      () => controller.abort(new DOMException('timeout', 'TimeoutError')),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )

    try {
      const token = await createJwt({
        userId: creds.userId,
        authKey: creds.authKey,
        method,
        requestPath: SIGNED_PATH_PREFIX + requestPath,
        iatUnit: creds.iatUnit,
      })
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: options.accept === 'text' ? 'text/plain' : 'application/json',
      }
      if (options.spaceHeader !== false) headers['space'] = creds.spaceId
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'

      let res: Response
      try {
        res = await fetch(API_BASE + requestPath, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
        })
      } catch (err) {
        if (options.signal?.aborted)
          throw new WalleeApiError({ status: 0, kind: 'aborted', message: 'aborted' })
        if (controller.signal.aborted)
          throw new WalleeApiError({ status: 0, kind: 'timeout', message: 'timeout' })
        throw new WalleeApiError({
          status: 0,
          kind: 'network',
          message: err instanceof Error ? err.message : 'network error',
        })
      }

      if (res.ok) {
        if (res.status === 204) return undefined as T
        if (options.accept === 'text') return (await res.text()) as T
        const text = await res.text()
        return (text ? JSON.parse(text) : undefined) as T
      }

      const body = await parseErrorBody(res)
      const error = new WalleeApiError({
        status: res.status,
        kind: kindForStatus(res.status),
        message: messageFromBody(body, res.status),
        code: typeof body === 'object' ? body.code : undefined,
        requestId: typeof body === 'object' ? body.id : undefined,
        details: typeof body === 'object' ? body.details : undefined,
        body,
      })

      if (res.status === 429 && attempt < maxAttempts) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt
        await sleep(Math.min(waitMs, 10_000), options.signal)
        continue
      }
      throw error
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onOuterAbort)
    }
  }
}
