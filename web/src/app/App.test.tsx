import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App shell', () => {
  it('renders navigation, wordmark and the default screen', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(
      screen.getByRole('navigation', { name: /Hauptnavigation|Main navigation/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'wallee' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
  it('serves the hidden styleguide route', () => {
    window.location.hash = '#/styleguide'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Styleguide|Style guide/)
    expect(screen.queryByRole('link', { name: /styleguide/i })).toBeNull()
  })
})
