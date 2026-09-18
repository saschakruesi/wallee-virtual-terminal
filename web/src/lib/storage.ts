/**
 * Browser storage helpers. All keys are prefixed with `wvt.` (see docs/01-architektur.md).
 * Reads never throw: a missing or corrupt entry yields the fallback.
 */
export const STORAGE_KEYS = {
  config: 'wvt.config',
  products: 'wvt.products',
  recent: 'wvt.recent',
  ui: 'wvt.ui',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

function safeStorage(kind: 'local' | 'session'): Storage | null {
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

export function readJson<T>(key: StorageKey, fallback: T, kind: 'local' | 'session' = 'local'): T {
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

export function writeJson(
  key: StorageKey,
  value: unknown,
  kind: 'local' | 'session' = 'local',
): void {
  const s = safeStorage(kind)
  if (!s) return
  try {
    s.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or blocked: ignore, the app keeps working in memory */
  }
}

export function removeKey(key: StorageKey, kind: 'local' | 'session' = 'local'): void {
  safeStorage(kind)?.removeItem(key)
}

/** UI preferences (`wvt.ui`). */
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
