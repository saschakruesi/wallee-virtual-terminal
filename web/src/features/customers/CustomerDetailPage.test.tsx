import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type * as CustomersModule from '@/api/customers'
import { WalleeApiError } from '@/api/client'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'

let version = 3
const getCustomer = vi.fn(async () => ({
  id: 501,
  version,
  givenName: 'Anna',
  familyName: 'Muster',
  emailAddress: 'anna@example.com',
  customerId: 'K-100',
  language: 'de-CH',
  preferredCurrency: 'CHF',
}))
const updateCustomer = vi.fn()
const listAddresses = vi.fn(async () => [
  {
    id: 2,
    addressType: 'BILLING' as const,
    defaultAddress: true,
    address: { street: 'Bahnhofstrasse 1', postcode: '8400', city: 'Winterthur', country: 'CH' },
  },
])
const createAddress = vi.fn(async () => ({ id: 3 }))

vi.mock('@/api/customers', async (importOriginal) => {
  const actual = await importOriginal<typeof CustomersModule>()
  return {
    ...actual,
    getCustomer: (...a: unknown[]) => getCustomer(...(a as [])),
    updateCustomer: (...a: unknown[]) => updateCustomer(...(a as [])),
    listCustomerAddresses: (...a: unknown[]) => listAddresses(...(a as [])),
    createCustomerAddress: (...a: unknown[]) => createAddress(...(a as [])),
  }
})

import { App } from '@/app/App'

function setup() {
  saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
  updateUiPrefs({ lang: 'de' })
  window.location.hash = '#/customers/501'
  render(<App />)
}
afterEach(() => {
  getCustomer.mockClear()
  updateCustomer.mockReset()
  createAddress.mockClear()
})

describe('CustomerDetailPage', () => {
  it('saves master data with the current version', async () => {
    updateCustomer.mockImplementation(
      async (_c: unknown, _id: unknown, body: { version: number }) => ({
        id: 501,
        version: body.version + 1,
        givenName: 'Anne',
        familyName: 'Muster',
      }),
    )
    setup()
    const user = userEvent.setup()
    const given = await screen.findByLabelText('Vorname')
    await user.clear(given)
    await user.type(given, 'Anne')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(updateCustomer).toHaveBeenCalled())
    expect(updateCustomer.mock.calls[0]![2]).toMatchObject({
      version: 3,
      givenName: 'Anne',
      familyName: 'Muster',
      customerId: 'K-100',
    })
    expect(await screen.findByText('Kunde gespeichert.')).toBeInTheDocument()
    expect(screen.getByText('Bahnhofstrasse 1, 8400 Winterthur, CH')).toBeInTheDocument()
  })

  it('reloads on 409 and explains the conflict', async () => {
    updateCustomer.mockRejectedValue(
      new WalleeApiError({ status: 409, kind: 'conflict', message: 'modified' }),
    )
    setup()
    const user = userEvent.setup()
    await screen.findByLabelText('Vorname')
    version = 4
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText(/an anderer Stelle geändert/)).toBeInTheDocument()
    await waitFor(() => expect(getCustomer).toHaveBeenCalledTimes(2))
  })

  it('adds an address and starts a transaction with the customer preselected', async () => {
    setup()
    const user = userEvent.setup()
    await screen.findByLabelText('Vorname')
    await user.click(screen.getByRole('button', { name: 'Adresse hinzufügen' }))
    await user.type(screen.getByLabelText('Strasse'), 'Seestrasse 5')
    await user.click(screen.getByRole('button', { name: 'Adresse speichern' }))
    await waitFor(() =>
      expect(createAddress).toHaveBeenCalledWith(
        expect.anything(),
        501,
        expect.objectContaining({
          addressType: 'BILLING',
          address: expect.objectContaining({ street: 'Seestrasse 5' }),
        }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Vorgang starten' }))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    await user.click(screen.getByRole('button', { name: /Telefon \/ MOTO/ }))
    expect(await screen.findByText('Anna Muster')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bahnhofstrasse 1')).toBeInTheDocument()
  })
})
