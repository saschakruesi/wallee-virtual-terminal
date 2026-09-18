// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, WalleeApiError } from './client'
import {
  buildCustomerSearchQuery,
  createCustomer,
  createCustomerAddress,
  customerDisplayName,
  listCustomerAddresses,
  pickBillingAddress,
  searchCustomers,
  setDefaultCustomerAddress,
  updateCustomer,
} from './customers'

const creds = { userId: '1', authKey: Buffer.from('k'.repeat(32)).toString('base64'), spaceId: '9' }

function mock(status: number, body?: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}
afterEach(() => vi.unstubAllGlobals())

describe('buildCustomerSearchQuery', () => {
  it('searches all four fields and escapes quotes', () => {
    expect(buildCustomerSearchQuery(' anna ')).toBe(
      '(givenName:~"anna" OR familyName:~"anna" OR emailAddress:~"anna" OR customerId:~"anna")',
    )
    expect(buildCustomerSearchQuery('o"neil')).toContain('givenName:~"o\\"neil"')
  })
})

describe('customer endpoints', () => {
  it('search sends the query, limit and order', async () => {
    const calls = mock(200, { data: [{ id: 1, familyName: 'Muster' }], hasMore: false })
    const res = await searchCustomers(creds, 'must', { limit: 5 })
    expect(res.data[0]!.familyName).toBe('Muster')
    const url = new URL(calls[0]!.url, 'http://x')
    expect(url.pathname).toBe(`${API_BASE}/customers/search`)
    expect(url.searchParams.get('query')).toBe(buildCustomerSearchQuery('must'))
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.get('order')).toBe('familyName')
    expect(url.searchParams.has('offset')).toBe(false)
  })

  it('create drops empty fields; update carries the version', async () => {
    let calls = mock(201, { id: 7 })
    await createCustomer(creds, {
      givenName: 'Anna',
      familyName: 'Muster',
      emailAddress: '',
      customerId: '  ',
    })
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      givenName: 'Anna',
      familyName: 'Muster',
    })
    calls = mock(200, { id: 7, version: 3 })
    await updateCustomer(creds, 7, {
      version: 2,
      givenName: 'Anne',
      emailAddress: 'anne@example.com',
    })
    expect(calls[0]!.init.method).toBe('PATCH')
    expect(calls[0]!.url).toBe(`${API_BASE}/customers/7`)
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      version: 2,
      givenName: 'Anne',
      emailAddress: 'anne@example.com',
    })
  })

  it('surfaces a 409 as conflict', async () => {
    mock(409, { message: 'The object has been modified' })
    const err = (await updateCustomer(creds, 7, { version: 1 }).catch(
      (e: unknown) => e,
    )) as WalleeApiError
    expect(err).toBeInstanceOf(WalleeApiError)
    expect(err.kind).toBe('conflict')
  })

  it('addresses: list, create with customer id, set default', async () => {
    let calls = mock(200, [{ id: 11, addressType: 'BILLING' }])
    expect(await listCustomerAddresses(creds, 7)).toEqual([{ id: 11, addressType: 'BILLING' }])
    expect(calls[0]!.url).toBe(`${API_BASE}/customers/7/addresses`)
    calls = mock(201, { id: 12 })
    await createCustomerAddress(creds, 7, {
      addressType: 'BILLING',
      address: { street: 'Bahnhofstrasse 1', city: 'Winterthur', postcode: '', country: 'CH' },
    })
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      customer: 7,
      addressType: 'BILLING',
      address: { street: 'Bahnhofstrasse 1', city: 'Winterthur', country: 'CH' },
    })
    calls = mock(204)
    await setDefaultCustomerAddress(creds, 7, 12)
    expect(calls[0]!.url).toBe(`${API_BASE}/customers/7/addresses/12/default`)
    expect(calls[0]!.init.method).toBe('POST')
  })
})

describe('helpers', () => {
  it('picks the default billing address first', () => {
    const addresses = [
      { id: 1, addressType: 'SHIPPING' as const, defaultAddress: true },
      { id: 2, addressType: 'BILLING' as const },
      { id: 3, addressType: 'BOTH' as const, defaultAddress: true },
    ]
    expect(pickBillingAddress(addresses)?.id).toBe(3)
    expect(pickBillingAddress(addresses.slice(0, 2))?.id).toBe(2)
    expect(pickBillingAddress([addresses[0]!])?.id).toBe(1)
    expect(pickBillingAddress([])).toBeUndefined()
  })
  it('builds a display name with fallbacks', () => {
    expect(customerDisplayName({ id: 1, givenName: 'Anna', familyName: 'Muster' })).toBe(
      'Anna Muster',
    )
    expect(customerDisplayName({ id: 1, emailAddress: 'a@b.ch' })).toBe('a@b.ch')
    expect(customerDisplayName({ id: 1, customerId: 'K-1' })).toBe('K-1')
    expect(customerDisplayName(undefined, '—')).toBe('—')
  })
})
