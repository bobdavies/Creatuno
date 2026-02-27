'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Refresh01Icon,
  WifiOff01Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useOfflineSync } from '@/hooks/use-offline-sync'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ease = [0.23, 1, 0.32, 1] as const

export function OfflineIndicator() {
  const { isOnline, isHydrated } = useNetworkStatus()
  const { isSyncing, pendingCount, lastSyncTime, lastError, triggerSync } = useOfflineSync()

  // Track previous online state to detect the transition back online
  const [wasOffline, setWasOffline] = useState(false)
  // Show "back online" success card briefly after reconnecting
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!isOnline) {
      setWasOffline(true)
      setShowBackOnline(false)
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowBackOnline(true)
      setWasOffline(false)
      // Auto-dismiss after 4 s (once sync is not actively running)
      const t = setTimeout(() => setShowBackOnline(false), 4000)
      return () => clearTimeout(t)
    }
  }, [isOnline, isHydrated, wasOffline])

  if (!isHydrated) return null

  const showOfflineModal  = !isOnline
  const showOnlineModal   = showBackOnline && isOnline
  const isVisible         = showOfflineModal || showOnlineModal

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* ── Backdrop with blur ── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[999] bg-background/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* ── Centered modal card ── */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92,  y: 16 }}
            transition={{ duration: 0.4, ease }}
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            className="fixed inset-0 z-[1000] flex items-center justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md">
              {showOfflineModal ? (
                <OfflineCard
                  pendingCount={pendingCount}
                  lastError={lastError}
                />
              ) : (
                <OnlineCard
                  isSyncing={isSyncing}
                  pendingCount={pendingCount}
                  lastSyncTime={lastSyncTime}
                  lastError={lastError}
                  triggerSync={triggerSync}
                  onDismiss={() => setShowBackOnline(false)}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Offline card ─────────────────────────────────────────────────────────────

function OfflineCard({
  pendingCount,
  lastError,
}: {
  pendingCount: number
  lastError?: string
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/20 overflow-hidden">
      {/* Red accent strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400" />

      <div className="px-8 pt-8 pb-7 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"
        >
          <HugeiconsIcon icon={WifiOff01Icon} className="w-10 h-10 text-red-500" />
        </motion.div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">You&rsquo;re offline</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Your internet connection is unavailable. Any changes you make are being
            saved locally and will sync automatically when you&rsquo;re back online.
          </p>
        </div>

        {/* Pending changes pill */}
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-sm text-orange-500 font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending sync
          </motion.div>
        )}

        {lastError && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-500/8 border border-red-500/20 text-left w-full">
            <HugeiconsIcon icon={AlertCircleIcon} className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-500">{lastError}</p>
          </div>
        )}

        {/* Divider + footer note */}
        <div className="w-full pt-1 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            We&rsquo;ll sync your data automatically once the connection is restored.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Back online card ─────────────────────────────────────────────────────────

function OnlineCard({
  isSyncing,
  pendingCount,
  lastSyncTime,
  lastError,
  triggerSync,
  onDismiss,
}: {
  isSyncing: boolean
  pendingCount: number
  lastSyncTime?: number
  lastError?: string
  triggerSync: () => void
  onDismiss: () => void
}) {
  const allSynced = !isSyncing && pendingCount === 0 && !lastError

  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/20 overflow-hidden">
      {/* Green accent strip */}
      <div className={cn(
        'h-1.5 w-full bg-gradient-to-r',
        allSynced
          ? 'from-green-500 via-green-400 to-emerald-400'
          : isSyncing
          ? 'from-brand-purple-500 via-brand-500 to-brand-purple-400'
          : 'from-orange-400 via-brand-500 to-brand-purple-500'
      )} />

      <div className="px-8 pt-8 pb-7 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={cn(
            'w-20 h-20 rounded-3xl flex items-center justify-center border',
            allSynced
              ? 'bg-green-500/10 border-green-500/20'
              : isSyncing
              ? 'bg-brand-purple-500/10 border-brand-purple-500/20 dark:bg-brand-500/10 dark:border-brand-500/20'
              : 'bg-orange-500/10 border-orange-500/20'
          )}
        >
          {isSyncing ? (
            <HugeiconsIcon icon={Refresh01Icon} className="w-10 h-10 text-brand-purple-600 dark:text-brand-400 animate-spin" />
          ) : allSynced ? (
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-10 h-10 text-green-500" />
          ) : (
            <HugeiconsIcon icon={AlertCircleIcon} className="w-10 h-10 text-orange-500" />
          )}
        </motion.div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {isSyncing
              ? 'Syncing your changes...'
              : allSynced
              ? "You're back online!"
              : lastError
              ? 'Sync error'
              : `${pendingCount} changes pending`}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {isSyncing
              ? `Uploading ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} to the server.`
              : allSynced
              ? lastSyncTime
                ? `All your data is up to date. Last synced ${formatTimeAgo(lastSyncTime)}.`
                : 'Your internet connection has been restored and all data is synced.'
              : lastError
              ? lastError
              : 'Your connection is restored. Tap "Sync Now" to upload pending changes.'}
          </p>
        </div>

        {/* Sync progress dots */}
        {isSyncing && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-brand-purple-500 dark:bg-brand-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 w-full pt-1">
          {!isSyncing && pendingCount > 0 && (
            <Button
              onClick={triggerSync}
              className="flex-1 bg-brand-500 hover:bg-brand-600 rounded-xl font-bold"
            >
              <HugeiconsIcon icon={Refresh01Icon} className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onDismiss}
            className={cn('rounded-xl', (!isSyncing && pendingCount > 0) ? '' : 'flex-1')}
          >
            {allSynced ? 'Done' : 'Dismiss'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60)    return 'just now'
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
