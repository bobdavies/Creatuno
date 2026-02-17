'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'

interface UserProfile {
  role: string | null
  full_name: string | null
}

interface LandingAuthState {
  isLoaded: boolean
  isSignedIn: boolean
  isCheckingProfile: boolean
  profile: UserProfile | null
  isOnboarded: boolean
}

const LandingAuthContext = createContext<LandingAuthState>({
  isLoaded: false,
  isSignedIn: false,
  isCheckingProfile: false,
  profile: null,
  isOnboarded: false,
})

export function LandingAuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  const [isCheckingProfile, setIsCheckingProfile] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    async function checkProfile() {
      if (!isLoaded || !isSignedIn) {
        setProfile(null)
        return
      }

      setIsCheckingProfile(true)
      try {
        const response = await fetch('/api/profiles')
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile)
        }
      } catch (error) {
        console.error('Error checking profile:', error)
      } finally {
        setIsCheckingProfile(false)
      }
    }

    checkProfile()
  }, [isLoaded, isSignedIn])

  const isOnboarded = !!(profile?.full_name && profile?.role)

  return (
    <LandingAuthContext.Provider value={{ 
      isLoaded: !!isLoaded, 
      isSignedIn: !!isSignedIn, 
      isCheckingProfile, 
      profile, 
      isOnboarded 
    }}>
      {children}
    </LandingAuthContext.Provider>
  )
}

export function useLandingAuth() {
  return useContext(LandingAuthContext)
}
