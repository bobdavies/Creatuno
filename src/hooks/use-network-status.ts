'use client'

import { useState, useEffect, useCallback } from 'react'
import type { NetworkStatus } from '@/types'

// Extended navigator type for Network Information API
interface NetworkInformation {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  downlink?: number
  rtt?: number
  saveData?: boolean
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation
  mozConnection?: NetworkInformation
  webkitConnection?: NetworkInformation
}

export function useNetworkStatus(): NetworkStatus & { isHydrated: boolean } {
  // IMPORTANT: Always start with a consistent default for SSR
  // This prevents hydration mismatch errors
  const [isHydrated, setIsHydrated] = useState(false)
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true, // Default to true for SSR - will update after hydration
  })

  const getConnection = useCallback((): NetworkInformation | undefined => {
    if (typeof navigator === 'undefined') return undefined
    const nav = navigator as NavigatorWithConnection
    return nav.connection || nav.mozConnection || nav.webkitConnection
  }, [])

  const updateNetworkStatus = useCallback(() => {
    if (typeof navigator === 'undefined') return
    
    const connection = getConnection()

    setStatus({
      isOnline: navigator.onLine,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
    })
  }, [getConnection])

  useEffect(() => {
    // Mark as hydrated and get actual status
    setIsHydrated(true)
    updateNetworkStatus()

    // Online/offline events
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    // Network Information API changes
    const connection = getConnection()
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus)
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)

      const conn = getConnection()
      if (conn) {
        conn.removeEventListener('change', updateNetworkStatus)
      }
    }
  }, [updateNetworkStatus, getConnection])

  return { ...status, isHydrated }
}

// Hook to check if connection is slow (for adapting behavior)
export function useIsSlowConnection(): boolean {
  const { effectiveType, isOnline } = useNetworkStatus()

  if (!isOnline) return true
  if (!effectiveType) return false

  return effectiveType === 'slow-2g' || effectiveType === '2g'
}

// Hook to check if data saver mode is enabled
export function useDataSaverMode(): boolean {
  const [isDataSaver, setIsDataSaver] = useState(false)

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection
    
    if (connection?.saveData) {
      setIsDataSaver(true)
    }
  }, [])

  return isDataSaver
}
