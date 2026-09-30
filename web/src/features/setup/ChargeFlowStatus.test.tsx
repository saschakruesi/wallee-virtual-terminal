import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { WalleeApiError } from '@/api/client'
import { chargeFlowPortalUrl } from '@/api/chargeFlows'
import { ChargeFlowStatus } from './ChargeFlowStatus'
import type { ChargeFlowCheck } from './ChargeFlowStatus'
import type { ChargeFlow } from '@/api/types'

const creds = { userId: '1', authKey: 'a2V5', spaceId: '9' }

function setup(check: ChargeFlowCheck, listFlows = vi.fn(async (): Promise<ChargeFlow[]> => [])) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <ChargeFlowStatus creds={creds} check={check} onChange={onChange} listFlows={listFlows} />
    </I18nProvider>,
  )
  return { onChange, listFlows }
}

describe('ChargeFlowStatus', () => {
  it('links the guide to the charge flow list of the space', () => {
    setup({ status: 'missing' })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe(chargeFlowPortalUrl('9'))
    expect(chargeFlowPortalUrl('9')).toBe('https://app-wallee.com/s/9/payment/flow/list')
  })

  it('shows no guide when a flow is active', () => {
    setup({ status: 'ok', count: 2 })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reports ok once an active flow exists', async () => {
    const listFlows = vi.fn(async (): Promise<ChargeFlow[]> => [{ id: 1, state: 'ACTIVE' }])
    const { onChange } = setup({ status: 'missing' }, listFlows)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ status: 'ok', count: 1 }))
  })

  it('rechecks when the window regains focus while the flow is missing', async () => {
    const { onChange, listFlows } = setup({ status: 'missing' })
    fireEvent.focus(window)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ status: 'missing' }))
    expect(listFlows).toHaveBeenCalledTimes(1)
  })

  it('reports missing read permission', async () => {
    const listFlows = vi.fn(async (): Promise<ChargeFlow[]> => {
      throw new WalleeApiError({ status: 403, kind: 'forbidden', message: 'HTTP 403' })
    })
    const { onChange } = setup({ status: 'missing' }, listFlows)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ status: 'forbidden', message: 'HTTP 403' }),
    )
  })
})
