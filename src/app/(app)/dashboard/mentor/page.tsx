'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, ArrowRight01Icon, Loading02Icon, MinusSignIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MentorshipRequest {
  id: string
  mentee_id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string
  goals: string
  skills_to_develop: string[]
  created_at: string
  updated_at?: string
  mentee?: {
    full_name: string
    avatar_url: string | null
    bio: string
    skills: string[]
  }
}

interface MentorProfile {
  full_name: string
  avatar_url: string | null
  is_available_for_mentorship: boolean
  max_mentees: number
  mentor_expertise: string[]
}

// ─── Animation Config ───────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

// ─── Count-Up Hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, isActive = true) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!isActive || target === 0) { setValue(target); return }
    let start = 0
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.round(eased * target)
      setValue(start)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, isActive])
  return value
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MentorDashboardPage() {
  const { userId, role, isLoading: sessionLoading } = useSession()

  const [isLoading, setIsLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState<MentorshipRequest[]>([])
  const [activeMentees, setActiveMentees] = useState<MentorshipRequest[]>([])
  const [pastMentees, setPastMentees] = useState<MentorshipRequest[]>([])
  const [mentorProfile, setMentorProfile] = useState<MentorProfile | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'past'>('requests')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [isEditingCapacity, setIsEditingCapacity] = useState(false)
  const [localMaxMentees, setLocalMaxMentees] = useState(5)
  const [sentOffersCount, setSentOffersCount] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [statsInView, setStatsInView] = useState(false)

  // ─── Data Fetching ─────────────────────────────────────────────────────

  useEffect(() => {
    if (userId && role === 'mentor') {
      loadMentorData()
    }
  }, [userId, role])

  const loadMentorData = async () => {
    setIsLoading(true)
    try {
      const [profileRes, pendingRes, activeRes, pastRes, offersRes, notifsRes] = await Promise.all([
        fetch('/api/profiles'),
        fetch('/api/mentorship?role=mentor&status=pending'),
        fetch('/api/mentorship?role=mentor&status=accepted'),
        fetch('/api/mentorship?role=mentor&status=declined'),
        fetch('/api/mentorship/offers?role=mentor').catch(() => null),
        fetch('/api/notifications?unread_only=true').catch(() => null),
      ])

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        if (profileData.profile) {
          const p = profileData.profile
          const mp: MentorProfile = {
            full_name: p.full_name || 'Mentor',
            avatar_url: p.avatar_url || null,
            is_available_for_mentorship: p.is_available_for_mentorship ?? true,
            max_mentees: p.max_mentees ?? 5,
            mentor_expertise: p.mentor_expertise || [],
          }
          setMentorProfile(mp)
          setLocalMaxMentees(mp.max_mentees)
        }
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingRequests(data.requests || [])
      }
      if (activeRes.ok) {
        const data = await activeRes.json()
        setActiveMentees(data.requests || [])
      }
      if (pastRes.ok) {
        const data = await pastRes.json()
        setPastMentees(data.requests || [])
      }
      if (offersRes?.ok) {
        const data = await offersRes.json()
        setSentOffersCount((data.offers || []).length)
      }
      if (notifsRes?.ok) {
        const data = await notifsRes.json()
        setUnreadNotifs(data.notifications?.length || 0)
      }
    } catch (error) {
      console.error('Error loading mentor data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleToggleAvailability = async () => {
    if (!mentorProfile) return
    setIsUpdating(true)
    try {
      const newAvailability = !mentorProfile.is_available_for_mentorship
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available_for_mentorship: newAvailability }),
      })
      if (response.ok) {
        setMentorProfile({ ...mentorProfile, is_available_for_mentorship: newAvailability })
        toast.success(newAvailability ? 'You are now accepting mentorship requests' : 'Mentorship requests paused')
      }
    } catch (error) {
      toast.error('Failed to update availability')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveMaxMentees = async () => {
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_mentees: localMaxMentees }),
      })
      if (response.ok) {
        setMentorProfile(prev => prev ? { ...prev, max_mentees: localMaxMentees } : prev)
        toast.success('Mentee capacity updated')
        setIsEditingCapacity(false)
      }
    } catch (error) {
      toast.error('Failed to update')
    }
  }

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const response = await fetch('/api/mentorship', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, status: 'accepted' }),
      })
      if (response.ok) {
        toast.success('Mentorship request accepted!')
        loadMentorData()
      } else {
        toast.error('Failed to accept request')
      }
    } catch (error) {
      toast.error('Failed to accept request')
    }
  }

  const handleDeclineRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to decline this mentorship request?')) return
    try {
      const response = await fetch('/api/mentorship', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId, status: 'declined' }),
      })
      if (response.ok) {
        toast.success('Request declined')
        loadMentorData()
      }
    } catch (error) {
      toast.error('Failed to decline request')
    }
  }

  const handleEndMentorship = async (mentorshipId: string) => {
    if (!confirm('Are you sure you want to end this mentorship?')) return
    try {
      const response = await fetch(`/api/mentorship?id=${mentorshipId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Mentorship ended')
        loadMentorData()
      }
    } catch (error) {
      toast.error('Failed to end mentorship')
    }
  }

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Derived ───────────────────────────────────────────────────────────

  const totalMentored = activeMentees.length + pastMentees.length
  const capacityPercent = mentorProfile ? Math.min((activeMentees.length / (mentorProfile.max_mentees || 1)) * 100, 100) : 0
  const isAvailable = mentorProfile?.is_available_for_mentorship ?? false

  const currentTabData = activeTab === 'requests' ? pendingRequests : activeTab === 'active' ? activeMentees : pastMentees

  const pendingCount = useCountUp(pendingRequests.length, 1200, statsInView)
  const activeCount = useCountUp(activeMentees.length, 1200, statsInView)
  const totalCount = useCountUp(totalMentored, 1200, statsInView)

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // ─── Loading State ─────────────────────────────────────────────────────

  if (sessionLoading || (role !== 'mentor' && !sessionLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-purple-500/20 to-brand-purple-500/10 flex items-center justify-center">
              <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-500" />
            </div>
            <div className="absolute inset-0 rounded-full bg-brand-purple-500/10 animate-ping" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </motion.div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 1: HERO HEADER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-600/15 via-brand-purple-500/8 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            {/* Date label */}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-purple-500/70 mb-3">{today}</p>

            {/* Greeting + Name */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
                  <span className="text-foreground">{greeting}, </span>
                  <span className="text-brand-dark dark:text-foreground">
                    {mentorProfile?.full_name?.split(' ')[0] || 'Mentor'}
                  </span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">Your mentorship command center</p>
              </div>

              {/* Availability Toggle */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50"
              >
                <div className="flex items-center gap-2">
                  {isAvailable ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                  )}
                  <span className={cn('text-xs font-semibold', isAvailable ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {isAvailable ? 'Accepting Requests' : 'Paused'}
                  </span>
                </div>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={handleToggleAvailability}
                  disabled={isUpdating}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </motion.div>
            </div>

            {/* Refresh */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={loadMentorData}
              disabled={isLoading}
              className="mt-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-brand-purple-500 transition-colors"
            >
              <HugeiconsIcon icon={Refresh01Icon} className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              {isLoading ? 'Refreshing...' : 'Refresh data'}
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 2: STATS BAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-2">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          onViewportEnter={() => setStatsInView(true)}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {/* Pending Requests */}
          <motion.div variants={staggerItem} whileHover={{ y: -4 }} className="group">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 hover:border-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/5 transition-all duration-300">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pending</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{pendingCount}</p>
              {pendingRequests.length > 0 && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              )}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-500 to-brand-purple-400" />
            </div>
          </motion.div>

          {/* Active Mentees */}
          <motion.div variants={staggerItem} whileHover={{ y: -4 }} className="group">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Active Mentees</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{activeCount}</p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-400" />
            </div>
          </motion.div>

          {/* Capacity */}
          <motion.div variants={staggerItem} whileHover={{ y: -4 }} className="group">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 hover:border-brand-purple-500/30 hover:shadow-lg hover:shadow-brand-purple-500/5 transition-all duration-300">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Capacity</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                {activeMentees.length}<span className="text-base sm:text-lg text-muted-foreground font-normal">/{mentorProfile?.max_mentees || 5}</span>
              </p>
              {/* Thin progress bar instead of ring */}
              <div className="mt-2 h-1 rounded-full bg-muted/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-brand-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: statsInView ? `${capacityPercent}%` : '0%' }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </div>
          </motion.div>

          {/* Total Mentored */}
          <motion.div variants={staggerItem} whileHover={{ y: -4 }} className="group">
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 hover:border-brand-purple-500/30 hover:shadow-lg hover:shadow-brand-purple-500/5 transition-all duration-300">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Mentored</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{totalCount}</p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-purple-500 to-brand-purple-400" />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 3: QUICK ACTIONS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10">
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-0.5 bg-brand-purple-500 rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Quick Actions</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {[
              { label: 'Scout Talents', href: '/mentorship/scout', badge: sentOffersCount > 0 ? `${sentOffersCount} sent` : undefined },
              { label: 'Messages', href: '/messages', badge: undefined },
              { label: 'Notifications', href: '/notifications', badge: unreadNotifs > 0 ? `${unreadNotifs}` : undefined },
              { label: 'My Profile', href: '/profile', badge: undefined },
              { label: 'Opportunities', href: '/opportunities', badge: undefined },
              { label: 'Settings', href: '/settings', badge: undefined },
            ].map((action) => (
              <motion.div
                key={action.label}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="snap-start flex-shrink-0"
              >
                <Link
                  href={action.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm text-sm font-medium text-foreground hover:border-brand-purple-500/30 hover:text-brand-purple-500 hover:shadow-md transition-all duration-200"
                >
                  {action.label}
                  {action.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-purple-500/10 text-brand-purple-500">{action.badge}</span>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 4: MENTORSHIP MANAGEMENT
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-12">
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-6 h-0.5 bg-brand-purple-500 rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Mentorships</h2>
          </div>

          {/* Custom Tab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 w-fit mb-6">
            {([
              { key: 'requests' as const, label: 'Requests', count: pendingRequests.length },
              { key: 'active' as const, label: 'Active', count: activeMentees.length },
              { key: 'past' as const, label: 'Past', count: pastMentees.length },
            ]).map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-colors',
                    isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mentorTab"
                      className="absolute inset-0 bg-brand-purple-500 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={cn(
                      'relative z-10 text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1',
                      isActive ? 'bg-white/20 text-white' : 'bg-brand-purple-500/10 text-brand-purple-500'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-card/30 p-5 animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted/50" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted/50 rounded" />
                        <div className="h-3 w-full bg-muted/40 rounded" />
                        <div className="h-3 w-2/3 bg-muted/40 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : currentTabData.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease }}
                className="space-y-4"
              >
                {currentTabData.map((request, i) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease }}
                  >
                    {activeTab === 'requests' ? (
                      <PendingRequestCard
                        request={request}
                        isExpanded={expandedCards.has(request.id)}
                        onToggle={() => toggleCardExpanded(request.id)}
                        onAccept={() => handleAcceptRequest(request.id)}
                        onDecline={() => handleDeclineRequest(request.id)}
                      />
                    ) : activeTab === 'active' ? (
                      <ActiveMenteeCard
                        mentorship={request}
                        onEnd={() => handleEndMentorship(request.id)}
                      />
                    ) : (
                      <PastMenteeCard mentorship={request} />
                    )}
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 rounded-2xl border-2 border-dashed border-border/50"
              >
                <div className="inline-block mb-3 text-4xl opacity-30 animate-float">
                  {activeTab === 'requests' ? '?' : activeTab === 'active' ? '--' : '...'}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {activeTab === 'requests' ? 'No pending requests' :
                   activeTab === 'active' ? 'No active mentees' :
                   'No past mentees'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {activeTab === 'requests'
                    ? isAvailable ? 'New mentorship requests will appear here when creatives reach out.' : 'Enable availability to receive new requests.'
                    : activeTab === 'active'
                    ? 'Accept mentorship requests to start guiding emerging creatives.'
                    : 'Your mentorship history will appear here over time.'}
                </p>
                {activeTab === 'requests' && (
                  <Button className="mt-6 bg-brand-purple-500 hover:bg-brand-purple-600 rounded-full px-6 shadow-lg shadow-brand-purple-500/20" asChild>
                    <Link href="/mentorship/scout">
                      Scout Talents
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 5: EXPERTISE + CAPACITY (TWO COLUMNS)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-14">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Expertise Spotlight */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-0.5 bg-brand-purple-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Your Expertise</h2>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              {mentorProfile?.mentor_expertise && mentorProfile.mentor_expertise.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {mentorProfile.mentor_expertise.map((area, i) => (
                      <motion.span
                        key={area}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(20,184,166,0.15)' }}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-brand-purple-500/10 to-brand-purple-500/5 text-brand-purple-600 dark:text-brand-purple-400 border border-brand-purple-500/20 hover:border-brand-purple-500/40 transition-all cursor-default"
                      >
                        {area}
                      </motion.span>
                    ))}
                  </div>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-brand-purple-500 transition-colors"
                  >
                    Edit expertise areas
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">No expertise areas set yet</p>
                  <Button variant="outline" size="sm" className="rounded-full" asChild>
                    <Link href="/settings">Add your expertise</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Mentee Capacity Widget */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-0.5 bg-brand-purple-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Mentee Capacity</h2>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <div className="flex items-center gap-6">
                {/* Large capacity ring */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                    <motion.circle
                      cx="48" cy="48" r="40" fill="none" strokeWidth="6"
                      className="text-brand-purple-500"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                      whileInView={{ strokeDashoffset: (2 * Math.PI * 40) * (1 - capacityPercent / 100) }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.8, ease: 'easeOut', delay: 0.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-foreground tabular-nums">{activeMentees.length}</span>
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">of {mentorProfile?.max_mentees || 5}</span>
                  </div>
                </div>

                {/* Capacity info + edit */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {activeMentees.length} of {mentorProfile?.max_mentees || 5} slots filled
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {(mentorProfile?.max_mentees || 5) - activeMentees.length > 0
                      ? `${(mentorProfile?.max_mentees || 5) - activeMentees.length} slots available for new mentees`
                      : 'All slots are currently filled'}
                  </p>

                  <AnimatePresence mode="wait">
                    {isEditingCapacity ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2"
                      >
                        <button
                          onClick={() => setLocalMaxMentees(Math.max(1, localMaxMentees - 1))}
                          className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center hover:border-brand-purple-500/30 hover:text-brand-purple-500 transition-colors"
                        >
                          <HugeiconsIcon icon={MinusSignIcon} className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-lg font-bold tabular-nums">{localMaxMentees}</span>
                        <button
                          onClick={() => setLocalMaxMentees(Math.min(20, localMaxMentees + 1))}
                          className="w-8 h-8 rounded-lg border border-border/50 flex items-center justify-center hover:border-brand-purple-500/30 hover:text-brand-purple-500 transition-colors"
                        >
                          <HugeiconsIcon icon={Add01Icon} className="w-3.5 h-3.5" />
                        </button>
                        <Button
                          size="sm"
                          className="h-8 bg-brand-purple-500 hover:bg-brand-purple-600 rounded-lg text-xs ml-2"
                          onClick={handleSaveMaxMentees}
                        >
                          Save
                        </Button>
                        <button
                          onClick={() => { setIsEditingCapacity(false); setLocalMaxMentees(mentorProfile?.max_mentees || 5) }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                        >
                          Cancel
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="edit-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsEditingCapacity(true)}
                        className="text-xs font-medium text-muted-foreground hover:text-brand-purple-500 transition-colors inline-flex items-center gap-1"
                      >
                        Adjust capacity
                        <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 6: FOOTER CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-16">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-border/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-600/10 via-brand-purple-500/5 to-transparent" />

          <div className="relative p-8 sm:p-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple-500/10 border border-brand-purple-500/20 mb-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-500">Shape the future</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Ready to guide the next generation?
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Discover talented creatives and offer your expertise to help them grow and succeed.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button className="bg-brand-purple-500 hover:bg-brand-purple-600 rounded-full px-8 shadow-lg shadow-brand-purple-500/20" asChild>
                  <Link href="/mentorship/scout">
                    Scout New Talents
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" className="rounded-full px-8 border-border/60 hover:border-brand-purple-500/30" asChild>
                  <Link href="/profile">
                    Update Profile
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function PendingRequestCard({
  request,
  isExpanded,
  onToggle,
  onAccept,
  onDecline,
}: {
  request: MentorshipRequest
  isExpanded: boolean
  onToggle: () => void
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:border-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/5 transition-all duration-300">
      {/* Yellow accent top bar */}
      <div className="h-1 bg-gradient-to-r from-yellow-500 to-brand-purple-400" />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="w-12 h-12 flex-shrink-0">
            <AvatarImage src={request.mentee?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-sm font-bold">
              {request.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-foreground">{request.mentee?.full_name || 'Unknown User'}</h4>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{request.mentee?.bio || 'No bio available'}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                {formatDistanceToNow(request.created_at)}
              </span>
            </div>

            {/* Skills */}
            {request.mentee?.skills && request.mentee.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {request.mentee.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/50">
                    {skill}
                  </span>
                ))}
                {request.mentee.skills.length > 4 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground">
                    +{request.mentee.skills.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Expandable goals/message */}
            <button
              onClick={onToggle}
              className="flex items-center gap-1 mt-3 text-xs font-medium text-muted-foreground hover:text-brand-purple-500 transition-colors"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')} />
              {isExpanded ? 'Hide details' : 'View goals & message'}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3.5 rounded-xl bg-muted/30 border border-border/30 space-y-3">
                    {request.goals && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Goals</p>
                        <p className="text-sm text-foreground">{request.goals}</p>
                      </div>
                    )}
                    {request.message && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Message</p>
                        <p className="text-sm text-foreground">{request.message}</p>
                      </div>
                    )}
                    {request.skills_to_develop && request.skills_to_develop.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Skills to Develop</p>
                        <div className="flex flex-wrap gap-1">
                          {request.skills_to_develop.map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-purple-400 border border-brand-purple-500/20">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs px-4"
                  onClick={onAccept}
                >
                  Accept
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs px-4 text-red-500 hover:text-red-600 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5"
                  onClick={onDecline}
                >
                  Decline
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActiveMenteeCard({
  mentorship,
  onEnd,
}: {
  mentorship: MentorshipRequest
  onEnd: () => void
}) {
  // Calculate mentoring duration
  const startDate = mentorship.updated_at || mentorship.created_at
  const daysAgo = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
  const durationLabel = daysAgo < 7 ? `${daysAgo}d` : daysAgo < 30 ? `${Math.floor(daysAgo / 7)}w` : `${Math.floor(daysAgo / 30)}mo`

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
      {/* Green accent top bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-400" />

      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <Avatar className="w-12 h-12 flex-shrink-0 ring-2 ring-emerald-500/20">
            <AvatarImage src={mentorship.mentee?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-500 text-white text-sm font-bold">
              {mentorship.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-foreground truncate">{mentorship.mentee?.full_name || 'Unknown User'}</h4>
              <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {durationLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{mentorship.mentee?.bio || ''}</p>
            {mentorship.mentee?.skills && mentorship.mentee.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {mentorship.mentee.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/50">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href={`/messages/chat/${mentorship.mentee_id}`}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-purple-400 border border-brand-purple-500/20 hover:border-brand-purple-500/40 hover:bg-brand-purple-500/15 transition-all"
              >
                Message
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <button
                onClick={onEnd}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500/60 hover:text-red-500 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 transition-all"
              >
                End
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PastMenteeCard({ mentorship }: { mentorship: MentorshipRequest }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="h-0.5 bg-muted/30" />
      <div className="p-5">
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10 opacity-70">
            <AvatarImage src={mentorship.mentee?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
              {mentorship.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground/70 truncate">{mentorship.mentee?.full_name || 'Unknown User'}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                mentorship.status === 'declined'
                  ? 'bg-red-500/5 text-red-500/60 border-red-500/10'
                  : 'bg-muted/50 text-muted-foreground border-border/30'
              )}>
                {mentorship.status === 'declined' ? 'Declined' : 'Ended'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(mentorship.updated_at || mentorship.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
