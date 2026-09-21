import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  STORAGE_KEYS,
  clearAllLocalData,
  clearConfig,
  loadConfig,
  loadProfiles,
  profileLabel,
  readJson,
  removeProfile,
  saveConfig,
  setActiveProfile,
  updateUiPrefs,
  writeJson,
} from './storage'
import type { AppConfig } from './storage'

const base: AppConfig = { ...DEFAULT_CONFIG, userId: '1', authKey: 'a2V5', spaceId: '2' }

describe('readJson / writeJson', () => {
  it('round-trips and falls back on corrupt data', () => {
    writeJson(STORAGE_KEYS.recent, [1, 2])
    expect(readJson(STORAGE_KEYS.recent, [])).toEqual([1, 2])
    window.localStorage.setItem(STORAGE_KEYS.recent, '{not json')
    expect(readJson(STORAGE_KEYS.recent, 'fallback')).toBe('fallback')
    expect(readJson(STORAGE_KEYS.products, null)).toBeNull()
  })
})

describe('config storage', () => {
  it('stores in localStorage when credentials are remembered', () => {
    saveConfig(base)
    expect(window.localStorage.getItem(STORAGE_KEYS.config)).toContain('"userId":"1"')
    expect(window.sessionStorage.getItem(STORAGE_KEYS.config)).toBeNull()
    expect(loadConfig()).toMatchObject(base)
  })

  it('moves to sessionStorage when not remembered and back again', () => {
    saveConfig(base)
    saveConfig({ ...base, rememberCredentials: false })
    expect(window.localStorage.getItem(STORAGE_KEYS.config)).toBeNull()
    expect(window.sessionStorage.getItem(STORAGE_KEYS.config)).toContain('"spaceId":"2"')
    expect(loadConfig()?.rememberCredentials).toBe(false)
    saveConfig({ ...base, rememberCredentials: true })
    expect(window.sessionStorage.getItem(STORAGE_KEYS.config)).toBeNull()
    expect(loadConfig()?.rememberCredentials).toBe(true)
  })

  it('fills in defaults for older configs and ignores invalid ones', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.config,
      JSON.stringify({ userId: '1', authKey: 'k', spaceId: '2' }),
    )
    expect(loadConfig()).toMatchObject({
      currency: 'CHF',
      environment: 'PREVIEW',
      merchantReferencePrefix: 'VT',
    })
    window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({ userId: 1 }))
    expect(loadConfig()).toBeNull()
  })

  it('clearConfig and clearAllLocalData remove the right keys', () => {
    saveConfig(base)
    updateUiPrefs({ lang: 'en' })
    window.localStorage.setItem('other.key', 'keep')
    clearConfig()
    expect(loadConfig()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEYS.ui)).not.toBeNull()
    clearAllLocalData()
    expect(window.localStorage.getItem(STORAGE_KEYS.ui)).toBeNull()
    expect(window.localStorage.getItem('other.key')).toBe('keep')
  })
})

describe('multi-space store', () => {
  it('migrates a legacy single config into one profile', () => {
    window.localStorage.setItem(STORAGE_KEYS.config, JSON.stringify({ ...base, spaceName: 'Alt' }))
    const cfg = loadConfig()!
    expect(cfg.spaceName).toBe('Alt')
    expect(cfg.id).toBeTruthy()
    expect(loadProfiles()).toHaveLength(1)
    // The generated id is persisted at once, so every read agrees on it.
    expect(loadProfiles()[0]?.id).toBe(cfg.id)
    expect(loadConfig()?.id).toBe(cfg.id)
    expect(readJson<{ version?: number }>(STORAGE_KEYS.config, {}).version).toBe(2)
  })

  it('assigns stable ids to stored profiles that lack one', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.config,
      JSON.stringify({ version: 2, activeId: null, rememberCredentials: true, profiles: [base] }),
    )
    const first = loadConfig()!
    expect(first.id).toBeTruthy()
    expect(loadConfig()?.id).toBe(first.id)
    expect(loadProfiles().map((p) => p.id)).toEqual([first.id])
  })

  it('keeps several profiles, switches and removes them', () => {
    const a = saveConfig({ ...base, spaceId: '1', spaceName: 'Eins' })
    const b = saveConfig({ ...base, spaceId: '2', spaceName: 'Zwei', currency: 'EUR' })
    expect(loadProfiles().map((p) => p.spaceName)).toEqual(['Eins', 'Zwei'])
    expect(loadConfig()?.spaceId).toBe('2')
    setActiveProfile(a.id!)
    expect(loadConfig()?.spaceId).toBe('1')
    // Re-saving the same space (same id) updates instead of duplicating.
    saveConfig({ ...b, label: 'Hotel Zwei' })
    expect(loadProfiles()).toHaveLength(2)
    expect(profileLabel(loadConfig()!)).toBe('Hotel Zwei')
    expect(removeProfile(b.id!)?.spaceId).toBe('1')
    expect(loadProfiles()).toHaveLength(1)
    expect(removeProfile(a.id!)).toBeNull()
    expect(loadConfig()).toBeNull()
  })

  it('stores the whole set in sessionStorage when credentials are not remembered', () => {
    saveConfig({ ...base, rememberCredentials: false })
    expect(window.localStorage.getItem(STORAGE_KEYS.config)).toBeNull()
    expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEYS.config)!).version).toBe(2)
  })
})
