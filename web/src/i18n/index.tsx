import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import de from './de.json'
import en from './en.json'
import { readUiPrefs, updateUiPrefs } from '@/lib/storage'

export type Lang = 'de' | 'en'
export const LANGS: Lang[] = ['de', 'en']

type Messages = Record<string, string>
const MESSAGES: Record<Lang, Messages> = { de, en }

export type TranslateParams = Record<string, string | number>
export type Translate = (key: string, params?: TranslateParams) => string

type I18nContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** `de` for any German locale (de, de-CH, de-DE …), `en` otherwise. */
export function detectLang(navigatorLanguage: string | undefined): Lang {
  return (navigatorLanguage ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function resolveInitialLang(): Lang {
  const stored = readUiPrefs().lang
  if (stored && LANGS.includes(stored)) return stored
  return detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined)
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function translate(lang: Lang, key: string, params?: TranslateParams): string {
  const template = MESSAGES[lang][key] ?? MESSAGES.de[key]
  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key "${key}"`)
    return key
  }
  return interpolate(template, params)
}

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? resolveInitialLang())

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    updateUiPrefs({ lang: next })
  }, [])

  const t = useCallback<Translate>((key, params) => translate(lang, key, params), [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

export function useT(): Translate {
  return useI18n().t
}
