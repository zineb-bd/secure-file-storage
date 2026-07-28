import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { I18nProvider } from '@/i18n/I18nContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute, AdminRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { UploadPage } from '@/pages/UploadPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { SharedPage } from '@/pages/SharedPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ArchivedPage } from '@/pages/ArchivedPage'
import { TrashPage } from '@/pages/TrashPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage'
import { AdminRolesPage } from '@/pages/admin/AdminRolesPage'
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage'
import { AdminConfigPage } from '@/pages/admin/AdminPages'

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="documents/upload" element={<UploadPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="favorites" element={<FavoritesPage />} />
                  <Route path="shared" element={<SharedPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="archived" element={<ArchivedPage />} />
                  <Route path="trash" element={<TrashPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route element={<AdminRoute />}>
                    <Route path="admin/users" element={<AdminUsersPage />} />
                    <Route path="admin/roles" element={<AdminRolesPage />} />
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
