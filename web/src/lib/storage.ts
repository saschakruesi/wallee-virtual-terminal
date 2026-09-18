/**
 * Browser storage helpers. All keys are prefixed with `wvt.` (see docs/01-architektur.md).
 * Reads never throw: a missing or corrupt entry yields the fallback.
 */
import type { IatUnit } from '@/api/jwt'

export const STORAGE_KEYS = {
  config: 'wvt.config',
  products: 'wvt.products',
  recent: 'wvt.recent',
  ui: 'wvt.ui',
  draft: 'wvt.draft',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
export type StorageKind = 'local' | 'session'

function safeStorage(kind: StorageKind): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage
    const probe = '__wvt_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function readJson<T>(key: StorageKey, fallback: T, kind: StorageKind = 'local'): T {
  const s = safeStorage(kind)
  if (!s) return fallback
  const raw = s.getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: StorageKey, value: unknown, kind: StorageKind = 'local'): void {
  const s = safeStorage(kind)
  if (!s) return
  try {
    s.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or blocked: ignore, the app keeps working in memory */
  }
}

export function removeKey(key: StorageKey, kind: StorageKind = 'local'): void {
  safeStorage(kind)?.removeItem(key)
}

/* ---------- UI preferences (`wvt.ui`) ---------- */

export type UiPrefs = {
  lang?: 'de' | 'en'
  lastMode?: 'MOTO' | 'LINK'
  motoEmbed?: 'iframe' | 'popup'
}

export function readUiPrefs(): UiPrefs {
  return readJson<UiPrefs>(STORAGE_KEYS.ui, {})
}

export function updateUiPrefs(patch: Partial<UiPrefs>): UiPrefs {
  const next = { ...readUiPrefs(), ...patch }
  writeJson(STORAGE_KEYS.ui, next)
  return next
}

/* ---------- App configuration (`wvt.config`) ---------- */

export type Environment = 'PREVIEW' | 'LIVE'
export type CompletionBehavior = 'COMPLETE_IMMEDIATELY' | 'COMPLETE_DEFERRED' | 'USE_CONFIGURATION'
export type PaymentLanguage = 'de-CH' | 'en-US' | 'fr-CH' | 'it-CH'

export const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'] as const
export const PAYMENT_LANGUAGES: PaymentLanguage[] = ['de-CH', 'en-US', 'fr-CH', 'it-CH']
export const COMPLETION_BEHAVIORS: CompletionBehavior[] = [
  'COMPLETE_IMMEDIATELY',
  'COMPLETE_DEFERRED',
  'USE_CONFIGURATION',
]

export type AppConfig = {
  userId: string
  authKey: string
  spaceId: string
  environment: Environment
  language: PaymentLanguage
  currency: string
  merchantReferencePrefix: string
  completionBehavior: CompletionBehavior
  rememberCredentials: boolean
  /** Learned during the connection test (docs/02-wallee-api.md §1). */
  iatUnit?: IatUnit
  /** Snapshot from the last successful connection test. */
  spaceName?: string
  spaceState?: string
  chargeFlowAvailable?: boolean
  connectedAt?: string
}

export const DEFAULT_CONFIG: Omit<AppConfig, 'userId' | 'authKey' | 'spaceId'> = {
  environment: 'PREVIEW',
  language: 'de-CH',
  currency: 'CHF',
  merchantReferencePrefix: 'VT',
  completionBehavior: 'COMPLETE_IMMEDIATELY',
  rememberCredentials: true,
}

function isConfig(value: unknown): value is AppConfig {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return (
    typeof c.userId === 'string' && typeof c.authKey === 'string' && typeof c.spaceId === 'string'
  )
}

/** Reads the config from localStorage, then sessionStorage (rememberCredentials = false). */
export function loadConfig(): AppConfig | null {
  for (const kind of ['local', 'session'] as const) {
    const raw = readJson<unknown>(STORAGE_KEYS.config, null, kind)
    if (isConfig(raw)) return { ...DEFAULT_CONFIG, ...raw }
  }
  return null
}

/** Writes to the storage matching `rememberCredentials` and removes the other copy. */
export function saveConfig(config: AppConfig): void {
  const target: StorageKind = config.rememberCredentials ? 'local' : 'session'
  const other: StorageKind = config.rememberCredentials ? 'session' : 'local'
  writeJson(STORAGE_KEYS.config, config, target)
  removeKey(STORAGE_KEYS.config, other)
}

export function clearConfig(): void {
  removeKey(STORAGE_KEYS.config, 'local')
  removeKey(STORAGE_KEYS.config, 'session')
}

/** Removes every `wvt.*` entry from both storages. */
export function clearAllLocalData(): void {
  for (const kind of ['local', 'session'] as const) {
    const s = safeStorage(kind)
    if (!s) continue
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && k.startsWith('wvt.')) keys.push(k)
    }
    keys.forEach((k) => s.removeItem(k))
  }
}
