'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons/core-free-icons";
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/user-session-provider'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { toast } from 'sonner'

export default function MentorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { userId, role, isLoading, isOnboarded } = useSession()

  useEffect(() => {
    // Wait for session to load
    if (isLoading || !userId) return

    // Check if user is a mentor
    if (role !== 'mentor') {
      toast.error('Access denied. This dashboard is for mentors only.')
      const correctDashboard = getRoleBasedDashboard(role)
      console.log(`[MentorLayout] Non-mentor (${role}) attempting to access mentor dashboard, redirecting to ${correctDashboard}`)
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

  // If not a mentor, show loading while redirecting
  if (role !== 'mentor' && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return <>{children}</>
}
