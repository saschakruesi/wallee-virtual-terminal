import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { DEFAULT_CONFIG, readUiPrefs, saveConfig, updateUiPrefs } from '@/lib/storage'

describe('mode selection', () => {
  it('disables the payment link without an active charge flow and explains why', () => {
    saveConfig({
      ...DEFAULT_CONFIG,
      userId: '1',
      authKey: 'a2V5',
      spaceId: '4711',
      chargeFlowAvailable: false,
    })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('button', { name: /Zahlungslink per E-Mail/ })).toBeDisabled()
    expect(screen.getByText(/Kein aktiver Charge Flow/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Telefon \/ MOTO/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('remembers the chosen mode and makes e-mail mandatory for links', async () => {
    saveConfig({
      ...DEFAULT_CONFIG,
      userId: '1',
      authKey: 'a2V5',
      spaceId: '4711',
      chargeFlowAvailable: true,
    })
    updateUiPrefs({ lang: 'de' })
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Zahlungslink per E-Mail/ }))
    expect(readUiPrefs().lastMode).toBe('LINK')
    expect(screen.getByRole('radio', { name: 'Zahlungslink' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(
      screen.getByText('Für den Zahlungslink ist eine E-Mail-Adresse nötig.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'MOTO' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByLabelText('Bezeichnung 1')).toBeInTheDocument()
  })
})
