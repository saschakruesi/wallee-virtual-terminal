import { useEffect, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getUiSnapshot, subscribeUi } from '@/lib/uiStore'
import { useT } from '@/i18n'
import { Icon } from '@/components'
import logo from '@/assets/wallee_logo_turquoise.svg'
import { APP_VERSION, RELEASES_URL } from '@/lib/version'
import { isOffline, subscribeConnection } from '@/lib/connection'
import { useConfig } from './ConfigProvider'

const NAV = [
  { to: '/', key: 'nav.new', end: true },
  { to: '/history', key: 'nav.history', end: false },
  { to: '/customers', key: 'nav.customers', end: false },
  { to: '/products', key: 'nav.products', end: false },
] as const

export function Layout() {
  const t = useT()
  const { config } = useConfig()
  const navigate = useNavigate()
  const ui = useSyncExternalStore(subscribeUi, getUiSnapshot, getUiSnapshot)
  const offline = useSyncExternalStore(subscribeConnection, isOffline, isOffline)
  const openLinks = ui.openLinkCount ?? 0

  // ⌘/Ctrl+N = new transaction, ⌘/Ctrl+K = customer search (docs/03-ui-flows.md «Tastatur»).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'n' && config) {
        e.preventDefault()
        navigate('/', { state: { fresh: true, freshKey: Date.now() } })
      } else if (key === 'k' && config) {
        e.preventDefault()
        const box =
          document.getElementById('wizard-customer-search') ??
          document.getElementById('customers-search')
        if (box) box.focus()
        else navigate('/customers')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, navigate])
  return (
    <div className="app">
      <a href="#main" className="visually-hidden">
        {t('app.skipToContent')}
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <nav className="app-nav" aria-label={t('nav.label')}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  ['app-nav__link', isActive ? 'is-active' : ''].join(' ').trim()
                }
              >
                {t(item.key)}
                {item.to === '/history' && openLinks > 0 && (
                  <span className="app-nav__count">
                    · {t('history.openLinks', { count: openLinks })}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="app-header__right">
            <SpaceChip />
            <span className="wordmark">
              <img src={logo} alt={t('app.wordmarkAlt')} width="86" height="22" />
            </span>
          </div>
        </div>
      </header>
      {offline && (
        <div className="connection-banner" role="alert">
          <Icon name="warning" />
          <span>{t('connection.lost')}</span>
          <button type="button" className="btn btn--text" onClick={() => window.location.reload()}>
            {t('connection.retry')}
          </button>
        </div>
      )}
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-status">
        <span>{t('status.version', { version: APP_VERSION })}</span>
        {RELEASES_URL && (
          <>
            <span aria-hidden="true">·</span>
            <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
              {t('status.checkUpdate')}
            </a>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>
          {config
            ? t('status.connectedName', { space: config.spaceName ?? config.spaceId })
            : t('status.notConnected')}
        </span>
      </footer>
    </div>
  )
}

/** Space name + PREVIEW badge (orange text, test only); links to the settings. */
function SpaceChip() {
  const t = useT()
  const { config } = useConfig()
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
  return (
    <Link to="/setup" className="space-chip" aria-label={t('header.settings')}>
      <span>{config.spaceName ?? t('header.connectedTo', { space: config.spaceId })}</span>
      {config.environment === 'PREVIEW' && (
        <span className="space-chip__env">{t('header.envPreview')}</span>
      )}
      <Icon name="chevron-down" size="sm" />
    </Link>
  )
}
