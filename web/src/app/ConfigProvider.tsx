import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { clearConfig, loadConfig, saveConfig } from '@/lib/storage'
import type { AppConfig } from '@/lib/storage'

type ConfigContextValue = {
  config: AppConfig | null
  /** Persists and publishes a new configuration. */
  save: (config: AppConfig) => void
  /** Updates a subset of fields of the existing configuration. */
  update: (patch: Partial<AppConfig>) => void
  clear: () => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({
  children,
  initialConfig,
}: {
  children: ReactNode
  initialConfig?: AppConfig | null
}) {
  const [config, setConfig] = useState<AppConfig | null>(() =>
    initialConfig === undefined ? loadConfig() : initialConfig,
  )

  const save = useCallback((next: AppConfig) => {
    saveConfig(next)
    setConfig(next)
  }, [])

  const update = useCallback((patch: Partial<AppConfig>) => {
    setConfig((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      saveConfig(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    clearConfig()
    setConfig(null)
  }, [])

  const value = useMemo(() => ({ config, save, update, clear }), [config, save, update, clear])
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
