'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Refresh01Icon, Tick01Icon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useOfflineSync } from '@/hooks/use-offline-sync'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineIndicator() {
  const { isOnline, effectiveType, isHydrated } = useNetworkStatus()
  const { isSyncing, pendingCount, lastSyncTime, lastError, triggerSync } = useOfflineSync()

  // Don't show anything during SSR or if online and no pending items
  if (!isHydrated || (isOnline && pendingCount === 0 && !isSyncing)) {
    return null
  }

  const getConnectionQuality = () => {
    if (!isOnline) return 'offline'
    if (!effectiveType) return 'unknown'
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow'
    return 'good'
  }

  const connectionQuality = getConnectionQuality()

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-auto md:max-w-sm',
        'bg-card border border-border rounded-lg shadow-lg p-4',
        'animate-in slide-in-from-bottom duration-300'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className={cn(
            'p-2 rounded-full',
            !isOnline && 'bg-red-500/10 text-red-500',
            isOnline && isSyncing && 'bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400',
            isOnline && !isSyncing && pendingCount > 0 && 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
            isOnline && !isSyncing && pendingCount === 0 && 'bg-green-500/10 text-green-500'
          )}
        >
          {!isOnline ? (
            <HugeiconsIcon icon={WifiOff01Icon} className="w-5 h-5" />
          ) : isSyncing ? (
            <HugeiconsIcon icon={Refresh01Icon} className="w-5 h-5 animate-spin" />
          ) : lastError ? (
            <HugeiconsIcon icon={AlertCircleIcon} className="w-5 h-5" />
          ) : (
            <HugeiconsIcon icon={Tick01Icon} className="w-5 h-5" />
          )}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">
            {!isOnline
              ? "You're offline"
              : isSyncing
              ? 'Syncing your changes...'
              : lastError
              ? 'Sync error'
              : pendingCount > 0
              ? `${pendingCount} changes pending`
              : 'All changes synced'}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {!isOnline
              ? "Your changes are saved locally and will sync when you're back online."
              : isSyncing
              ? `${pendingCount} items remaining`
              : lastError
              ? lastError
              : connectionQuality === 'slow'
              ? 'Slow connection detected'
              : lastSyncTime
              ? `Last synced ${formatTimeAgo(lastSyncTime)}`
              : 'Ready to sync'}
          </p>
        </div>

        {/* Actions */}
        {isOnline && pendingCount > 0 && !isSyncing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerSync}
            className="text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 hover:bg-brand-purple-500/10 dark:bg-brand-500/10"
          >
            Sync Now
          </Button>
        )}
      </div>
    </div>
  )
}

// Helper function to format time ago
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
