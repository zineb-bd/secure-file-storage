import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/i18n/I18nContext'
import { AppBrand } from '@/components/brand/AppBrand'
import { NavIcon } from '@/components/layout/NavIcon'
import { useProfileAvatar } from '@/hooks/useProfileAvatar'
import { IconBell, IconChevronDown, IconMoon, IconSun, IconUpload } from '@/components/ui/TopbarIcons'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { PAGE_HERO_ACTIONS_ID } from '@/components/layout/PageHeroSlot'
import { api } from '@/api/client'
import { PREF_NOTIF_INAPP_KEY } from '@/constants'

type UserNotification = {
  id: string
  type: string
  message: string
  documentId?: string | null
  documentName?: string | null
  actorId?: string | null
  actorName?: string | null
  isRead: boolean
  createdAt: string
}

type NotificationList = {
  items: UserNotification[]
  unreadCount: number
}

function readBoolPref(key: string, defaultValue = true) {
  const v = localStorage.getItem(key)
  if (v === null) return defaultValue
  return v === 'true'
}

function formatNotifDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

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
  '/admin/audit': { titleKey: 'page.adminAudit.title', subtitleKey: 'page.adminAudit.subtitle' },
  '/admin/config': { titleKey: 'page.adminConfig.title', subtitleKey: 'page.adminConfig.subtitle' },
}

export function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [notifPrefTick, setNotifPrefTick] = useState(0)

  const inAppNotifsEnabled = readBoolPref(PREF_NOTIF_INAPP_KEY)

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setNotifError('')
      return
    }
    if (!readBoolPref(PREF_NOTIF_INAPP_KEY)) {
      setNotifications([])
      setUnreadCount(0)
      setNotifError('')
      return
    }
    try {
      setNotifLoading(true)
      setNotifError('')
      const data = await api<NotificationList>('/api/notifications?take=100')
      const items = Array.isArray(data?.items) ? data.items : []
      setNotifications(items)
      setUnreadCount(typeof data?.unreadCount === 'number' ? data.unreadCount : items.filter((n) => !n.isRead).length)
    } catch (err) {
      setNotifications([])
      setUnreadCount(0)
      setNotifError(err instanceof Error ? err.message : t('notif.loadError'))
    } finally {
      setNotifLoading(false)
    }
  }, [user, t, notifPrefTick])

  useEffect(() => {
    void loadNotifications()
    if (!user || !readBoolPref(PREF_NOTIF_INAPP_KEY)) return
    const id = window.setInterval(() => void loadNotifications(), 30_000)
    return () => window.clearInterval(id)
  }, [loadNotifications, user])

  useEffect(() => {
    if (notifOpen) void loadNotifications()
  }, [notifOpen, loadNotifications])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREF_NOTIF_INAPP_KEY) setNotifPrefTick((n) => n + 1)
    }
    const onNotifChanged = () => void loadNotifications()
    window.addEventListener('storage', onStorage)
    window.addEventListener('sfs:notifications-changed', onNotifChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('sfs:notifications-changed', onNotifChanged)
    }
  }, [loadNotifications])

  const closeMenus = () => {
    setUserMenuOpen(false)
    setNotifOpen(false)
    setSidebarOpen(false)
  }

  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      /* ignore */
    }
  }

  const openNotification = async (n: UserNotification) => {
    if (!n.isRead) {
      try {
        await api(`/api/notifications/${n.id}/read`, { method: 'POST' })
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        /* ignore */
      }
    }
    closeMenus()
    navigate('/shared')
  }

  const notifTypeLabel = (type: string) => {
    if (type === 'DocumentShared') return t('notif.type.shared')
    if (type === 'ShareSent') return t('notif.type.sent')
    return type
  }

  const renderNotifItem = (n: UserNotification) => (
    <button
      key={n.id}
      type="button"
      className={`notif-item${!n.isRead ? ' unread' : ' read'}`}
      onClick={() => void openNotification(n)}
    >
      <div className="notif-item-type">{notifTypeLabel(n.type)}</div>
      <div className="notif-item-message">{n.message}</div>
      <div className="notif-item-date">{formatNotifDate(n.createdAt, lang)}</div>
    </button>
  )

  const unreadNotifications = notifications.filter((n) => !n.isRead)
  const previousNotifications = notifications.filter((n) => n.isRead)

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
                {inAppNotifsEnabled && unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-panel" id="notif-panel">
                  <div className="notif-panel-header">
                    <span>{t('topbar.notifications')}</span>
                    <div className="notif-panel-actions">
                      <button type="button" className="notif-mark-all" onClick={() => void loadNotifications()}>
                        {t('notif.refresh')}
                      </button>
                      {unreadCount > 0 && (
                        <button type="button" className="notif-mark-all" onClick={() => void markAllRead()}>
                          {t('notif.markAllRead')}
                        </button>
                      )}
                    </div>
                  </div>
                  {!readBoolPref(PREF_NOTIF_INAPP_KEY) ? (
                    <div className="notif-empty">{t('notif.disabled')}</div>
                  ) : notifLoading && notifications.length === 0 ? (
                    <div className="notif-empty">{t('notif.loading')}</div>
                  ) : notifError ? (
                    <div className="notif-empty">
                      <p>{t('notif.loadError')}</p>
                      <p className="notif-error-detail">{notifError}</p>
                      <button type="button" className="btn btn-sm" onClick={() => void loadNotifications()}>
                        {t('notif.retry')}
                      </button>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="notif-empty">{t('empty.notifications')}</div>
                  ) : (
                    <div className="notif-panel-body">
                      {unreadNotifications.length > 0 && (
                        <section className="notif-section" aria-label={t('notif.section.new')}>
                          <div className="notif-section-title">{t('notif.section.new')}</div>
                          {unreadNotifications.map(renderNotifItem)}
                        </section>
                      )}
                      {previousNotifications.length > 0 && (
                        <section className="notif-section" aria-label={t('notif.section.previous')}>
                          <div className="notif-section-title">{t('notif.section.previous')}</div>
                          {previousNotifications.map(renderNotifItem)}
                        </section>
                      )}
                    </div>
                  )}
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

        <main className="page-shell">
          <header className="page-hero">
            <div className="page-hero-copy">
              <p className="page-hero-kicker">{t('app.name')}</p>
              <h1 className="page-hero-title" id="page-breadcrumb">
                {breadcrumb}
              </h1>
              {breadcrumbSub && (
                <p className="page-hero-sub" id="page-breadcrumb-sub">
                  {breadcrumbSub}
                </p>
              )}
            </div>
            <div className="page-hero-actions" id={PAGE_HERO_ACTIONS_ID} />
            <div className="page-hero-glow" aria-hidden="true" />
          </header>

          <div className="page-canvas">
            <div className="page-content">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}
