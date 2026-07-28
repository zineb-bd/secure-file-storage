import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { AppBrand } from '@/components/brand/AppBrand'
import { NavIcon } from '@/components/layout/NavIcon'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import { IconBell, IconChevronDown, IconMoon, IconSun, IconUpload } from '@/components/ui/TopbarIcons'
import { ChatWidget } from '@/components/chat/ChatWidget'

const ROUTE_META: Record<string, { titleKey: string; subtitleKey?: string }> = {
  '/': { titleKey: 'page.dashboard.title', subtitleKey: 'page.dashboard.subtitle' },
  '/documents/upload': { titleKey: 'page.upload.title', subtitleKey: 'page.upload.subtitle' },
  '/documents': { titleKey: 'page.documents.title', subtitleKey: 'page.documents.subtitle' },
  '/favorites': { titleKey: 'page.favorites.title', subtitleKey: 'page.favorites.subtitle' },
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
    { to: '/favorites', label: t('nav.favorites'), icon: 'favorites' },
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
  const avatarUrl = useProfileAvatar(user?.email)

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
        <div className="sidebar-brand-block">
          <Link to="/" className="sidebar-brand" onClick={closeMenus} title={t('nav.dashboard')}>
            <AppBrand />
          </Link>
          <div className="sidebar-brand-divider" aria-hidden="true" />
        </div>

        <div className="sidebar-cta">
          <button
            type="button"
            className="btn btn-primary btn-block sidebar-upload-btn"
            title={t('nav.upload')}
            onClick={() => navigate('/documents/upload')}
          >
            <IconUpload />
            <span className="sidebar-upload-label">{t('nav.upload')}</span>
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
              <span className="nav-item-label">{item.label}</span>
            </NavLink>
          ))}
          <div className="nav-section">{t('nav.account')}</div>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={closeMenus}
          >
            <NavIcon name="profile" />
            <span className="nav-item-label">{t('nav.profile')}</span>
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
                  <span className="nav-item-label">{item.label}</span>
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
            <Link to="/" className="topbar-brand" onClick={closeMenus}>
              <AppBrand compact logoSize={28} />
            </Link>
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
                <div className={`user-avatar${avatarUrl ? ' has-photo' : ''}`} id="user-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="user-avatar-img" />
                  ) : (
                    user?.fullName?.charAt(0) || 'U'
                  )}
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
      <ChatWidget />
    </div>
  )
}

