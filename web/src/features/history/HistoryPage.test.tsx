import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as TransactionsModule from '@/api/transactions'
import type { Transaction } from '@/api/transactions'
import { WalleeApiError } from '@/api/client'
import { DEFAULT_CONFIG, readUiPrefs, saveConfig, updateUiPrefs } from '@/lib/storage'

const rows: Transaction[] = [
  {
    id: 1,
    state: 'FULFILL',
    currency: 'CHF',
    completedAmount: 480,
    merchantReference: 'VT-2026-000001',
    createdOn: '2026-09-18T10:00:00Z',
    metaData: { mode: 'MOTO' },
    billingAddress: { givenName: 'Anna', familyName: 'Muster' },
  },
  {
    id: 2,
    state: 'PENDING',
    currency: 'CHF',
    authorizationAmount: 150,
    merchantReference: 'VT-2026-000002',
    createdOn: '2026-09-18T11:00:00Z',
    metaData: { mode: 'LINK' },
    customerEmailAddress: 'gast@example.com',
  },
  {
    id: 3,
    state: 'FAILED',
    currency: 'CHF',
    authorizationAmount: 75,
    merchantReference: 'VT-2026-000003',
    createdOn: '2026-09-18T12:00:00Z',
    customersPresence: 'NOT_PRESENT',
  },
]
const search =
  vi.fn<
    (
      creds: unknown,
      query: string,
      options?: unknown,
    ) => Promise<{ data: Transaction[]; hasMore?: boolean }>
  >()
const completeOnline = vi.fn(async () => undefined)

vi.mock('@/api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>()
  return {
    ...actual,
    searchTransactions: (c: unknown, q: string, o?: unknown) => search(c, q, o),
    completeOnline: (...a: unknown[]) => completeOnline(...(a as [])),
  }
})

import { App } from '@/app/App'

function setup() {
  saveConfig({
    ...DEFAULT_CONFIG,
    userId: '1',
    authKey: 'a2V5',
    spaceId: '4711',
    merchantReferencePrefix: 'VT',
  })
  updateUiPrefs({ lang: 'de' })
  window.location.hash = '#/history'
  render(<App />)
}
afterEach(() => {
  search.mockReset()
  completeOnline.mockClear()
})

describe('HistoryPage', () => {
  it('lists transactions from wallee, filters them and counts open links', async () => {
    search.mockResolvedValue({ data: rows, hasMore: false })
    setup()
    expect(await screen.findByText('VT-2026-000001')).toBeInTheDocument()
    expect(search.mock.calls[0]![1]).toBe('metaData.source:"wallee-virtual-terminal"')
    expect(screen.getByText('Anna Muster')).toBeInTheDocument()
    expect(screen.getAllByText('Link').length).toBeGreaterThan(0)
    await waitFor(() => expect(readUiPrefs().openLinkCount).toBe(1))
    expect(screen.getByRole('link', { name: /Vorgänge/ })).toHaveTextContent('1 offen')

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Offen' }))
    expect(screen.queryByText('VT-2026-000001')).toBeNull()
    expect(screen.getByText('VT-2026-000002')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Alle' }))
    await user.type(screen.getByLabelText('Referenz oder Kunde'), 'anna')
    expect(screen.getByText('VT-2026-000001')).toBeInTheDocument()
    expect(screen.queryByText('VT-2026-000002')).toBeNull()
  })

  it('falls back to the reference prefix when the metadata search is rejected', async () => {
    search.mockImplementation(async (_c, query) => {
      if (query.startsWith('metaData'))
        throw new WalleeApiError({ status: 422, kind: 'validation', message: 'bad query' })
      return { data: [rows[0]!], hasMore: false }
    })
    setup()
    expect(await screen.findByText('VT-2026-000001')).toBeInTheDocument()
    expect(search.mock.calls[1]![1]).toBe('merchantReference:~"VT-"')
    expect(screen.getByText(/Suche über Referenz-Präfix «VT»/)).toBeInTheDocument()
    expect(readUiPrefs().historyQueryMode).toBe('reference')
  })

  it('offers context actions and opens the matching detail screen', async () => {
    search.mockResolvedValue({ data: [{ ...rows[1]!, state: 'AUTHORIZED' }], hasMore: false })
    setup()
    const row = (await screen.findByText('VT-2026-000002')).closest('tr')!
    const user = userEvent.setup()
    await user.click(within(row).getByRole('button', { name: 'Abschliessen' }))
    await waitFor(() => expect(completeOnline).toHaveBeenCalledWith(expect.anything(), 2))
    await user.click(within(row).getByRole('button', { name: 'Öffnen' }))
    expect(window.location.hash).toBe('#/link/2')
  })
})
