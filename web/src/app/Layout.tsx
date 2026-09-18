import { Link, NavLink, Outlet } from 'react-router-dom'
import { useT } from '@/i18n'
import { Icon } from '@/components'
import logo from '@/assets/wallee_logo_turquoise.svg'
import { APP_VERSION } from '@/lib/version'

const NAV = [
  { to: '/', key: 'nav.new', end: true },
  { to: '/history', key: 'nav.history', end: false },
  { to: '/customers', key: 'nav.customers', end: false },
  { to: '/products', key: 'nav.products', end: false },
] as const

export function Layout() {
  const t = useT()
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
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-status">
        <span>{t('status.version', { version: APP_VERSION })}</span>
        <span aria-hidden="true">·</span>
        <span>{t('status.notConnected')}</span>
      </footer>
    </div>
  )
}

/**
 * Placeholder until phase 2 delivers the real space chip (name + PREVIEW badge).
 * Links to the setup screen.
 */
function SpaceChip() {
  const t = useT()
  return (
    <Link to="/setup" className="space-chip" aria-label={t('header.settings')}>
      <span className="muted">{t('header.notConnected')}</span>
      <span aria-hidden="true">·</span>
      <span>{t('header.setup')}</span>
      <Icon name="chevron-right" size="sm" />
    </Link>
  )
}
