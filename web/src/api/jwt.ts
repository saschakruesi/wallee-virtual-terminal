/**
 * wallee API v2.0 authentication: a per-request JWT (HS256) signed in the browser with
 * WebCrypto. See docs/02-wallee-api.md §1.
 *
 *   header  { alg: "HS256", typ: "JWT", ver: 1 }
 *   payload { sub: "<userId>", iat: <unix time>, requestPath: "/api/v2.0/…?…", requestMethod: "GET" }
 *   key     = base64-decode(authenticationKey)
 */

export type IatUnit = 'seconds' | 'milliseconds'

const encoder = new TextEncoder()

/** Base64url without padding, for bytes or a UTF-8 string. */
export function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/**
 * Decodes the authentication key from the wallee backend. Accepts standard base64 and
 * base64url, with or without padding, and ignores surrounding whitespace.
 */
export function decodeBase64Key(key: string): Uint8Array {
  const cleaned = key.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  if (cleaned === '' || !/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('invalid base64 key')
  }
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('WebCrypto is not available in this browser')
  return s
}

/** HMAC-SHA256 over `signingInput`, returned as base64url. */
export async function signHs256(signingInput: string, keyBytes: Uint8Array): Promise<string> {
  const key = await subtle().importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtle().sign('HMAC', key, encoder.encode(signingInput))
  return base64UrlEncode(new Uint8Array(signature))
}

export type JwtInput = {
  userId: string | number
  authKey: string
  method: string
  /** Path as wallee sees it, including query string: `/api/v2.0/spaces/123?expand=…`. */
  requestPath: string
  iatUnit?: IatUnit
  /** Current time in milliseconds (injectable for tests). */
  now?: number
}

export const JWT_HEADER = { alg: 'HS256', typ: 'JWT', ver: 1 } as const

export function buildJwtPayload(input: JwtInput) {
  const nowMs = input.now ?? Date.now()
  const iat = input.iatUnit === 'milliseconds' ? nowMs : Math.floor(nowMs / 1000)
  return {
    sub: String(input.userId),
    iat,
    requestPath: input.requestPath,
    requestMethod: input.method.toUpperCase(),
  }
}

export async function createJwt(input: JwtInput): Promise<string> {
  const header = base64UrlEncode(JSON.stringify(JWT_HEADER))
  const payload = base64UrlEncode(JSON.stringify(buildJwtPayload(input)))
  const signingInput = `${header}.${payload}`
  const signature = await signHs256(signingInput, decodeBase64Key(input.authKey))
  return `${signingInput}.${signature}`
}
