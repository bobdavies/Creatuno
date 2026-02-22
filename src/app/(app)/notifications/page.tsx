'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, Briefcase01Icon, CheckmarkCircle01Icon, Delete02Icon, FileAttachmentIcon, Loading02Icon, Mail01Icon, MailReply01Icon, Message01Icon, Notification01Icon, PackageIcon, Refresh01Icon, RotateLeft01Icon, StarIcon, Tick01Icon, TickDouble01Icon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons";
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import { MdFavoriteBorder } from 'react-icons/md'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import SpotlightCard from '@/components/SpotlightCard'
import { OfflineBanner } from '@/components/shared/offline-banner'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

const CATEGORY_TABS = [
  { key: 'all', label: 'All', types: null },
  { key: 'mentorship', label: 'Mentorship', types: ['mentorship_request', 'mentorship_response', 'mentorship_feedback', 'mentorship_offer', 'mentorship_ended'] },
  { key: 'village', label: 'Village Square', types: ['post_like', 'like', 'post_comment', 'comment'] },
  { key: 'applications', label: 'Applications', types: ['new_application', 'application', 'application_status'] },
  { key: 'work', label: 'Work', types: ['work_submitted', 'work_approved', 'revision_requested'] },
] as const

const URGENT_TYPES = new Set(['mentorship_request', 'mentorship_offer', 'application_status', 'revision_requested'])

// ─── Helpers ────────────────────────────────────────────────────────────────

function getIconConfig(type: string): { icon: React.ElementType; gradient: string; iconColor: string } {
  switch (type) {
    case 'mentorship_request':
    case 'mentorship_response':
    case 'mentorship_feedback':
    case 'mentorship_offer':
    case 'mentorship_ended':
      return { icon: UserGroupIcon, gradient: 'from-brand-500/20 to-brand-purple-500/10', iconColor: 'text-brand-purple-600 dark:text-brand-400' }
    case 'new_application':
    case 'application':
    case 'application_status':
      return { icon: Briefcase01Icon, gradient: 'from-green-500/20 to-emerald-500/10', iconColor: 'text-green-500' }
    case 'post_like':
    case 'like':
      return { icon: MdFavoriteBorder, gradient: 'from-red-500/20 to-rose-500/10', iconColor: 'text-red-500' }
    case 'post_comment':
    case 'comment':
      return { icon: Message01Icon, gradient: 'from-brand-purple-500/20 to-brand-purple-500/10', iconColor: 'text-brand-purple-600 dark:text-brand-400' }
    case 'portfolio_view':
      return { icon: StarIcon, gradient: 'from-brand-500/20 to-brand-purple-500/10', iconColor: 'text-brand-600 dark:text-brand-400' }
    case 'work_submitted':
      return { icon: PackageIcon, gradient: 'from-brand-purple-500/20 to-brand-purple-500/10', iconColor: 'text-brand-purple-600 dark:text-brand-400' }
    case 'work_approved':
      return { icon: CheckmarkCircle01Icon, gradient: 'from-green-500/20 to-emerald-500/10', iconColor: 'text-green-500' }
    case 'revision_requested':
      return { icon: RotateLeft01Icon, gradient: 'from-brand-500/20 to-brand-purple-500/10', iconColor: 'text-brand-600 dark:text-brand-400' }
    case 'new_message':
      return { icon: Mail01Icon, gradient: 'from-brand-purple-500/20 to-brand-purple-500/10', iconColor: 'text-brand-purple-600 dark:text-brand-400' }
    default:
      return { icon: Notification01Icon, gradient: 'from-muted/50 to-muted/30', iconColor: 'text-muted-foreground' }
  }
}

function getActionConfig(type: string, data?: Record<string, unknown>): { label: string; href: string; icon: React.ElementType } | null {
  switch (type) {
    case 'new_message': {
      const senderId = data?.sender_id as string | undefined
      return { label: 'VIEW MESSAGE', href: senderId ? `/messages/chat/${senderId}` : '/messages', icon: Mail01Icon }
    }
    case 'mentorship_request':
      return { label: 'REVIEW NOW', href: '/mentorship', icon: ArrowRight01Icon }
    case 'mentorship_offer': {
      const offerId = (data?.offer_id ?? data?.request_id ?? data?.id) as string | undefined
      return { label: 'VIEW OFFER', href: offerId ? `/mentorship/offer/${offerId}` : '/mentorship', icon: ViewIcon }
    }
    case 'mentorship_response':
    case 'mentorship_feedback':
    case 'mentorship_ended':
      return { label: 'VIEW', href: '/mentorship', icon: ViewIcon }
    case 'post_comment':
    case 'comment': {
      const postId = data?.post_id as string | undefined
      return { label: 'REPLY', href: postId ? `/feed?post=${postId}` : '/feed', icon: MailReply01Icon }
    }
    case 'post_like':
    case 'like': {
      const likedPostId = data?.post_id as string | undefined
      return { label: 'VIEW POST', href: likedPostId ? `/feed?post=${likedPostId}` : '/feed', icon: ViewIcon }
    }
    case 'new_application': {
      return { label: 'VIEW APPLICATION', href: '/dashboard/employer/applications', icon: ViewIcon }
    }
    case 'application':
    case 'application_status':
      return { label: 'VIEW DETAILS', href: '/dashboard/applications', icon: ViewIcon }
    case 'work_submitted':
      return { label: 'VIEW WORK', href: '/dashboard/employer/applications', icon: FileAttachmentIcon }
    case 'work_approved':
    case 'revision_requested':
      return { label: 'VIEW WORK', href: '/dashboard/applications', icon: FileAttachmentIcon }
    case 'portfolio_view':
      return { label: 'VIEW PORTFOLIOS', href: '/dashboard/portfolios', icon: ViewIcon }
    default:
      return null
  }
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()

  const groups: { today: Notification[]; yesterday: Notification[]; earlier: Notification[] } = {
    today: [],
    yesterday: [],
    earlier: [],
  }

  for (const n of notifications) {
    const d = new Date(n.created_at).toDateString()
    if (d === today) groups.today.push(n)
    else if (d === yesterday) groups.yesterday.push(n)
    else groups.earlier.push(n)
  }

  const result: { label: string; items: Notification[] }[] = []
  if (groups.today.length > 0) result.push({ label: 'Today', items: groups.today })
  if (groups.yesterday.length > 0) result.push({ label: 'Yesterday', items: groups.yesterday })
  if (groups.earlier.length > 0) result.push({ label: 'Earlier', items: groups.earlier })
  return result
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [visibleCount, setVisibleCount] = useState(20)

  // Cached fetch for notifications
  const { data: notifData, isLoading: isCacheLoading, isFromCache, refresh: refreshNotifications } = useCachedFetch<{ notifications?: Notification[] }>('/api/notifications', {
    cacheKey: 'notifications:all',
    ttlMs: 10 * 60 * 1000, // 10 min
  })

  useEffect(() => {
    if (notifData?.notifications) {
      setNotifications(notifData.notifications)
    }
    if (!isCacheLoading) setIsLoading(false)
  }, [notifData, isCacheLoading])

  const loadNotifications = () => {
    refreshNotifications()
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
      toast.success('Notification removed')
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const clearAllRead = async () => {
    const readIds = notifications.filter(n => n.is_read).map(n => n.id)
    if (readIds.length === 0) return
    for (const id of readIds) {
      fetch(`/api/notifications?id=${id}`, { method: 'DELETE' }).catch(() => {})
    }
    setNotifications(prev => prev.filter(n => !n.is_read))
    toast.success(`Cleared ${readIds.length} read notification${readIds.length > 1 ? 's' : ''}`)
  }

  // ─── Derived state ────────────────────────────────────────────────────

  const unreadCount = notifications.filter(n => !n.is_read).length
  const readCount = notifications.filter(n => n.is_read).length

  const tabCounts = CATEGORY_TABS.map(tab => {
    if (!tab.types) return notifications.length
    return notifications.filter(n => (tab.types as readonly string[]).includes(n.type)).length
  })

  const filteredNotifications = (() => {
    const tab = CATEGORY_TABS.find(t => t.key === activeTab)
    if (!tab || !tab.types) return notifications
    return notifications.filter(n => (tab.types as readonly string[]).includes(n.type))
  })()

  const visibleNotifications = filteredNotifications.slice(0, visibleCount)
  const hasMore = filteredNotifications.length > visibleCount

  const groups = groupByDate(visibleNotifications)

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <OfflineBanner message="You're offline — showing cached notifications" />

      {/* ━━━ HERO HEADER ━━━ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-500/80 dark:text-brand-400/80">Notifications</span>
            </div>
            <div className="flex items-center justify-between">
        <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  <span className="text-brand-dark dark:text-foreground">
                    Notifications Center
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">Stay updated with your creative community</p>
        </div>
        <div className="flex items-center gap-2">
                <button
                  onClick={loadNotifications}
                  disabled={isLoading}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Refresh01Icon} className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                </button>
          {unreadCount > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={markAllAsRead}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all"
                  >
                    <HugeiconsIcon icon={TickDouble01Icon} className="w-3.5 h-3.5" />
                    Mark all as read
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-4">

        {/* Category Filter Tabs */}
        <motion.div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-hide"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
        >
          {CATEGORY_TABS.map((tab, i) => {
            const isActive = activeTab === tab.key
            const count = tabCounts[i]
            return (
              <motion.button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setVisibleCount(20) }}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="notifTab"
                    className="absolute inset-0 bg-brand-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'relative z-10 text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1',
                    isActive ? 'bg-white/20 text-white' : 'bg-muted/60 text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </motion.button>
            )
          })}
        </motion.div>

        {/* Batch Actions */}
        {readCount > 0 && activeTab === 'all' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4"
          >
            <button
              onClick={clearAllRead}
              className="text-[11px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear {readCount} read notification{readCount > 1 ? 's' : ''}
            </button>
          </motion.div>
        )}

      {/* Loading State */}
      {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <SpotlightCard key={i} className="p-4 sm:p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted/60 rounded" />
                    <div className="h-3 w-full bg-muted/40 rounded" />
                    <div className="h-3 w-2/3 bg-muted/40 rounded" />
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-2 h-2 rounded-full bg-muted/40" />
                      <div className="h-2.5 w-16 bg-muted/40 rounded" />
                    </div>
                  </div>
                </div>
              </SpotlightCard>
          ))}
        </div>
        ) : groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group, gi) => (
              <div key={group.label}>
                {/* Time Group Header */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: gi * 0.1 }}
                  className="flex items-center gap-3 mb-3"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
                  <div className="flex-1 h-px bg-border/50" />
                </motion.div>

                {/* Notification Cards */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {group.items.map((notification, ni) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
                        transition={{ duration: 0.4, delay: (gi * 0.1) + (ni * 0.06), ease }}
                        layout
                      >
                        <NotificationCard
                          notification={notification}
                          onMarkRead={() => markAsRead(notification.id)}
                          onDelete={() => deleteNotification(notification.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center pt-4"
              >
                <button
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="flex items-center gap-2 px-6 py-3 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm text-sm font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all"
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4" />
                  Load older notifications
                </button>
              </motion.div>
            )}
          </div>
      ) : (
        /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="text-center py-16 rounded-2xl border-2 border-dashed border-border/50"
          >
            <div className="animate-float inline-block mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={Notification01Icon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {activeTab !== 'all' ? `No ${CATEGORY_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} notifications` : "You're all caught up!"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {activeTab !== 'all'
                ? `When you receive ${CATEGORY_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} updates, they will appear here.`
                : "You don't have any notifications yet. Start engaging with the community!"}
            </p>
            {activeTab === 'all' && (
              <Button className="bg-brand-500 hover:bg-brand-600 rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                <Link href="/feed">
                  Explore Village Square
                  <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Notification Card Component ────────────────────────────────────────────

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification
  onMarkRead: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const { icon, gradient, iconColor } = getIconConfig(notification.type)
  const iconEl = typeof icon === 'function'
    ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: cn('w-5 h-5', iconColor) })
    : <HugeiconsIcon icon={icon} className={cn('w-5 h-5', iconColor)} />
  const action = getActionConfig(notification.type, notification.data)
  const isUrgent = URGENT_TYPES.has(notification.type)
  const isComment = ['post_comment', 'comment'].includes(notification.type)
  const isUnread = !notification.is_read

  const handleCardClick = () => {
    if (isUnread) onMarkRead()
    if (action?.href) router.push(action.href)
  }

  return (
    <SpotlightCard
      onClick={handleCardClick}
      className={cn(
        'group relative overflow-hidden transition-all duration-300 cursor-pointer p-0',
        isUnread
          ? 'hover:border-brand-purple-500/50 dark:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/5'
          : 'hover:shadow-lg hover:shadow-black/5'
      )}
    >
      {/* Unread orange dot */}
      <AnimatePresence>
        {isUnread && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-brand-500 shadow-sm shadow-brand-purple-500/30 dark:shadow-brand-500/30"
          />
        )}
      </AnimatePresence>

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0',
            gradient
          )}>
            {iconEl}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h4 className={cn(
                'text-foreground leading-tight',
                isUnread ? 'font-bold text-[15px]' : 'font-medium text-sm'
              )}>
                {notification.title}
              </h4>
              {isUrgent && isUnread && (
                <Badge className="bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/20 dark:border-brand-500/20 text-[9px] font-bold px-1.5 py-0 uppercase tracking-wider flex-shrink-0">
                  Urgent
                </Badge>
              )}
            </div>

            <p className={cn(
              'text-muted-foreground mt-1',
              isUnread ? 'text-sm' : 'text-xs'
            )}>
              {notification.message}
            </p>

            {/* Quote block for comments */}
            {isComment && Boolean(notification.message) && (
              <div className="mt-3 pl-3 border-l-2 border-brand-500/40 bg-brand-purple-500/5 dark:bg-brand-500/5 rounded-r-lg py-2 pr-3">
                <p className="text-xs text-muted-foreground italic line-clamp-2">
                  &ldquo;{String(notification.message)}&rdquo;
                </p>
              </div>
            )}

            {/* Attachment preview from data */}
            {typeof notification.data?.filename === 'string' && (
              <div className="mt-3 flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                  <HugeiconsIcon icon={FileAttachmentIcon} className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project File</p>
                  <p className="text-xs text-foreground truncate">{String(notification.data.filename)}</p>
                </div>
              </div>
            )}

            {/* Action button + timestamp */}
            <div className="flex items-center gap-3 mt-3">
              {action && (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href={action.href}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all',
                      isUrgent && isUnread
                        ? 'bg-brand-500 text-brand-dark shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 hover:bg-brand-600'
                        : 'border border-border/50 text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30'
                    )}
                  >
                    {action.label}
                    <HugeiconsIcon icon={action.icon} className="w-3 h-3" />
                  </Link>
                </motion.div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {formatDistanceToNow(notification.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Hover-revealed action icons */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
            {isUnread && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkRead() }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors"
                title="Mark as read"
              >
                <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </SpotlightCard>
  )
}
