import { describe, expect, it } from 'vitest'
import { WalleeApiError } from '@/api/client'
import { translate } from '@/i18n'
import { describeApiError } from './apiErrors'
import { isOffline, reportConnection, subscribeConnection } from './connection'

const t = (k: string, p?: Record<string, string | number>) => translate('de', k, p)
const err = (status: number, kind: WalleeApiError['kind'], message = 'x') =>
  new WalleeApiError({ status, kind, message })

describe('describeApiError', () => {
  it('maps every error kind to an actionable German sentence', () => {
    const ctx = { spaceId: '4711' }
    expect(describeApiError(err(401, 'unauthorized'), t, ctx)).toMatch(/401/)
    expect(describeApiError(err(403, 'forbidden'), t, ctx)).toMatch(/Space 4711/)
    expect(describeApiError(err(404, 'notFound'), t, ctx)).toMatch(/404/)
    expect(describeApiError(err(409, 'conflict'), t, ctx)).toMatch(/409/)
    expect(describeApiError(err(422, 'validation', 'amount invalid'), t, ctx)).toMatch(
      /amount invalid/,
    )
    expect(describeApiError(err(429, 'rateLimited'), t, ctx)).toMatch(/429/)
    expect(describeApiError(err(500, 'server'), t, ctx)).toMatch(/500/)
    expect(describeApiError(err(0, 'network'), t, ctx)).toMatch(/app-wallee.com/)
    expect(describeApiError(err(0, 'timeout'), t, ctx)).toMatch(/20 Sekunden/)
    expect(describeApiError(new Error('invalid base64 key'), t, ctx)).toMatch(/Base64/)
    expect(describeApiError('boom', t, ctx)).toMatch(/boom/)
  })
})

describe('connection store', () => {
  it('notifies subscribers only on state changes', () => {
    let calls = 0
    const unsubscribe = subscribeConnection(() => calls++)
    reportConnection(true)
    expect(isOffline()).toBe(false)
    reportConnection(false)
    reportConnection(false)
    expect(isOffline()).toBe(true)
    expect(calls).toBe(1)
    reportConnection(true)
    expect(isOffline()).toBe(false)
    expect(calls).toBe(2)
    unsubscribe()
  })
})
