import { describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { detectLang, interpolate, translate, I18nProvider, useI18n } from './index'
import de from './de.json'
import en from './en.json'
import { readUiPrefs } from '@/lib/storage'

describe('detectLang', () => {
  it('maps German locales to de and everything else to en', () => {
    expect(detectLang('de')).toBe('de')
    expect(detectLang('de-CH')).toBe('de')
    expect(detectLang('DE-AT')).toBe('de')
    expect(detectLang('en-US')).toBe('en')
    expect(detectLang('fr-CH')).toBe('en')
    expect(detectLang(undefined)).toBe('en')
  })
})

describe('interpolate / translate', () => {
  it('replaces named placeholders and leaves unknown ones', () => {
    expect(interpolate('Version {version}', { version: '1.0' })).toBe('Version 1.0')
    expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
  it('falls back to the key for missing entries', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })
  it('uses Swiss spelling (no ß) in German messages', () => {
    for (const [key, value] of Object.entries(de)) {
      expect(value, key).not.toMatch(/ß/)
    }
  })
  it('has the same keys in de and en', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort())
  })
})

function Probe() {
  const { lang, t, setLang } = useI18n()
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="text">{t('nav.new')}</span>
      <button onClick={() => setLang('en')}>switch</button>
    </div>
  )
}

describe('I18nProvider', () => {
  it('renders translations and persists the language in wvt.ui', () => {
    render(
      <I18nProvider initialLang="de">
        <Probe />
      </I18nProvider>,
    )
    expect(screen.getByTestId('text')).toHaveTextContent('Neuer Vorgang')
    act(() => screen.getByText('switch').click())
    expect(screen.getByTestId('lang')).toHaveTextContent('en')
    expect(screen.getByTestId('text')).toHaveTextContent('New transaction')
    expect(readUiPrefs().lang).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
