import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  STORAGE_KEYS,
  clearAllLocalData,
  clearConfig,
  loadConfig,
  readJson,
  saveConfig,
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
    expect(loadConfig()).toEqual(base)
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
