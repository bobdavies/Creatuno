'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { useNetworkStatus } from '@/hooks/use-network-status'
import { motion, AnimatePresence } from 'framer-motion'

interface OfflineBannerProps {
  /** Custom message to display */
  message?: string
}

/**
 * A thin banner shown at the top of a page when the user is offline.
 * Usage: <OfflineBanner message="Showing cached notifications" />
 */
export function OfflineBanner({ message = 'You\'re offline — showing cached data' }: OfflineBannerProps) {
  const { isOnline, isHydrated } = useNetworkStatus()

  // Don't render during SSR or when online
  if (!isHydrated || isOnline) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden"
      >
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-purple-500/10 border-b border-brand-purple-500/20 text-brand-600 dark:text-brand-purple-400 text-xs font-medium">
          <HugeiconsIcon icon={WifiOff01Icon} className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{message}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 p-0.5 rounded hover:bg-brand-purple-500/10 transition-colors"
            title="Retry"
          >
            <HugeiconsIcon icon={Refresh01Icon} className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
