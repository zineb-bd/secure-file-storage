import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { NavIcon } from '@/components/layout/NavIcon'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { IconBell, IconChevronDown, IconMoon, IconSun, IconUpload } from '@/components/ui/TopbarIcons'
import { UploadModal } from '@/components/modals/UploadModal'

const ROUTE_META: Record<string, { titleKey: string; subtitleKey?: string }> = {
  '/': { titleKey: 'page.dashboard.title', subtitleKey: 'page.dashboard.subtitle' },
  '/documents': { titleKey: 'page.documents.title', subtitleKey: 'page.documents.subtitle' },
  '/shared': { titleKey: 'page.shared.title', subtitleKey: 'page.shared.subtitle' },
  '/categories': { titleKey: 'page.categories.title', subtitleKey: 'page.categories.subtitle' },
  '/archived': { titleKey: 'page.archived.title', subtitleKey: 'page.archived.subtitle' },
  '/trash': { titleKey: 'page.trash.title', subtitleKey: 'page.trash.subtitle' },
  '/profile': { titleKey: 'page.profile.title', subtitleKey: 'page.profile.subtitle' },
  '/admin/users': { titleKey: 'page.adminUsers.title', subtitleKey: 'page.adminUsers.subtitle' },
  '/admin/roles': { titleKey: 'page.adminRoles.title', subtitleKey: 'page.adminRoles.subtitle' },
  '/admin/audit': { titleKey: 'page.adminAudit.title', subtitleKey: 'page.adminAudit.subtitle' },
  '/admin/config': { titleKey: 'page.adminConfig.title', subtitleKey: 'page.adminConfig.subtitle' },
}

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const closeMenus = () => {
    setUserMenuOpen(false)
    setNotifOpen(false)
    setSidebarOpen(false)
  }

  const routeMeta = ROUTE_META[location.pathname] ?? ROUTE_META['/']
  const breadcrumb = t(routeMeta.titleKey)
  const breadcrumbSub = routeMeta.subtitleKey ? t(routeMeta.subtitleKey) : ''

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: 'dashboard' },
    { to: '/documents', label: t('nav.documents'), icon: 'documents' },
    { to: '/shared', label: t('nav.shared'), icon: 'shared' },
    { to: '/categories', label: t('nav.categories'), icon: 'categories' },
    { to: '/archived', label: t('nav.archived'), icon: 'archived' },
    { to: '/trash', label: t('nav.trash'), icon: 'trash' },
  ]

  const adminItems = isAdmin
    ? [
        { to: '/admin/users', label: t('nav.users'), icon: 'users' },
        { to: '/admin/roles', label: t('nav.roles'), icon: 'roles' },
        { to: '/admin/audit', label: t('nav.audit'), icon: 'audit' },
        { to: '/admin/config', label: t('nav.config'), icon: 'config' },
      ]
    : []

  const roleLabel = isAdmin ? t('role.admin') : t('role.user')

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('topbar.menu')}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} id="sidebar">
        <div className="sidebar-brand">
          <BrandLogo size={36} />
          <div className="sidebar-brand-text">
            SecureDocs
            <small>{t('app.sidebarSubtitle')}</small>
          </div>
        </div>

        <div className="sidebar-cta">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setUploadOpen(true)}>
            <IconUpload />
            {t('nav.upload')}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">{t('nav.section')}</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={closeMenus}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
          <div className="nav-section">{t('nav.account')}</div>
          <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeMenus}>
            <NavIcon name="profile" />
            {t('nav.profile')}
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-section">{t('nav.admin')}</div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={closeMenus}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle"
              id="menu-toggle"
              aria-label={t('topbar.menu')}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <span />
            </button>
          </div>
          <div className="topbar-center">
            <div className="global-search">
              <span className="global-search-icon" aria-hidden="true" />
              <input type="search" placeholder={t('topbar.search')} disabled />
            </div>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="topbar-btn"
              id="btn-theme-toggle"
              title={theme === 'dark' ? t('topbar.themeToLight') : t('topbar.themeToDark')}
              aria-label={theme === 'dark' ? t('topbar.themeToLight') : t('topbar.themeToDark')}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <div className="notif-wrap">
              <button
                type="button"
                className="topbar-btn"
                id="btn-notifications"
                aria-label={t('topbar.notifications')}
                onClick={() => {
                  setNotifOpen((o) => !o)
                  setUserMenuOpen(false)
                }}
              >
                <IconBell />
              </button>
              {notifOpen && (
                <div className="notif-panel" id="notif-panel">
                  <div className="notif-panel-header">{t('topbar.notifications')}</div>
                  <div className="notif-empty">{t('empty.notifications')}</div>
                </div>
              )}
            </div>
            <div className="user-menu">
              <button
                type="button"
                className="user-trigger"
                id="user-trigger"
                onClick={() => {
                  setUserMenuOpen((o) => !o)
                  setNotifOpen(false)
                }}
              >
                <div className="user-avatar" id="user-avatar">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="user-info">
                  <div className="user-info-name" id="user-name">
                    {user?.fullName || t('msg.defaultUser')}
                  </div>
                  <div className="user-info-role" id="user-role">
                    {roleLabel}
                  </div>
                </div>
                <span className="user-chevron" aria-hidden="true">
                  <IconChevronDown />
                </span>
              </button>
              {userMenuOpen && (
                <div className="dropdown" id="user-dropdown">
                  <button type="button" className="dropdown-item" onClick={() => { navigate('/profile'); closeMenus() }}>
                    {t('user.profile')}
                  </button>
                  <div className="dropdown-divider" />
                  <button type="button" className="dropdown-item danger" id="btn-logout" onClick={() => void logout()}>
                    {t('user.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="od-command-bar">
          <div>
            <div className="od-breadcrumb" id="page-breadcrumb">
              {breadcrumb}
            </div>
            {breadcrumbSub && (
              <div className="od-breadcrumb-sub" id="page-breadcrumb-sub">
                {breadcrumbSub}
              </div>
            )}
          </div>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
    </div>
  )
}
