import { offlineDB } from '@/lib/offline/indexed-db'

const SESSION_STORAGE_KEY = 'creatuno_user_session'

/**
 * Get stored user session from localStorage
 */
export function getStoredUserSession(): { userId: string | null; role: string | null } {
  if (typeof window === 'undefined') return { userId: null, role: null }
  
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { userId: null, role: null }
}

/**
 * Store user session in localStorage
 */
export function storeUserSession(userId: string, role: string | null): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId, role }))
}

/**
 * Clear user session from localStorage
 */
export function clearUserSession(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(SESSION_STORAGE_KEY)
  localStorage.removeItem('creatuno_recent_searches')
}

/**
 * Clear all user-specific data (IndexedDB, localStorage)
 * Call this on sign out or when user changes
 */
export async function clearAllUserData(): Promise<void> {
  try {
    // Clear IndexedDB
    await offlineDB.clearAllOfflineData()
    console.log('[Auth] Cleared IndexedDB data')
  } catch (error) {
    console.error('[Auth] Error clearing IndexedDB:', error)
  }

  // Clear localStorage session
  clearUserSession()
  console.log('[Auth] Cleared localStorage session')
}

/**
 * Check if current user matches stored session
 * If different user, clear previous user's data
 */
export async function validateUserSession(currentUserId: string): Promise<boolean> {
  const stored = getStoredUserSession()
  
  if (stored.userId && stored.userId !== currentUserId) {
    console.log('[Auth] User changed, clearing previous user data')
    await clearAllUserData()
    return false // Session was invalidated
  }
  
  return true // Session is valid or new
}

/**
 * Get role-based redirect URL (generic)
 */
export function getRoleBasedRedirect(role: string | null): string {
  return getRoleBasedDashboard(role)
}

/**
 * Get the dashboard URL for a specific role
 */
export function getRoleBasedDashboard(role: string | null): string {
  switch (role) {
    case 'mentor':
      return '/dashboard/mentor'
    case 'employer':
      return '/dashboard/employer'
    case 'investor':
      return '/dashboard/investor'
    case 'creative':
    default:
      return '/dashboard'
  }
}

/**
 * Check if user is on their correct dashboard
 */
export function isCorrectDashboard(role: string | null, pathname: string): boolean {
  const correctDashboard = getRoleBasedDashboard(role)
  
  // If on the generic dashboard page, check if it's the right one for the role
  if (pathname === '/dashboard') {
    return role === 'creative' || role === null
  }
  
  // Check role-specific dashboards
  if (pathname.startsWith('/dashboard/mentor')) {
    return role === 'mentor'
  }
  if (pathname.startsWith('/dashboard/employer')) {
    return role === 'employer'
  }
  if (pathname.startsWith('/dashboard/investor')) {
    return role === 'investor'
  }
  
  // Other dashboard routes (portfolios, applications, etc.) are accessible to all
  return true
}

/**
 * Check if user can access a specific route based on role
 */
export function canAccessRoute(role: string | null, pathname: string): boolean {
  // Routes that require specific roles
  const mentorRoutes = ['/dashboard/mentees', '/dashboard/mentor-requests']
  const employerRoutes = ['/dashboard/candidates', '/dashboard/job-posts']
  const investorRoutes = ['/dashboard/investments', '/dashboard/portfolio-watchlist']
  
  // Check role-specific routes
  if (mentorRoutes.some(route => pathname.startsWith(route))) {
    return role === 'mentor'
  }
  
  if (employerRoutes.some(route => pathname.startsWith(route))) {
    return role === 'employer'
  }
  
  if (investorRoutes.some(route => pathname.startsWith(route))) {
    return role === 'investor'
  }
  
  // All other routes are accessible
  return true
}
