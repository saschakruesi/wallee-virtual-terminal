// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE } from './client'
import {
  applyChargeFlow,
  cancelChargeFlow,
  currentLevel,
  getChargeFlowPaymentPageUrl,
  isLevelExpired,
  levelConfiguration,
  searchChargeFlowLevels,
  sendChargeFlowLevelMessage,
  updateChargeFlowRecipient,
} from './chargeFlows'

const creds = { userId: '1', authKey: Buffer.from('k'.repeat(32)).toString('base64'), spaceId: '9' }

function mock(status: number, body?: unknown, type = 'application/json') {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(
        body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body),
        { status, headers: { 'Content-Type': type } },
      )
    }),
  )
  return calls
}
afterEach(() => vi.unstubAllGlobals())

describe('charge flow endpoints', () => {
  it('apply, cancel and payment page url hit the transaction sub-resources', async () => {
    let calls = mock(200, { id: 5, state: 'PENDING' })
    expect(await applyChargeFlow(creds, 5)).toEqual({ id: 5, state: 'PENDING' })
    expect(calls[0]!.url).toBe(`${API_BASE}/payment/transactions/5/charge-flow/apply`)
    expect(calls[0]!.init.method).toBe('POST')
    calls = mock(200, { id: 5, state: 'FAILED' })
    await cancelChargeFlow(creds, 5)
    expect(calls[0]!.url).toBe(`${API_BASE}/payment/transactions/5/charge-flow/cancel`)
    calls = mock(200, ' https://pay.example/link \n', 'text/plain')
    expect(await getChargeFlowPaymentPageUrl(creds, 5)).toBe('https://pay.example/link')
    expect((calls[0]!.init.headers as Record<string, string>)['Accept']).toBe('text/plain')
  })

  it('searches levels by transaction id with configuration expanded', async () => {
    const calls = mock(200, { data: [{ id: 1, state: 'PENDING' }] })
    expect(await searchChargeFlowLevels(creds, 5)).toEqual([{ id: 1, state: 'PENDING' }])
    expect(calls[0]!.url).toBe(
      `${API_BASE}/payment/charge-flows/levels/search?query=transaction.id%3A5&limit=50&expand=configuration`,
    )
  })

  it('sends messages and updates the recipient with query parameters', async () => {
    let calls = mock(204)
    await sendChargeFlowLevelMessage(creds, 77)
    expect(calls[0]!.url).toBe(`${API_BASE}/payment/charge-flows/levels/77/send-message`)
    calls = mock(204)
    await updateChargeFlowRecipient(creds, 5, 1451, 'neu@example.com')
    expect(calls[0]!.url).toBe(
      `${API_BASE}/payment/transactions/5/charge-flow/update-recipient?type=1451&recipient=neu%40example.com`,
    )
    expect(calls[0]!.init.body).toBeUndefined()
  })
})

describe('level helpers', () => {
  it('picks the newest pending level, else the newest', () => {
    const levels = [
      { id: 1, state: 'FAILED' as const, createdOn: '2026-09-18T10:00:00Z' },
      { id: 2, state: 'PENDING' as const, createdOn: '2026-09-18T10:05:00Z' },
      { id: 3, state: 'PENDING' as const, createdOn: '2026-09-18T10:02:00Z' },
    ]
    expect(currentLevel(levels)?.id).toBe(2)
    expect(currentLevel([levels[0]!])?.id).toBe(1)
    expect(currentLevel([])).toBeUndefined()
  })
  it('exposes the expanded configuration and detects expiry', () => {
    const level = {
      id: 1,
      state: 'PENDING' as const,
      timeoutOn: '2026-09-18T10:00:00Z',
      configuration: { id: 9, name: 'E-Mail', type: 1451 },
    }
    expect(levelConfiguration(level)?.type).toBe(1451)
    expect(levelConfiguration({ id: 1, configuration: 9 })).toBeUndefined()
    expect(isLevelExpired(level, new Date('2026-09-19T00:00:00Z').getTime())).toBe(true)
    expect(isLevelExpired(level, new Date('2026-09-17T00:00:00Z').getTime())).toBe(false)
    expect(
      isLevelExpired({ ...level, state: 'SUCCESSFUL' }, new Date('2026-09-19T00:00:00Z').getTime()),
    ).toBe(false)
  })
})
