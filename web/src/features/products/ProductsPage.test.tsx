import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { readCatalog } from '@/lib/catalog'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'

function setup() {
  saveConfig({ ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '4711' })
  updateUiPrefs({ lang: 'de' })
  window.location.hash = '#/products'
  render(<App />)
}

describe('ProductsPage', () => {
  it('inserts samples, edits inline, duplicates and deletes with undo', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Beispielprodukte einfügen' }))
    expect(readCatalog()).toHaveLength(3)
    const name = screen.getByLabelText('Bezeichnung 1')
    await user.clear(name)
    await user.type(name, 'Einzelzimmer')
    expect(readCatalog()[0]!.name).toBe('Einzelzimmer')
    await user.click(screen.getByRole('button', { name: 'Duplizieren 1' }))
    expect(readCatalog()).toHaveLength(4)
    expect(readCatalog()[3]!.name).toBe('Einzelzimmer (Kopie)')
    await user.click(screen.getByRole('button', { name: 'Löschen 2' }))
    expect(readCatalog()).toHaveLength(3)
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Rückgängig' }))
    })
    expect(readCatalog()).toHaveLength(4)
    expect(readCatalog()[1]!.sku).toBe('KT')
  })

  it('adds products from the catalogue in the wizard and focuses the quantity', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Beispielprodukte einfügen' }))
    window.location.hash = '#/'
    await user.click(await screen.findByRole('button', { name: /Telefon \/ MOTO/ }))
    await user.click(screen.getByRole('button', { name: 'Ohne Kundenprofil weiter' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    const picker = screen.getByRole('combobox', { name: 'Produkt hinzufügen…' })
    await user.click(picker)
    expect(
      within(screen.getByRole('listbox', { name: 'Produkte' })).getAllByRole('option'),
    ).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Produkte verwalten' })).toHaveAttribute(
      'href',
      '#/products',
    )
    await user.type(picker, 'dz{Enter}')
    expect(screen.getByLabelText('Bezeichnung 1')).toHaveValue('Doppelzimmer 1 Nacht')
    expect(screen.getByLabelText('Menge 1')).toHaveFocus()
    expect(screen.getByText('CHF 240.00')).toBeInTheDocument()
    await user.type(picker, 'kur')
    await user.click(screen.getByRole('option', { name: /Kurtaxe/ }))
    expect(screen.getByLabelText('Bezeichnung 2')).toHaveValue('Kurtaxe pro Person')
    expect(screen.getByText('CHF 243.50')).toBeInTheDocument()
  })
})
