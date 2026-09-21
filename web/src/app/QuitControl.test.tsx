import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { DEFAULT_CONFIG, saveConfig, updateUiPrefs } from '@/lib/storage'

function seed() {
  saveConfig({
    ...DEFAULT_CONFIG,
    userId: '1',
    authKey: 'a2V5',
    spaceId: '100',
    spaceName: 'Hotel Eins',
    environment: 'PREVIEW',
  })
  updateUiPrefs({ lang: 'de' })
}

function mockFetch(quitStatus: number) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url.endsWith('/quit')) return new Response(null, { status: quitStatus })
      return new Response('{}', { status: 404 })
    }),
  )
  return calls
}

describe('quit action', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks for confirmation, stops the helper and shows the end screen', async () => {
    seed()
    window.location.hash = '#/history'
    const calls = mockFetch(204)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Beenden' }))
    const dialog = screen.getByRole('dialog', { name: 'wallee Virtual Terminal beenden?' })
    expect(dialog).toBeInTheDocument()
    expect(calls).not.toContain('POST /quit')

    await user.click(within(dialog).getByRole('button', { name: 'Beenden' }))
    expect(await screen.findByText('Der wallee Virtual Terminal ist beendet.')).toBeInTheDocument()
    expect(calls).toContain('POST /quit')
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('keeps running and reports when the helper refuses', async () => {
    seed()
    window.location.hash = '#/history'
    mockFetch(403)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Beenden' }))
    const dialog = screen.getByRole('dialog', { name: 'wallee Virtual Terminal beenden?' })
    await user.click(within(dialog).getByRole('button', { name: 'Beenden' }))
    expect(
      await screen.findByText('Beenden fehlgeschlagen. Das Programm läuft weiter.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'wallee Virtual Terminal beenden?' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Der wallee Virtual Terminal ist beendet.')).toBeNull()
  })
})
