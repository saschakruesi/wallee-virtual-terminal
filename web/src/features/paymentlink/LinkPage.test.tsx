import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as TransactionsModule from '@/api/transactions'
import type * as ChargeFlowsModule from '@/api/chargeFlows'
import type { Transaction } from '@/api/transactions'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'

const pending: Transaction = {
  id: 42,
  state: 'PENDING',
  currency: 'CHF',
  authorizationAmount: 480,
  merchantReference: 'VT-2026-000007',
  customerEmailAddress: 'gast@example.com',
  createdOn: '2026-09-18T10:00:00Z',
  lineItems: [{ uniqueId: 'li-1', name: 'Doppelzimmer', quantity: 1, amountIncludingTax: 480 }],
}
let current: Transaction = pending

const sendMessage = vi.fn(async () => undefined)
const updateRecipient = vi.fn(async () => undefined)
const cancel = vi.fn(async () => ({ ...pending, state: 'FAILED' as const }))
const searchLevels = vi.fn(async () => [
  {
    id: 900,
    state: 'PENDING' as const,
    createdOn: '2026-09-18T10:00:05Z',
    timeoutOn: '2026-09-21T10:00:00Z',
    configuration: { id: 1, name: 'E-Mail', type: 1451 },
  },
])

vi.mock('@/api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>()
  return { ...actual, getTransaction: vi.fn(async () => current) }
})
vi.mock('@/api/chargeFlows', async (importOriginal) => {
  const actual = await importOriginal<typeof ChargeFlowsModule>()
  return {
    ...actual,
    searchChargeFlowLevels: (...args: unknown[]) => searchLevels(...(args as [])),
    getChargeFlowPaymentPageUrl: vi.fn(async () => 'https://app-wallee.com/s/1/payment/link/42'),
    sendChargeFlowLevelMessage: (...args: unknown[]) => sendMessage(...(args as [])),
    updateChargeFlowRecipient: (...args: unknown[]) => updateRecipient(...(args as [])),
    cancelChargeFlow: (...args: unknown[]) => cancel(...(args as [])),
  }
})

import { App } from '@/app/App'

function setup(tx: Transaction = pending) {
  current = tx
  saveConfig({
    ...DEFAULT_CONFIG,
    userId: '1',
    authKey: 'a2V5',
    spaceId: '4711',
    chargeFlowAvailable: true,
  })
  updateUiPrefs({ lang: 'de' })
  window.location.hash = '#/link/42'
  render(<App />)
}

afterEach(() => {
  sendMessage.mockClear()
  updateRecipient.mockClear()
  cancel.mockClear()
})

describe('LinkPage', () => {
  it('shows recipient, level, expiry and the copyable link while pending', async () => {
    setup()
    expect((await screen.findAllByText('gast@example.com')).length).toBeGreaterThan(0)
    expect(await screen.findByText('E-Mail')).toBeInTheDocument()
    expect(
      await screen.findByText('https://app-wallee.com/s/1/payment/link/42'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ausstehend')).toBeInTheDocument()
    expect(screen.getAllByText('Link gesendet').length).toBeGreaterThan(0)
  })

  it('resends the e-mail for the current level', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'E-Mail erneut senden' }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(expect.anything(), 900))
    expect(await screen.findByText('E-Mail wurde erneut gesendet.')).toBeInTheDocument()
  })

  it('changes the recipient with the level configuration type and resends', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Empfänger ändern' }))
    await user.type(screen.getByLabelText('Neue E-Mail-Adresse'), 'neu@example.com{Enter}')
    await waitFor(() =>
      expect(updateRecipient).toHaveBeenCalledWith(expect.anything(), 42, 1451, 'neu@example.com'),
    )
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('cancels the charge flow after confirmation', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))
    await user.click(await screen.findByRole('button', { name: 'Zahlungslink abbrechen' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.anything(), 42))
    expect(
      await screen.findByText('Fehlgeschlagen', { selector: '.result-title' }),
    ).toBeInTheDocument()
  })

  it('shows the paid result with receipt download', async () => {
    setup({
      ...pending,
      state: 'FULFILL',
      completedAmount: 480,
      completedOn: '2026-09-18T11:00:00Z',
    })
    expect(await screen.findByRole('button', { name: 'Beleg herunterladen' })).toBeInTheDocument()
    expect(screen.getAllByText('Abgeschlossen').length).toBeGreaterThan(0)
  })
})
