import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { Icon } from '@/components'
import { profileLabel } from '@/lib/storage'
import { clearDraft } from '@/features/moto/draft'
import { useConfig } from './ConfigProvider'

/**
 * Header chip: shows the active space and opens a menu to switch between the configured
 * spaces or add another one. Switching starts a fresh transaction draft.
 */
export function SpaceMenu() {
  const t = useT()
  const navigate = useNavigate()
  const { config, profiles, switchProfile } = useConfig()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const freshSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!config) {
    return (
      <Link to="/setup" className="space-chip" aria-label={t('header.settings')}>
        <span className="muted">{t('header.notConnected')}</span>
        <span aria-hidden="true">·</span>
        <span>{t('header.setup')}</span>
        <Icon name="chevron-right" size="sm" />
      </Link>
    )
  }

  const choose = (id: string) => {
    setOpen(false)
    if (id === config.id) return
    switchProfile(id)
    clearDraft()
    navigate('/', { state: { fresh: true, freshKey: ++freshSeq.current } })
  }

  return (
    <div className="space-menu" ref={rootRef}>
      <button
        type="button"
        className="space-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('header.spaceMenu')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="space-chip__name">{profileLabel(config)}</span>
        {config.environment === 'PREVIEW' && (
          <span className="space-chip__env">{t('header.envPreview')}</span>
        )}
        <Icon name="chevron-down" size="sm" />
      </button>
      {open && (
        <ul id={menuId} role="menu" className="space-menu__list" aria-label={t('header.spaceMenu')}>
          {profiles.map((p) => (
            <li key={p.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={p.id === config.id}
                className="space-menu__item"
                onClick={() => choose(p.id!)}
              >
                <span className="space-menu__check" aria-hidden="true">
                  {p.id === config.id && <Icon name="check" size="sm" />}
                </span>
                <span className="space-menu__label">
                  {profileLabel(p)}
                  <span className="small muted"> · {p.spaceId}</span>
                </span>
                {p.environment === 'PREVIEW' ? (
                  <span className="space-chip__env">{t('header.envPreview')}</span>
                ) : (
                  <span className="small muted">{t('setup.environment.live')}</span>
                )}
              </button>
            </li>
          ))}
          <li role="none" className="space-menu__divider" />
          <li role="none">
            <Link
              role="menuitem"
              to="/setup?new=1"
              className="space-menu__item"
              onClick={() => setOpen(false)}
            >
              <span className="space-menu__check" aria-hidden="true">
                <Icon name="plus" size="sm" />
              </span>
              <span className="space-menu__label">{t('header.addSpace')}</span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}
