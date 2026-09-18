import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { Icon } from './Icon'

export type ToastKind = 'success' | 'error' | 'info'
export type ToastInput = { kind?: ToastKind; title?: string; message: string; durationMs?: number }
type ToastItem = ToastInput & { id: number }

type ToastContextValue = {
  show: (toast: ToastInput) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = ++seq.current
      setItems((list) => [...list.slice(-3), { ...toast, id }])
      const duration = toast.durationMs ?? (toast.kind === 'error' ? 8000 : 5000)
      if (duration > 0)
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (message, title) => show({ kind: 'success', message, title }),
      error: (message, title) => show({ kind: 'error', message, title }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastRegion({
  items,
  onDismiss,
}: {
  items: ToastItem[]
  onDismiss: (id: number) => void
}) {
  const t = useT()
  return (
    <div className="toast-region" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div
          key={item.id}
          className={['toast', item.kind === 'error' ? 'toast--error' : ''].join(' ').trim()}
          role={item.kind === 'error' ? 'alert' : 'status'}
        >
          <div className="toast__body">
            {item.title && <div className="toast__title">{item.title}</div>}
            <div className="toast__message">{item.message}</div>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(item.id)}
            aria-label={t('common.close')}
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
