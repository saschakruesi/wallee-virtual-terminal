// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, WalleeApiError, buildRequestPath, kindForStatus, request } from './client'
import { listChargeFlows } from './chargeFlows'
import { getSpace } from './spaces'

const creds = {
  userId: '4711',
  authKey: Buffer.from('k'.repeat(32)).toString('base64'),
  spaceId: '1234',
}

type Call = { url: string; init: RequestInit }
function mockFetch(responses: Array<() => Response>) {
  const calls: Call[] = []
  let i = 0
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = responses[Math.min(i, responses.length - 1)]!
    i++
    return next()
  })
  vi.stubGlobal('fetch', fn)
  return calls
}
const json =
  (status: number, body: unknown, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })

function decodePayload(auth: string) {
  const token = auth.replace('Bearer ', '')
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'))
}

afterEach(() => vi.unstubAllGlobals())

describe('buildRequestPath', () => {
  it('encodes query values with URLSearchParams and appends expand', () => {
    expect(
      buildRequestPath('/customers/search', { query: 'emailAddress:~"anna müller"', limit: 10 }),
    ).toBe('/customers/search?query=emailAddress%3A%7E%22anna+m%C3%BCller%22&limit=10')
    expect(
      buildRequestPath('payment/transactions', { skip: undefined, x: null }, [
        'lineItems',
        'customer',
      ]),
    ).toBe('/payment/transactions?expand=lineItems%2Ccustomer')
    expect(buildRequestPath('/spaces/1')).toBe('/spaces/1')
  })
})

describe('request', () => {
  it('sends the signed path, space header and JSON body', async () => {
    const calls = mockFetch([json(201, { id: 9 })])
    const result = await request<{ id: number }>(creds, 'POST', '/payment/transactions', {
      query: { expand: 'lineItems' },
      body: { currency: 'CHF' },
    })
    expect(result).toEqual({ id: 9 })
    expect(calls[0]!.url).toBe(`${API_BASE}/payment/transactions?expand=lineItems`)
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers['space']).toBe('1234')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Accept']).toBe('application/json')
    expect(calls[0]!.init.body).toBe('{"currency":"CHF"}')
    expect(decodePayload(headers['Authorization']!)).toMatchObject({
      sub: '4711',
      requestMethod: 'POST',
      requestPath: '/api/v2.0/payment/transactions?expand=lineItems',
    })
  })

  it('returns text for text/plain endpoints and undefined for 204', async () => {
    mockFetch([
      () =>
        new Response('https://pay.example/x', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
    ])
    expect(
      await request<string>(creds, 'GET', '/payment/transactions/1/payment-page-url', {
        accept: 'text',
      }),
    ).toBe('https://pay.example/x')
    mockFetch([() => new Response(null, { status: 204 })])
    expect(await request<undefined>(creds, 'POST', '/x')).toBeUndefined()
  })

  it('maps error bodies to WalleeApiError with kind, code and message', async () => {
    mockFetch([json(401, { code: 'unauthorized', message: 'Invalid token', id: 'req-1' })])
    const err = await request(creds, 'GET', '/spaces/1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(WalleeApiError)
    const e = err as WalleeApiError
    expect(e.status).toBe(401)
    expect(e.kind).toBe('unauthorized')
    expect(e.code).toBe('unauthorized')
    expect(e.message).toBe('Invalid token')
    expect(e.requestId).toBe('req-1')
  })

  it('handles non-JSON error bodies and helper 502', async () => {
    mockFetch([() => new Response('forbidden: cross-origin access', { status: 403 })])
    const e1 = (await request(creds, 'GET', '/spaces/1').catch((e: unknown) => e)) as WalleeApiError
    expect(e1.kind).toBe('forbidden')
    expect(e1.message).toContain('cross-origin')
    mockFetch([json(502, { message: 'upstream unreachable: dial tcp' })])
    const e2 = (await request(creds, 'GET', '/spaces/1').catch((e: unknown) => e)) as WalleeApiError
    expect(e2.kind).toBe('network')
  })

  it('wraps fetch failures as network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const e = (await request(creds, 'GET', '/spaces/1').catch((e: unknown) => e)) as WalleeApiError
    expect(e.kind).toBe('network')
    expect(e.status).toBe(0)
  })

  it('retries GET on 429 but never POST', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const calls = mockFetch([
      json(429, { message: 'slow down' }, { 'Retry-After': '0' }),
      json(200, { ok: true }),
    ])
    const p = request(creds, 'GET', '/spaces/1')
    await vi.advanceTimersByTimeAsync(1500)
    expect(await p).toEqual({ ok: true })
    expect(calls).toHaveLength(2)

    const postCalls = mockFetch([json(429, { message: 'slow down' })])
    const e = (await request(creds, 'POST', '/x', { body: {} }).catch(
      (e: unknown) => e,
    )) as WalleeApiError
    expect(e.kind).toBe('rateLimited')
    expect(postCalls).toHaveLength(1)
    vi.useRealTimers()
  })

  it('times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            ),
          ),
      ),
    )
    const e = (await request(creds, 'GET', '/spaces/1', { timeoutMs: 20 }).catch(
      (e: unknown) => e,
    )) as WalleeApiError
    expect(e.kind).toBe('timeout')
  })

  it('uses millisecond iat when configured', async () => {
    const calls = mockFetch([json(200, {})])
    await request({ ...creds, iatUnit: 'milliseconds' }, 'GET', '/spaces/1')
    const iat = decodePayload(
      (calls[0]!.init.headers as Record<string, string>)['Authorization']!,
    ).iat
    expect(iat).toBeGreaterThan(1e12)
  })
})

describe('kindForStatus', () => {
  it('classifies statuses', () => {
    expect(kindForStatus(400)).toBe('validation')
    expect(kindForStatus(422)).toBe('validation')
    expect(kindForStatus(409)).toBe('conflict')
    expect(kindForStatus(404)).toBe('notFound')
    expect(kindForStatus(500)).toBe('server')
    expect(kindForStatus(503)).toBe('network')
    expect(kindForStatus(418)).toBe('unknown')
  })
})

describe('endpoint helpers', () => {
  it('getSpace calls /spaces/{id}', async () => {
    const calls = mockFetch([json(200, { id: 1234, name: 'Test Space' })])
    expect(await getSpace(creds)).toEqual({ id: 1234, name: 'Test Space' })
    expect(calls[0]!.url).toBe(`${API_BASE}/spaces/1234`)
  })
  it('listChargeFlows unwraps the data envelope and tolerates a bare array', async () => {
    const calls = mockFetch([json(200, { data: [{ id: 1, state: 'ACTIVE' }], hasMore: false })])
    expect(await listChargeFlows(creds)).toEqual([{ id: 1, state: 'ACTIVE' }])
    expect(calls[0]!.url).toBe(`${API_BASE}/payment/charge-flows?limit=100`)
    mockFetch([json(200, [{ id: 2 }])])
    expect(await listChargeFlows(creds)).toEqual([{ id: 2 }])
  })
})
