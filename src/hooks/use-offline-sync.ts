'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  subscribeSyncStatus,
  performSync,
  hasPendingSync,
  getSyncStatus,
  initSyncManager,
} from '@/lib/offline/sync-manager'
import type { SyncStatus } from '@/types'

let syncManagerInitialized = false

export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus())
  const [hasPending, setHasPending] = useState(false)

  // Initialize sync manager once
  useEffect(() => {
    if (!syncManagerInitialized && typeof window !== 'undefined') {
      initSyncManager()
      syncManagerInitialized = true
    }

    // Subscribe to sync status changes
    const unsubscribe = subscribeSyncStatus(setSyncStatus)

    // Check for pending items (with error handling)
    hasPendingSync()
      .then(setHasPending)
      .catch(() => setHasPending(false))

    return unsubscribe
  }, [])

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    try {
      await performSync()
      const pending = await hasPendingSync()
      setHasPending(pending)
    } catch (error) {
      console.error('Manual sync failed:', error)
    }
  }, [])

  // Refresh pending status
  const refreshPendingStatus = useCallback(async () => {
    try {
      const pending = await hasPendingSync()
      setHasPending(pending)
    } catch (error) {
      console.error('Failed to check pending status:', error)
      setHasPending(false)
    }
  }, [])

  return {
    ...syncStatus,
    hasPending,
    triggerSync,
    refreshPendingStatus,
  }
}
