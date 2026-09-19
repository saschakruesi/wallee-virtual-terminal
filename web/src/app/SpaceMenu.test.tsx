import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { DEFAULT_CONFIG, loadConfig, saveConfig, updateUiPrefs } from '@/lib/storage'

function seed() {
  saveConfig({
    ...DEFAULT_CONFIG,
    userId: '1',
    authKey: 'a2V5',
    spaceId: '100',
    spaceName: 'Hotel Eins',
    environment: 'PREVIEW',
  })
  saveConfig({
    ...DEFAULT_CONFIG,
    userId: '1',
    authKey: 'a2V5',
    spaceId: '200',
    label: 'Restaurant Zwei',
    environment: 'LIVE',
    currency: 'EUR',
  })
  updateUiPrefs({ lang: 'de' })
}

describe('multi-space header menu', () => {
  it('lists the configured spaces and switches the active one', async () => {
    seed()
    window.location.hash = '#/history'
    const user = userEvent.setup()
    render(<App />)
    const chip = screen.getByRole('button', { name: 'Space wechseln' })
    expect(chip).toHaveTextContent('Restaurant Zwei')
    expect(screen.queryByText('PREVIEW')).toBeNull()

    await user.click(chip)
    const menu = screen.getByRole('menu', { name: 'Space wechseln' })
    const items = within(menu).getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Hotel Eins'),
      expect.stringContaining('Restaurant Zwei'),
    ])
    expect(items[1]).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByRole('menuitem', { name: 'Space hinzufügen' })).toHaveAttribute(
      'href',
      '#/setup?new=1',
    )

    await user.click(items[0]!)
    expect(loadConfig()?.spaceId).toBe('100')
    expect(screen.getByRole('button', { name: 'Space wechseln' })).toHaveTextContent('Hotel Eins')
    expect(screen.getByText('PREVIEW')).toBeInTheDocument()
    expect(screen.getByText(/Verbunden mit Space Hotel Eins/)).toBeInTheDocument()
    expect(window.location.hash).toBe('#/')
  })

  it('has a settings shortcut and lets the setup screen edit each space', async () => {
    seed()
    window.location.hash = '#/'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('link', { name: 'Einstellungen' }))
    expect(window.location.hash).toBe('#/setup')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringContaining('Hotel Eins'),
      expect.stringContaining('Restaurant Zwei'),
      expect.stringContaining('Neuer Space'),
    ])
    expect(screen.getByLabelText('Space ID')).toHaveValue('200')
    await user.click(tabs[0]!)
    expect(screen.getByLabelText('Space ID')).toHaveValue('100')
    await user.click(tabs[2]!)
    expect(screen.getByLabelText('Space ID')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Neuer Space' })).toBeInTheDocument()
  })

  it('removes a space after confirmation and falls back to the remaining one', async () => {
    seed()
    window.location.hash = '#/setup'
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Diesen Space entfernen' }))
    await user.click(screen.getAllByRole('button', { name: 'Diesen Space entfernen' }).at(-1)!)
    expect(loadConfig()?.spaceId).toBe('100')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })
})
