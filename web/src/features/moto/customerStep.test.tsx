import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as CustomersModule from '@/api/customers'
import type { Customer } from '@/api/customers'
import type * as TransactionsModule from '@/api/transactions'
import type { Transaction, TransactionCreate } from '@/api/transactions'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'

const search = vi.fn<
  (
    creds: unknown,
    text: string,
    options?: unknown,
  ) => Promise<{ data: Customer[]; hasMore: boolean }>
>(async () => ({
  data: [
    {
      id: 501,
      givenName: 'Anna',
      familyName: 'Muster',
      emailAddress: 'anna@example.com',
      customerId: 'K-100',
    },
    { id: 502, givenName: 'Peter', familyName: 'Musterhaus', emailAddress: 'peter@example.com' },
  ],
  hasMore: false,
}))
const addresses = vi.fn(async () => [
  { id: 1, addressType: 'SHIPPING' as const, address: { street: 'Lagerweg 9', city: 'Zug' } },
  {
    id: 2,
    addressType: 'BILLING' as const,
    defaultAddress: true,
    address: {
      givenName: 'Anna',
      familyName: 'Muster',
      organizationName: 'Hotel Muster AG',
      street: 'Bahnhofstrasse 1',
      postcode: '8400',
      city: 'Winterthur',
      country: 'CH',
    },
  },
])
const createTransaction = vi.fn<
  (creds: unknown, payload: TransactionCreate) => Promise<Transaction>
>(async () => ({ id: 77, state: 'PENDING' }))

vi.mock('@/api/customers', async (importOriginal) => {
  const actual = await importOriginal<typeof CustomersModule>()
  return {
    ...actual,
    searchCustomers: (c: unknown, text: string, o?: unknown) => search(c, text, o),
    listCustomerAddresses: (...a: unknown[]) => addresses(...(a as [])),
  }
})
vi.mock('@/api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>()
  return {
    ...actual,
    createTransaction: (c: unknown, p: TransactionCreate) => createTransaction(c, p),
    getTransaction: vi.fn(async () => ({ id: 77, state: 'PENDING', lineItems: [] })),
    getPaymentPageUrl: vi.fn(async () => 'https://pay.example/x'),
    getSuccessfulChargeAttempt: vi.fn(async () => undefined),
  }
})

import { App } from '@/app/App'

afterEach(() => {
  search.mockClear()
  addresses.mockClear()
  createTransaction.mockClear()
  vi.unstubAllGlobals()
})

describe('wizard customer step with wallee customers', () => {
  it('searches after two characters, selects a customer with its billing address and sends customerId', async () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => ({ closed: false, close: vi.fn(), focus: vi.fn(), location: { href: '' } })),
    )
    saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Telefon \/ MOTO/ }))

    const box = screen.getByLabelText('Kunde suchen')
    await user.type(box, 'm')
    expect(screen.getByText('Mindestens 2 Zeichen eingeben.')).toBeInTheDocument()
    await user.type(box, 'us')
    await waitFor(() => expect(search).toHaveBeenCalled())
    expect(search.mock.calls[0]![1]).toBe('mus')
    await user.click(await screen.findByRole('option', { name: /Anna Muster/ }))

    await waitFor(() => expect(addresses).toHaveBeenCalledWith(expect.anything(), 501))
    expect(await screen.findByDisplayValue('Bahnhofstrasse 1')).toBeInTheDocument()
    expect(screen.getByText(/Kundennummer K-100/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.type(screen.getByLabelText('Bezeichnung 1'), 'Zimmer')
    await user.type(screen.getByLabelText('Einzelpreis inkl. MwSt 1'), '100')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Anna Muster')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zahlungsseite öffnen' }))
    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    expect(createTransaction.mock.calls[0]![1]).toMatchObject({
      customerId: '501',
      customerEmailAddress: 'anna@example.com',
      billingAddress: {
        givenName: 'Anna',
        familyName: 'Muster',
        organizationName: 'Hotel Muster AG',
        street: 'Bahnhofstrasse 1',
        postcode: '8400',
        city: 'Winterthur',
        country: 'CH',
      },
    })
  })

  it('suggests recently picked customers in the dropdown when the box is empty', async () => {
    saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
    updateUiPrefs({
      lang: 'de',
      recentCustomers: [{ id: 501, givenName: 'Anna', familyName: 'Muster', customerId: 'K-100' }],
    })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Telefon \/ MOTO/ }))

    const box = screen.getByRole('combobox', { name: 'Kunde suchen' })
    await user.click(box)
    expect(screen.getByText('Zuletzt verwendet')).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: /Anna Muster/ }))
    await waitFor(() => expect(addresses).toHaveBeenCalledWith(expect.anything(), 501))
    expect(search).not.toHaveBeenCalled()

    // «Kunde ändern» returns to the box; the pick stays on top of the suggestions.
    await user.click(screen.getByRole('button', { name: 'Ändern' }))
    await user.click(screen.getByRole('combobox', { name: 'Kunde suchen' }))
    expect(screen.getByRole('option', { name: /Anna Muster/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('still allows continuing without a profile', async () => {
    saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Telefon \/ MOTO/ }))
    await user.click(screen.getByRole('button', { name: 'Ohne Kundenprofil weiter' }))
    expect(screen.getByLabelText('Strasse')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByLabelText('Bezeichnung 1')).toBeInTheDocument()
  })
})
