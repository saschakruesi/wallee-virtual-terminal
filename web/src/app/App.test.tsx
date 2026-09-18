import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'
import { DEFAULT_CONFIG, saveConfig } from '@/lib/storage'

describe('App shell', () => {
  it('redirects to setup when no configuration exists', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(
      screen.getByRole('navigation', { name: /Hauptnavigation|Main navigation/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'wallee' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /wallee verbinden|Connect wallee/,
    )
    expect(window.location.hash).toBe('#/setup')
  })

  it('shows the start screen and space chip when configured', () => {
    saveConfig({
      ...DEFAULT_CONFIG,
      userId: '1',
      authKey: 'a2V5',
      spaceId: '4711',
      spaceName: 'Hotel Muster',
    })
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Zahlung erfassen|Take a payment/,
    )
    expect(screen.getByText('Hotel Muster')).toBeInTheDocument()
    expect(screen.getByText('PREVIEW')).toBeInTheDocument()
    expect(
      screen.getByText(/Verbunden mit Space Hotel Muster|Connected to space Hotel Muster/),
    ).toBeInTheDocument()
  })

  it('hides the PREVIEW badge in LIVE', () => {
    saveConfig({
      ...DEFAULT_CONFIG,
      userId: '1',
      authKey: 'a2V5',
      spaceId: '4711',
      environment: 'LIVE',
    })
    window.location.hash = '#/history'
    render(<App />)
    expect(screen.queryByText('PREVIEW')).toBeNull()
    expect(screen.getByText('Space 4711')).toBeInTheDocument()
  })

  it('serves the hidden styleguide route without configuration', () => {
    window.location.hash = '#/styleguide'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Styleguide|Style guide/)
    expect(screen.queryByRole('link', { name: /styleguide/i })).toBeNull()
  })
})
