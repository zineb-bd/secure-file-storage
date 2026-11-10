import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { I18nProvider } from '@/i18n/I18nContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, AdminRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { UploadPage } from '@/pages/UploadPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { SharedPage } from '@/pages/SharedPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ArchivedPage } from '@/pages/ArchivedPage'
import { TrashPage } from '@/pages/TrashPage'
import { AnnuairePage } from '@/pages/AnnuairePage'
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage'
import { AdminConfigPage } from '@/pages/admin/AdminPages'
import { ShareLinkPage } from '@/pages/ShareLinkPage'
import { PREF_COMPACT_TABLE_KEY, PREF_HOME_PAGE_KEY } from '@/constants'

const HOME_PAGES = new Set(['/', '/documents', '/favorites', '/shared', '/categories'])

function readHomePage() {
  const v = localStorage.getItem(PREF_HOME_PAGE_KEY) || '/'
  return HOME_PAGES.has(v) ? v : '/'
}

function HomeRoute() {
  const home = readHomePage()
  if (home !== '/') return <Navigate to={home} replace />
  return <DashboardPage />
}

function CompactTableSync() {
  useEffect(() => {
    const apply = () => {
      const on = localStorage.getItem(PREF_COMPACT_TABLE_KEY) === 'true'
      document.documentElement.dataset.compactTable = on ? 'true' : 'false'
    }
    apply()
    window.addEventListener('storage', apply)
    return () => window.removeEventListener('storage', apply)
  }, [])
  return null
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <CompactTableSync />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="/share" element={<ShareLinkPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<HomeRoute />} />
                  <Route path="documents/upload" element={<UploadPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="favorites" element={<FavoritesPage />} />
                  <Route path="shared" element={<SharedPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="archived" element={<ArchivedPage />} />
                  <Route path="trash" element={<TrashPage />} />
                  <Route path="annuaire" element={<AnnuairePage />} />
                  <Route path="profile" element={<Navigate to="/annuaire" replace />} />
                  <Route path="admin/users" element={<Navigate to="/annuaire?tab=users" replace />} />
                  <Route path="admin/groups" element={<Navigate to="/annuaire?tab=groups" replace />} />
                  <Route element={<AdminRoute />}>
                    <Route path="admin/audit" element={<AdminAuditPage />} />
                    <Route path="admin/config" element={<AdminConfigPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}
