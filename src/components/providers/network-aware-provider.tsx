'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useNetworkStatus, useIsSlowConnection, useDataSaverMode } from '@/hooks/use-network-status'

interface NetworkContextValue {
  isOnline: boolean
  isOffline: boolean
  isSlowConnection: boolean
  isDataSaver: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  shouldReduceData: boolean
  shouldReduceMotion: boolean
  imageQuality: 'low' | 'medium' | 'high'
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isOffline: false,
  isSlowConnection: false,
  isDataSaver: false,
  shouldReduceData: false,
  shouldReduceMotion: false,
  imageQuality: 'high',
})

export function NetworkAwareProvider({ children }: { children: ReactNode }) {
  const { isOnline, effectiveType } = useNetworkStatus()
  const isSlowConnection = useIsSlowConnection()
  const isDataSaver = useDataSaverMode()

  const value = useMemo<NetworkContextValue>(() => {
    const shouldReduceData = isSlowConnection || isDataSaver || !isOnline
    const shouldReduceMotion = isSlowConnection || isDataSaver

    let imageQuality: 'low' | 'medium' | 'high' = 'high'
    if (!isOnline || isDataSaver) {
      imageQuality = 'low'
    } else if (isSlowConnection || effectiveType === '3g') {
      imageQuality = 'medium'
    }

    return {
      isOnline,
      isOffline: !isOnline,
      isSlowConnection,
      isDataSaver,
      effectiveType,
      shouldReduceData,
      shouldReduceMotion,
      imageQuality,
    }
  }, [isOnline, effectiveType, isSlowConnection, isDataSaver])

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}
