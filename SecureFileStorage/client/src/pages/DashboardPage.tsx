import { useAuth } from '@/context/AuthContext'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { HomeDashboard } from '@/components/dashboard/HomeDashboard'

export function DashboardPage() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminDashboard /> : <HomeDashboard />
}
