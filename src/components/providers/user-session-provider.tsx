'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon } from "@hugeicons/core-free-icons";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { 
  clearAllUserData, 
  validateUserSession, 
  storeUserSession,
  getStoredUserSession,
  getRoleBasedDashboard
} from '@/lib/auth/user-session'

interface UserSessionContextType {
  userId: string | null
  role: string | null
  isLoading: boolean
  isOnboarded: boolean
  handleSignOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const UserSessionContext = createContext<UserSessionContextType>({
  userId: null,
  role: null,
  isLoading: true,
  isOnboarded: false,
  handleSignOut: async () => {},
  refreshSession: async () => {},
})

export function useSession() {
  return useContext(UserSessionContext)
}

interface UserSessionProviderProps {
  children: ReactNode
}

export function UserSessionProvider({ children }: UserSessionProviderProps) {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const pathname = usePathname()

  // Track client-side mount to prevent hydration mismatch.
  // On the server, Clerk middleware makes isLoaded=true (for non-signed-in users),
  // so the server would render children. But on the client, isLoaded starts as false,
  // so the client would render the loading screen — causing a mismatch.
  // By gating on `mounted`, both server and client render the loading screen initially.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const [session, setSession] = useState({
    userId: null as string | null,
    role: null as string | null,
    isLoading: true,
    isOnboarded: false,
  })

  // Initialize and validate session
  useEffect(() => {
    async function initSession() {
      if (!isLoaded) return

      // If user is not logged in
      if (!user) {
        setSession({
          userId: null,
          role: null,
          isLoading: false,
          isOnboarded: false,
        })
        return
      }

      console.log('[Session] Initializing session for user:', user.id)

      // Check if user changed - clear previous user's data
      const storedSession = getStoredUserSession()
      if (storedSession.userId && storedSession.userId !== user.id) {
        console.log('[Session] User changed from', storedSession.userId, 'to', user.id)
        console.log('[Session] Clearing previous user data...')
        await clearAllUserData()
      }

      // Fetch current user's role from Supabase
      try {
        const response = await fetch('/api/profiles')
        if (response.ok) {
          const data = await response.json()
          const role = data.profile?.role || null
          const isOnboarded = !!(data.profile?.full_name && data.profile?.role)

          console.log('[Session] User role:', role, 'Onboarded:', isOnboarded)

          // Store session
          storeUserSession(user.id, role)

          setSession({
            userId: user.id,
            role,
            isLoading: false,
            isOnboarded,
          })

          // Redirect to onboarding if needed
          if (!isOnboarded && !pathname.startsWith('/onboarding') && !pathname.startsWith('/sign-')) {
            console.log('[Session] User not onboarded, redirecting to onboarding')
            router.push('/onboarding')
            return
          }

          // Redirect to role-specific dashboard if on generic dashboard
          if (isOnboarded && pathname === '/dashboard' && role && role !== 'creative') {
            const correctDashboard = getRoleBasedDashboard(role)
            console.log('[Session] Redirecting', role, 'to', correctDashboard)
            router.push(correctDashboard)
          }
        } else {
          // OFFLINE FIX: Check stored session before assuming needs onboarding
          const stored = getStoredUserSession()
          if (stored.userId === user.id && stored.role) {
            console.log('[Session] API failed but cached session exists, role:', stored.role)
            setSession({
              userId: user.id,
              role: stored.role,
              isLoading: false,
              isOnboarded: true,
            })
          } else {
            // No profile and no cached session - genuinely needs onboarding
            console.log('[Session] No profile found, user needs onboarding')
            storeUserSession(user.id, null)
            setSession({
              userId: user.id,
              role: null,
              isLoading: false,
              isOnboarded: false,
            })

            if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/sign-')) {
              router.push('/onboarding')
            }
          }
        }
      } catch (error) {
        console.error('[Session] Error fetching profile:', error)
        // OFFLINE FIX: Fall back to locally stored session
        const stored = getStoredUserSession()
        if (stored.userId === user.id && stored.role) {
          console.log('[Session] Offline — using cached session, role:', stored.role)
          setSession({
            userId: user.id,
            role: stored.role,
            isLoading: false,
            isOnboarded: true,
          })
        } else {
          storeUserSession(user.id, null)
          setSession({
            userId: user.id,
            role: null,
            isLoading: false,
            isOnboarded: false,
          })
        }
      }
    }

    initSession()
  }, [isLoaded, user, pathname, router])

  // Sign out handler - clears all user data
  const handleSignOut = async () => {
    console.log('[Session] Signing out user:', user?.id)
    
    // Clear all local data first
    await clearAllUserData()
    
    // Then sign out from Clerk
    await signOut()
    
    // Reset session state
    setSession({
      userId: null,
      role: null,
      isLoading: false,
      isOnboarded: false,
    })
  }

  // Refresh session (useful after profile update)
  const refreshSession = async () => {
    if (!user) return

    try {
      const response = await fetch('/api/profiles')
      if (response.ok) {
        const data = await response.json()
        const role = data.profile?.role || null
        const isOnboarded = !!(data.profile?.full_name && data.profile?.role)

        storeUserSession(user.id, role)
        setSession({
          userId: user.id,
          role,
          isLoading: false,
          isOnboarded,
        })
      }
    } catch (error) {
      console.error('[Session] Error refreshing session:', error)
      // OFFLINE FIX: Fall back to locally stored session
      const stored = getStoredUserSession()
      if (stored.userId === user.id && stored.role) {
        console.log('[Session] Refresh offline — using cached session, role:', stored.role)
        setSession({
          userId: user.id,
          role: stored.role,
          isLoading: false,
          isOnboarded: true,
        })
      }
    }
  }

  // Show loading state — also gate on `mounted` to ensure server/client initial render match
  if (!mounted || !isLoaded || (user && session.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <UserSessionContext.Provider
      value={{
        ...session,
        handleSignOut,
        refreshSession,
      }}
    >
      {children}
    </UserSessionContext.Provider>
  )
}
