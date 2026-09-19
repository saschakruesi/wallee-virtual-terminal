import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  clearConfig,
  loadConfig,
  loadProfiles,
  removeProfile,
  saveConfig,
  setActiveProfile,
} from '@/lib/storage'
import type { AppConfig } from '@/lib/storage'

type ConfigContextValue = {
  /** The active space, or null when nothing is configured. */
  config: AppConfig | null
  /** All configured spaces (multi-space), in the order they were added. */
  profiles: AppConfig[]
  /** Persists a space (new or existing) and makes it the active one. */
  save: (config: AppConfig) => AppConfig
  /** Updates a subset of fields of the active space. */
  update: (patch: Partial<AppConfig>) => void
  /** Switches the active space. */
  switchProfile: (id: string) => void
  /** Removes a space; the first remaining one becomes active. */
  remove: (id: string) => void
  /** Removes every space. */
  clear: () => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

type State = { config: AppConfig | null; profiles: AppConfig[] }

function readState(): State {
  return { config: loadConfig(), profiles: loadProfiles() }
}

export function ConfigProvider({
  children,
  initialConfig,
}: {
  children: ReactNode
  initialConfig?: AppConfig | null
}) {
  const [state, setState] = useState<State>(() => {
    if (initialConfig === undefined) return readState()
    return { config: initialConfig, profiles: initialConfig ? [initialConfig] : [] }
  })

  const save = useCallback((next: AppConfig) => {
    const saved = saveConfig(next)
    setState(readState())
    return saved
  }, [])

  const update = useCallback((patch: Partial<AppConfig>) => {
    setState((current) => {
      if (!current.config) return current
      saveConfig({ ...current.config, ...patch })
      return readState()
    })
  }, [])

  const switchProfile = useCallback((id: string) => {
    setActiveProfile(id)
    setState(readState())
  }, [])

  const remove = useCallback((id: string) => {
    removeProfile(id)
    setState(readState())
  }, [])

  const clear = useCallback(() => {
    clearConfig()
    setState({ config: null, profiles: [] })
  }, [])

  const value = useMemo(
    () => ({
      config: state.config,
      profiles: state.profiles,
      save,
      update,
      switchProfile,
      remove,
      clear,
    }),
    [state, save, update, switchProfile, remove, clear],
  )
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used inside <ConfigProvider>')
  return ctx
}

/** Route guard: without a valid configuration every screen redirects to #/setup. */
export function RequireConfig() {
  const { config } = useConfig()
  const location = useLocation()
  if (!config) return <Navigate to="/setup" replace state={{ from: location.pathname }} />
  return <Outlet />
}
