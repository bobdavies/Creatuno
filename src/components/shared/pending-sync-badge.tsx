'use client'
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudLoadingIcon, Loading02Icon } from "@hugeicons/core-free-icons";
import { cn } from '@/lib/utils'

interface PendingSyncBadgeProps {
  /** Whether the item is currently being synced */
  isSyncing?: boolean
  /** Additional className */
  className?: string
}

/**
 * A small badge displayed on items created offline that haven't synced yet.
 * Shows a cloud-off icon when pending, or a spinner when actively syncing.
 *
 * Usage: <PendingSyncBadge isSyncing={false} />
 */
export function PendingSyncBadge({ isSyncing = false, className }: PendingSyncBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
        isSyncing
          ? 'bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400'
          : 'bg-brand-purple-500/10 text-brand-600 dark:text-brand-purple-400',
        className
      )}
    >
      {isSyncing ? (
        <>
          <HugeiconsIcon icon={Loading02Icon} className="w-2.5 h-2.5 animate-spin" />
          Syncing…
        </>
      ) : (
        <>
          <HugeiconsIcon icon={CloudLoadingIcon} className="w-2.5 h-2.5" />
          Pending sync
        </>
      )}
    </span>
  )
}
