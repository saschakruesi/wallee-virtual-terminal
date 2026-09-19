import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n'
import { ToastProvider } from '@/components'
import { UpdateBanner } from './UpdateBanner'

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockHelper(handler: Handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init))),
  )
}

function renderBanner() {
  return render(
    <I18nProvider initialLang="de">
      <ToastProvider>
        <UpdateBanner />
      </ToastProvider>
    </I18nProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('UpdateBanner', () => {
  it('stays hidden when the helper reports up-to-date or is missing', async () => {
    mockHelper(() =>
      json({
        current: 'v1.0.0',
        latest: 'v1.0.0',
        updateAvailable: false,
        reason: 'up-to-date',
        platform: 'darwin/arm64',
      }),
    )
    renderBanner()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
    vi.unstubAllGlobals()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    renderBanner()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the new version, runs the update after confirmation and reloads when the new helper answers', async () => {
    let started = false
    let statusCalls = 0
    mockHelper((url, init) => {
      if (url.startsWith('/update/check'))
        return json({
          current: 'v1.0.0',
          latest: 'v1.1.0',
          updateAvailable: true,
          releaseUrl: 'https://x/rel',
          assetSize: 6_000_000,
          platform: 'darwin/arm64',
        })
      if (url === '/update/start') {
        started = true
        expect(init?.method).toBe('POST')
        expect(JSON.parse(init?.body as string)).toEqual({ tag: 'v1.1.0' })
        return json({ state: 'downloading', target: 'v1.1.0' }, 202)
      }
      if (url === '/update/status') {
        statusCalls++
        if (statusCalls === 1)
          return json({
            state: 'downloading',
            target: 'v1.1.0',
            received: 3_000_000,
            total: 6_000_000,
            current: 'v1.0.0',
          })
        if (statusCalls === 2)
          return json({
            state: 'verifying',
            target: 'v1.1.0',
            received: 6_000_000,
            total: 6_000_000,
            current: 'v1.0.0',
          })
        return json({
          state: 'restarting',
          target: 'v1.1.0',
          received: 6_000_000,
          total: 6_000_000,
          current: 'v1.0.0',
        })
      }
      if (url === '/update/version') return json({ version: started ? 'v1.1.0' : 'v1.0.0' })
      return new Response('not found', { status: 404 })
    })
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload, hash: '' },
      writable: true,
    })

    const user = userEvent.setup()
    renderBanner()
    expect(
      await screen.findByText('Neue Version v1.1.0 verfügbar (installiert: v1.0.0)'),
    ).toBeInTheDocument()
    expect(screen.getByText('· 5.7 MB')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Update starten' }))
    expect(
      screen.getByRole('heading', { name: 'Update auf die neue Version starten?' }),
    ).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Update starten' }).at(-1)!)

    await waitFor(() => expect(started).toBe(true))
    expect(
      await screen.findByText(/Wird heruntergeladen… 50 %/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Prüfsumme wird geprüft…/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Warten auf die neue Version…/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Update auf v1.1.0 abgeschlossen/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300))
    })
    expect(reload).toHaveBeenCalled()
  }, 15000)

  it('remembers «Später» for the session and surfaces helper errors', async () => {
    mockHelper((url) => {
      if (url.startsWith('/update/check'))
        return json({
          current: 'v1.0.0',
          latest: 'v1.1.0',
          updateAvailable: true,
          platform: 'darwin/arm64',
        })
      if (url === '/update/start') return json({ message: 'update already running' }, 409)
      return new Response('', { status: 404 })
    })
    const user = userEvent.setup()
    const first = renderBanner()
    await user.click(await screen.findByRole('button', { name: 'Update starten' }))
    await user.click(screen.getAllByRole('button', { name: 'Update starten' }).at(-1)!)
    expect(await screen.findByRole('alert')).toHaveTextContent('update already running')
    first.unmount()

    renderBanner()
    await user.click(await screen.findByRole('button', { name: 'Später' }))
    expect(window.sessionStorage.getItem('wvt.updateDismissed')).toBe('v1.1.0')
    renderBanner()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Update starten' })).toBeNull()
  })
})
