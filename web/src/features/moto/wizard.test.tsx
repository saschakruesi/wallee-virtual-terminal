import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Transaction, TransactionCreate } from '@/api/transactions'
import type * as TransactionsModule from '@/api/transactions'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'
import { readRecent } from '@/lib/recent'

const createTransaction =
  vi.fn<(creds: unknown, payload: TransactionCreate) => Promise<Transaction>>()
vi.mock('@/api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>()
  return {
    ...actual,
    createTransaction: (creds: unknown, payload: TransactionCreate) =>
      createTransaction(creds, payload),
    getTransaction: vi.fn(async () => ({ id: 99, state: 'PENDING', lineItems: [] })),
    getPaymentPageUrl: vi.fn(async () => 'https://pay.example/x'),
    getSuccessfulChargeAttempt: vi.fn(async () => undefined),
  }
})

import { App } from '@/app/App'

afterEach(() => {
  createTransaction.mockReset()
  vi.unstubAllGlobals()
})

describe('MOTO wizard', () => {
  it('walks customer → items → review and creates the transaction', async () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => ({ closed: false, close: vi.fn(), focus: vi.fn(), location: { href: '' } })),
    )
    createTransaction.mockResolvedValue({
      id: 99,
      state: 'PENDING',
      createdOn: '2026-09-18T10:00:00Z',
    })
    saveConfig({
      ...DEFAULT_CONFIG,
      userId: '1',
      authKey: 'a2V5',
      spaceId: '4711',
      spaceName: 'Hotel Muster',
    })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)

    // Step 1: optional customer data
    await user.type(screen.getByLabelText('E-Mail'), 'gast@example.com')
    await user.type(screen.getByLabelText('Nachname'), 'Muster')
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    // Step 2: one line item, then Enter moves on
    await user.type(screen.getByLabelText('Bezeichnung 1'), 'Doppelzimmer')
    await user.clear(screen.getByLabelText('Einzelpreis inkl. MwSt 1'))
    await user.type(screen.getByLabelText('Einzelpreis inkl. MwSt 1'), '480')
    await user.tab()
    expect(screen.getByText('CHF 480.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Weiter' }))

    // Step 3: review + start
    expect(screen.getByText('Muster')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zahlungsseite öffnen' }))

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1))
    const payload = createTransaction.mock.calls[0]![1]
    expect(payload).toMatchObject({
      currency: 'CHF',
      customersPresence: 'NOT_PRESENT',
      customerEmailAddress: 'gast@example.com',
      environmentSelectionStrategy: 'FORCE_TEST_ENVIRONMENT',
      lineItems: [
        {
          uniqueId: 'li-1',
          name: 'Doppelzimmer',
          quantity: 1,
          amountIncludingTax: 480,
          taxes: [{ rate: 8.1, title: 'MwSt 8.1 %' }],
        },
      ],
    })
    expect(payload.merchantReference).toMatch(/^VT-\d{4}-000001$/)
    await waitFor(() => expect(window.location.hash).toBe('#/moto/99'))
    expect(readRecent()[0]).toMatchObject({
      transactionId: 99,
      mode: 'MOTO',
      amount: 48000,
      customerLabel: 'Muster',
    })
    expect(window.sessionStorage.getItem('wvt.draft')).toBeNull()
  })

  it('blocks the items step until the line item is valid', async () => {
    saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Bezeichnung fehlt')).toBeInTheDocument()
    expect(screen.getByText('Preis fehlt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zahlungsseite öffnen' })).toBeNull()
  })
})
