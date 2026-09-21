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
  draftByTransaction: 'wvt.draftByTx',
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
  /** Next sequence number for merchant references (per prefix). */
  referenceCounters?: Record<string, number>
  /** Which search the history screen uses (metaData, or merchantReference as fallback). */
  historyQueryMode?: 'metaData' | 'reference'
  /** Open payment links counted at the last history load, for the navigation badge. */
  openLinkCount?: number
  /** Customers picked in the wizard most recently (newest first), offered as suggestions. */
  recentCustomers?: RecentCustomer[]
}

export type RecentCustomer = {
  id: number
  givenName?: string
  familyName?: string
  emailAddress?: string
  customerId?: string
}

export const RECENT_CUSTOMERS_MAX = 8

export function readRecentCustomers(): RecentCustomer[] {
  const list = readUiPrefs().recentCustomers
  return Array.isArray(list) ? list.filter((c) => c && typeof c.id === 'number') : []
}

/** Moves the customer to the front of the suggestion list (deduplicated by id). */
export function rememberCustomer(customer: RecentCustomer): void {
  const rest = readRecentCustomers().filter((c) => c.id !== customer.id)
  updateUiPrefs({ recentCustomers: [customer, ...rest].slice(0, RECENT_CUSTOMERS_MAX) })
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
  /** Profile id (multi-space); assigned on save when missing. */
  id?: string
  /** Display name chosen by the employee; falls back to the wallee space name. */
  label?: string
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

/** One configured wallee space. `rememberCredentials` lives on the store, not per profile. */
export type SpaceProfile = Omit<AppConfig, 'rememberCredentials' | 'id'> & { id: string }

/** `wvt.config` since multi-space support: several profiles, one active. */
export type ConfigStore = {
  version: 2
  activeId: string | null
  rememberCredentials: boolean
  profiles: SpaceProfile[]
}

export const DEFAULT_CONFIG: Omit<AppConfig, 'userId' | 'authKey' | 'spaceId'> = {
  environment: 'PREVIEW',
  language: 'de-CH',
  currency: 'CHF',
  merchantReferencePrefix: 'VT',
  completionBehavior: 'COMPLETE_IMMEDIATELY',
  rememberCredentials: true,
}

export function newProfileId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function profileLabel(p: Pick<AppConfig, 'label' | 'spaceName' | 'spaceId'>): string {
  return p.label?.trim() || p.spaceName?.trim() || `Space ${p.spaceId}`
}

function isLegacyConfig(value: unknown): value is AppConfig {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return (
    typeof c.userId === 'string' && typeof c.authKey === 'string' && typeof c.spaceId === 'string'
  )
}

function isStore(value: unknown): value is ConfigStore {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return c.version === 2 && Array.isArray(c.profiles)
}

function normaliseProfile(raw: unknown): SpaceProfile | null {
  if (!isLegacyConfig(raw)) return null
  const { rememberCredentials: _remember, ...rest } = raw as AppConfig
  const { userId, authKey, spaceId, ...defaults } = { ...DEFAULT_CONFIG, ...rest }
  return {
    ...defaults,
    userId,
    authKey,
    spaceId,
    id: typeof rest.id === 'string' && rest.id ? rest.id : newProfileId(),
  }
}

function emptyStore(): ConfigStore {
  return { version: 2, activeId: null, rememberCredentials: true, profiles: [] }
}

/**
 * Reads the store from localStorage, then sessionStorage; migrates a legacy single config.
 * A migration (legacy shape, or a profile without id) is written back at once so the generated
 * profile ids stay stable across reads — otherwise the active id would never match the list.
 */
export function loadStore(): ConfigStore {
  for (const kind of ['local', 'session'] as const) {
    const raw = readJson<unknown>(STORAGE_KEYS.config, null, kind)
    if (isStore(raw)) {
      const profiles = raw.profiles
        .map(normaliseProfile)
        .filter((p): p is SpaceProfile => p !== null)
      const activeId = profiles.some((p) => p.id === raw.activeId)
        ? raw.activeId
        : (profiles[0]?.id ?? null)
      const store: ConfigStore = {
        version: 2,
        activeId,
        rememberCredentials: raw.rememberCredentials !== false,
        profiles,
      }
      const idsChanged = raw.profiles.some(
        (p, i) => !p || typeof p !== 'object' || (p as { id?: unknown }).id !== profiles[i]?.id,
      )
      if (idsChanged || activeId !== raw.activeId) saveStore(store)
      return store
    }
    if (isLegacyConfig(raw)) {
      const profile = normaliseProfile(raw)!
      const store: ConfigStore = {
        version: 2,
        activeId: profile.id,
        rememberCredentials: raw.rememberCredentials !== false,
        profiles: [profile],
      }
      saveStore(store)
      return store
    }
  }
  return emptyStore()
}

/** Writes to the storage matching `rememberCredentials` and removes the other copy. */
export function saveStore(store: ConfigStore): void {
  const target: StorageKind = store.rememberCredentials ? 'local' : 'session'
  const other: StorageKind = store.rememberCredentials ? 'session' : 'local'
  writeJson(STORAGE_KEYS.config, store, target)
  removeKey(STORAGE_KEYS.config, other)
}

function toConfig(store: ConfigStore, profile: SpaceProfile): AppConfig {
  return { ...DEFAULT_CONFIG, ...profile, rememberCredentials: store.rememberCredentials }
}

/** The active profile as the flat AppConfig used throughout the app. */
export function loadConfig(): AppConfig | null {
  const store = loadStore()
  const active = store.profiles.find((p) => p.id === store.activeId)
  return active ? toConfig(store, active) : null
}

export function loadProfiles(): AppConfig[] {
  const store = loadStore()
  return store.profiles.map((p) => toConfig(store, p))
}

/** Upserts the profile (by id, else by space id), makes it active and stores the remember flag. */
export function saveConfig(config: AppConfig): AppConfig {
  const store = loadStore()
  const { rememberCredentials, id, ...rest } = config
  const existingIndex = id
    ? store.profiles.findIndex((p) => p.id === id)
    : store.profiles.findIndex((p) => p.spaceId === rest.spaceId && p.userId === rest.userId)
  const profile: SpaceProfile = {
    ...rest,
    id: id ?? (existingIndex >= 0 ? store.profiles[existingIndex]!.id : newProfileId()),
  }
  if (existingIndex >= 0) store.profiles[existingIndex] = profile
  else store.profiles.push(profile)
  store.activeId = profile.id
  store.rememberCredentials = rememberCredentials
  saveStore(store)
  return toConfig(store, profile)
}

/** Makes another profile active; returns the new active config. */
export function setActiveProfile(id: string): AppConfig | null {
  const store = loadStore()
  if (!store.profiles.some((p) => p.id === id)) return loadConfig()
  store.activeId = id
  saveStore(store)
  return loadConfig()
}

/** Removes a profile; the first remaining one becomes active. */
export function removeProfile(id: string): AppConfig | null {
  const store = loadStore()
  store.profiles = store.profiles.filter((p) => p.id !== id)
  if (store.activeId === id) store.activeId = store.profiles[0]?.id ?? null
  if (store.profiles.length === 0) {
    clearConfig()
    return null
  }
  saveStore(store)
  return loadConfig()
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
