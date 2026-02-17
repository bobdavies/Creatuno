'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons/core-free-icons";
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/user-session-provider'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { toast } from 'sonner'

export default function EmployerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { userId, role, isLoading, isOnboarded } = useSession()

  useEffect(() => {
    // Wait for session to load
    if (isLoading || !userId) return

    // Check if user is an employer
    if (role !== 'employer') {
      toast.error('Access denied. This dashboard is for employers only.')
      const correctDashboard = getRoleBasedDashboard(role)
      console.log(`[EmployerLayout] Non-employer (${role}) attempting to access employer dashboard, redirecting to ${correctDashboard}`)
      router.push(correctDashboard)
    }
  }, [isLoading, userId, role, router])

  // Show loading while checking role
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // If not an employer, show loading while redirecting
  if (role !== 'employer' && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return <>{children}</>
}
