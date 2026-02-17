'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons/core-free-icons";
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/components/providers/user-session-provider'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'

interface DashboardRouterProps {
  children: React.ReactNode
  requireRole?: 'creative' | 'mentor' | 'employer' | 'investor'
}

/**
 * Component that handles role-based routing for dashboards
 * Wraps dashboard pages to ensure users are on their correct dashboard
 */
export function DashboardRouter({ children, requireRole }: DashboardRouterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { userId, role, isLoading, isOnboarded } = useSession()

  useEffect(() => {
    // Wait for session to load
    if (isLoading || !userId) return

    // Don't redirect during onboarding
    if (!isOnboarded) return

    // If a specific role is required, check it
    if (requireRole && role !== requireRole) {
      const correctDashboard = getRoleBasedDashboard(role)
      console.log(`[DashboardRouter] User role '${role}' cannot access ${requireRole} dashboard, redirecting to ${correctDashboard}`)
      router.push(correctDashboard)
      return
    }

    // If on generic /dashboard and user is not a creative, redirect to their dashboard
    if (pathname === '/dashboard' && role && role !== 'creative') {
      const correctDashboard = getRoleBasedDashboard(role)
      console.log(`[DashboardRouter] Redirecting ${role} from /dashboard to ${correctDashboard}`)
      router.push(correctDashboard)
    }
  }, [isLoading, userId, role, isOnboarded, requireRole, pathname, router])

  // Show loading while determining role
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // If requireRole is specified and doesn't match, show loading while redirecting
  if (requireRole && role !== requireRole && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // If on /dashboard and role requires different dashboard, show loading
  if (pathname === '/dashboard' && role && role !== 'creative' && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return <>{children}</>
}
