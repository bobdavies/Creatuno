import { DashboardRouter } from '@/components/dashboard/dashboard-router'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardRouter>{children}</DashboardRouter>
}
