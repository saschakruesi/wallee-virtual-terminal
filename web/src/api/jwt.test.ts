// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { base64UrlEncode, buildJwtPayload, createJwt, decodeBase64Key, signHs256 } from './jwt'

function decodeSegment(seg: string): unknown {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(
    Buffer.from(b64 + '='.repeat((4 - (b64.length % 4)) % 4), 'base64').toString('utf8'),
  )
}

describe('base64UrlEncode', () => {
  it('encodes without padding and with url-safe alphabet', () => {
    expect(base64UrlEncode('')).toBe('')
    expect(base64UrlEncode('f')).toBe('Zg')
    expect(base64UrlEncode('fo')).toBe('Zm8')
    expect(base64UrlEncode('foo')).toBe('Zm9v')
    // 0xfb 0xff → "+/8=" in standard base64
    expect(base64UrlEncode(new Uint8Array([0xfb, 0xff]))).toBe('-_8')
  })
})

describe('decodeBase64Key', () => {
  it('accepts standard base64, base64url and unpadded input', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x01, 0x02])
    const std = Buffer.from(bytes).toString('base64') // "+/8BAg=="
    expect(decodeBase64Key(std)).toEqual(bytes)
    expect(decodeBase64Key(std.replace(/=+$/, ''))).toEqual(bytes)
    expect(decodeBase64Key(std.replace(/\+/g, '-').replace(/\//g, '_'))).toEqual(bytes)
    expect(decodeBase64Key(`  ${std}\n`)).toEqual(bytes)
  })
  it('rejects garbage', () => {
    expect(() => decodeBase64Key('not base64!')).toThrow()
    expect(() => decodeBase64Key('')).toThrow()
  })
})

describe('signHs256', () => {
  it('reproduces the well-known jwt.io HS256 example token', async () => {
    // https://jwt.io default example: secret "your-256-bit-secret"
    const header = base64UrlEncode('{"alg":"HS256","typ":"JWT"}')
    const payload = base64UrlEncode('{"sub":"1234567890","name":"John Doe","iat":1516239022}')
    expect(header).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(payload).toBe(
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    )
    const sig = await signHs256(
      `${header}.${payload}`,
      new TextEncoder().encode('your-256-bit-secret'),
    )
    expect(sig).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
  })
})

describe('createJwt', () => {
  const authKey = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
  const now = 1_758_200_000_123 // ms

  it('produces header, payload and signature matching an independent HMAC implementation', async () => {
    const token = await createJwt({
      userId: 4711,
      authKey,
      method: 'get',
      requestPath: '/api/v2.0/customers/search?limit=10&query=emailAddress%3A~%22anna%22',
      now,
    })
    const [h, p, s] = token.split('.')
    expect(decodeSegment(h!)).toEqual({ alg: 'HS256', typ: 'JWT', ver: 1 })
    expect(decodeSegment(p!)).toEqual({
      sub: '4711',
      iat: 1_758_200_000,
      requestPath: '/api/v2.0/customers/search?limit=10&query=emailAddress%3A~%22anna%22',
      requestMethod: 'GET',
    })
    const expected = createHmac('sha256', Buffer.from(authKey, 'base64'))
      .update(`${h}.${p}`)
      .digest('base64url')
    expect(s).toBe(expected)
  })

  it('uses milliseconds for iat when requested', () => {
    expect(
      buildJwtPayload({ userId: '1', authKey, method: 'POST', requestPath: '/x', now }).iat,
    ).toBe(1_758_200_000)
    expect(
      buildJwtPayload({
        userId: '1',
        authKey,
        method: 'POST',
        requestPath: '/x',
        now,
        iatUnit: 'milliseconds',
      }).iat,
    ).toBe(now)
  })

  it('serialises the payload without whitespace and keeps sub a string', async () => {
    const token = await createJwt({
      userId: 1,
      authKey,
      method: 'GET',
      requestPath: '/api/v2.0/spaces/1',
      now,
    })
    const payloadJson = Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')
    expect(payloadJson).toBe(
      '{"sub":"1","iat":1758200000,"requestPath":"/api/v2.0/spaces/1","requestMethod":"GET"}',
    )
  })
})
