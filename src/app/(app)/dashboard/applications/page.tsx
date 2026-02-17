'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon, ArrowRight01Icon, Briefcase01Icon, Calendar01Icon, Cancel01Icon, CancelCircleIcon, CheckmarkCircle01Icon, Clock01Icon, Refresh01Icon, Search01Icon, SentIcon, SparklesIcon, Upload01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { MdBolt, MdAttachMoney } from 'react-icons/md'
import { motion, AnimatePresence } from 'framer-motion'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type OpportunityType = 'gig' | 'job' | 'investment'

interface Application {
  id: string
  opportunity_id: string
  cover_letter: string
  proposed_budget: number | null
  status: 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn'
  created_at: string
  updated_at: string
  opportunity?: {
    id: string
    title: string
    type: OpportunityType
    category: string
    budget_min: number
    budget_max: number
    currency: string
    deadline: string
    status: string
    employer?: {
      full_name: string | null
      avatar_url: string | null
    }
  }
}

// ─── Count-up Hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, isActive = true) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafId = useRef<number>(0)

  useEffect(() => {
    if (!isActive || target === 0) { setValue(target); return }
    startTime.current = null
    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafId.current = requestAnimationFrame(step)
    }
    rafId.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId.current)
  }, [target, duration, isActive])

  return value
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

function getTypeAccent(type?: OpportunityType) {
  switch (type) {
    case 'gig': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/10 to-transparent' }
    case 'job': return { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', bgLight: 'bg-brand-500/10', border: 'border-brand-500/30', gradient: 'from-brand-600/30 via-brand-500/10 to-transparent' }
    case 'investment': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/10 to-transparent' }
    default: return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-500', bgLight: 'bg-brand-purple-500/10 dark:bg-brand-500/10', border: 'border-brand-purple-500/30 dark:border-brand-500/30', gradient: 'from-brand-600/30 via-brand-500/10 to-transparent' }
  }
}

function getStatusInfo(status: Application['status']) {
  switch (status) {
    case 'pending': return { label: 'Pending', dot: 'bg-brand-500', text: 'text-brand-600 dark:text-brand-400', bgLight: 'bg-brand-500/10', border: 'border-brand-500/30', icon: Clock01Icon, pulse: true }
    case 'reviewing': return { label: 'Reviewing', dot: 'bg-brand-purple-500', text: 'text-brand-purple-600 dark:text-brand-400', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', icon: ViewIcon, pulse: false }
    case 'accepted': return { label: 'Accepted', dot: 'bg-green-500', text: 'text-green-500', bgLight: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckmarkCircle01Icon, pulse: false }
    case 'rejected': return { label: 'Rejected', dot: 'bg-red-500', text: 'text-red-500', bgLight: 'bg-red-500/10', border: 'border-red-500/30', icon: CancelCircleIcon, pulse: false }
    case 'withdrawn': return { label: 'Withdrawn', dot: 'bg-muted-foreground', text: 'text-muted-foreground', bgLight: 'bg-muted', border: 'border-border', icon: CancelCircleIcon, pulse: false }
  }
}

function getTypeIconEl(type?: string, className = 'w-3 h-3') {
  switch (type) {
    case 'gig': return <MdBolt className={className} />
    case 'job': return <HugeiconsIcon icon={Briefcase01Icon} className={className} />
    case 'investment': return <HugeiconsIcon icon={AnalyticsUpIcon} className={className} />
    default: return <HugeiconsIcon icon={Briefcase01Icon} className={className} />
  }
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }

// ─── Filter Tabs ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
] as const

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/applications')
      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWithdraw = useCallback(async (applicationId: string) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return
    try {
      const response = await fetch(`/api/applications?id=${applicationId}`, { method: 'DELETE' })
      if (response.ok) {
        setApplications(prev => prev.filter(a => a.id !== applicationId))
        toast.success('Application withdrawn')
      } else {
        toast.error('Failed to withdraw application')
      }
    } catch (error) {
      console.error('Error withdrawing application:', error)
      toast.error('Failed to withdraw application')
    }
  }, [])

  // ─── Filtering ──────────────────────────────────────────────────────────

  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      !searchQuery ||
      app.opportunity?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.opportunity?.category.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'active' && ['pending', 'reviewing'].includes(app.status)) ||
      (activeTab === 'accepted' && app.status === 'accepted') ||
      (activeTab === 'rejected' && app.status === 'rejected')

    return matchesSearch && matchesTab
  })

  // ─── Stats ──────────────────────────────────────────────────────────────

  const stats = {
    total: applications.length,
    active: applications.filter(a => ['pending', 'reviewing'].includes(a.status)).length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }

  const tabCounts: Record<string, number> = {
    all: stats.total,
    active: stats.active,
    accepted: stats.accepted,
    rejected: stats.rejected,
  }

  const countTotal = useCountUp(stats.total, 1000, !isLoading)
  const countActive = useCountUp(stats.active, 1000, !isLoading)
  const countAccepted = useCountUp(stats.accepted, 1000, !isLoading)
  const countRejected = useCountUp(stats.rejected, 1000, !isLoading)

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">

      {/* ━━━ HERO HEADER ━━━ */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-500/80 dark:text-brand-400/80">Application Tracker</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              <span className="text-brand-dark dark:text-foreground">
                My Applications
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-lg">
              Track, manage, and stay on top of every opportunity you&apos;ve applied to
            </p>
          </motion.div>

          {/* Refresh pill */}
          <motion.div
            className="mt-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease }}
          >
            <button
              onClick={loadApplications}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all disabled:opacity-50"
            >
              <HugeiconsIcon icon={Refresh01Icon} className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* ━━━ STATS STRIP ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
        >
          <SpotlightCard className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-0 sm:divide-x sm:divide-border/50">
            {/* Total */}
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-foreground" style={{ textShadow: '0 0 20px rgba(249,115,22,0.15)' }}>
                {countTotal}
              </p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Total Sent</p>
            </div>
            {/* Active */}
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-brand-purple-600 dark:text-brand-400">
                {countActive}
              </p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-brand-purple-500/60 dark:text-brand-400/60 font-bold mt-1">Active</p>
            </div>
            {/* Accepted */}
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-green-500">
                {countAccepted}
              </p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-green-500/60 font-bold mt-1">Accepted</p>
            </div>
            {/* Rejected */}
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-red-500">
                {countRejected}
              </p>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-red-500/60 font-bold mt-1">Rejected</p>
            </div>
          </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* ━━━ SEARCH + FILTER ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
          className="space-y-4"
        >
          {/* Search bar */}
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search by title or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-purple-500/10 dark:ring-brand-500/10 transition-all"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5 text-muted-foreground" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-brand-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.label}
                    {tabCounts[tab.key] > 0 && (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none',
                        isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* ━━━ APPLICATIONS LIST ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">

      {isLoading ? (
          /* ── Skeleton Loading ── */
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <SpotlightCard key={i} className="overflow-hidden animate-pulse">
                <div className="h-1 bg-gradient-to-r from-muted/60 via-muted/30 to-transparent" />
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted/60" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-48 bg-muted/60 rounded-md" />
                      <div className="h-3 w-32 bg-muted/40 rounded-md" />
                    </div>
                    <div className="h-6 w-20 bg-muted/40 rounded-full" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-3 w-24 bg-muted/30 rounded-md" />
                    <div className="h-3 w-28 bg-muted/30 rounded-md" />
                    <div className="h-3 w-20 bg-muted/30 rounded-md" />
                  </div>
                </div>
              </SpotlightCard>
            ))}
        </div>
      ) : filteredApplications.length > 0 ? (
          /* ── Application Cards ── */
          <motion.div
            className="space-y-4"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {filteredApplications.map((app) => {
                const accent = getTypeAccent(app.opportunity?.type)
                const status = getStatusInfo(app.status)
                const typeIconEl = getTypeIconEl(app.opportunity?.type, 'w-3 h-3')
                const employer = app.opportunity?.employer

                return (
                  <motion.div
                    key={app.id}
                    variants={fadeUp}
                    exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
                    layout
                    whileHover={{ y: -2 }}
                    className="group"
                  >
                    <SpotlightCard className={cn(
                      'relative overflow-hidden transition-all duration-300',
                      'hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5',
                      app.status === 'accepted' && 'border-green-500/20 hover:border-green-500/40 hover:shadow-green-500/5'
                    )}>
                      <div className="p-4 sm:p-5">
                        {/* Top row: Employer + Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Employer avatar */}
                            <Avatar className="w-9 h-9 ring-2 ring-border/50 ring-offset-1 ring-offset-background flex-shrink-0">
                              <AvatarImage src={employer?.avatar_url || undefined} />
                              <AvatarFallback className={cn('text-[10px] font-bold', accent.bgLight, accent.text)}>
                                {employer?.full_name
                                  ? employer.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                                  : <HugeiconsIcon icon={Briefcase01Icon} className="w-3.5 h-3.5" />}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              {/* Opportunity title */}
                              <Link
                                href={`/opportunities/${app.opportunity_id}`}
                                className="font-semibold text-foreground hover:text-brand-purple-600 dark:hover:text-brand-400 transition-colors line-clamp-1 text-sm sm:text-base"
                              >
                                {app.opportunity?.title || 'Unknown Opportunity'}
                              </Link>
                              {/* Employer name + Type */}
                              <div className="flex items-center gap-2 mt-0.5">
                                {employer?.full_name && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {employer.full_name}
                                  </span>
                                )}
                                {app.opportunity?.type && (
                                  <>
                                    <span className="text-border text-[10px]">·</span>
                                    <span className={cn('flex items-center gap-1 text-[10px] font-medium capitalize', accent.text)}>
                                      {typeIconEl}
                                      {app.opportunity.type}
                                    </span>
                                  </>
                                )}
                                {app.opportunity?.category && (
                                  <>
                                    <span className="text-border text-[10px]">·</span>
                                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                      {app.opportunity.category}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                    </div>
                    
                          {/* Status badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              'flex-shrink-0 text-[10px] font-bold uppercase tracking-wider',
                              status.bgLight, status.text, status.border
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', status.dot, status.pulse && 'animate-pulse')} />
                            {status.label}
                          </Badge>
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
                          {app.opportunity?.budget_min != null && app.opportunity.budget_min > 0 && (
                        <span className="flex items-center gap-1">
                          <MdAttachMoney className="w-3 h-3" />
                              {app.opportunity.currency} {app.opportunity.budget_min.toLocaleString()}
                              {app.opportunity.budget_max !== app.opportunity.budget_min && (
                                <> - {app.opportunity.budget_max.toLocaleString()}</>
                              )}
                        </span>
                      )}
                          {app.opportunity?.deadline && (
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                              {new Date(app.opportunity.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
                            Applied {formatDistanceToNow(app.created_at)}
                      </span>
                          {app.proposed_budget != null && app.proposed_budget > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 font-medium">
                              <HugeiconsIcon icon={SentIcon} className="w-3 h-3" />
                              Proposed: ${app.proposed_budget.toLocaleString()} {app.opportunity?.currency}
                        </span>
                    )}
                  </div>

                        {/* Accepted banner */}
                        {app.status === 'accepted' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20"
                          >
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5" />
                              Application accepted — submit your work now!
                            </p>
                          </motion.div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all duration-300">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full text-xs border-border/50 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:bg-brand-purple-500/5 dark:bg-brand-500/5"
                            asChild
                          >
                            <Link href={`/opportunities/${app.opportunity_id}`}>
                              <HugeiconsIcon icon={ViewIcon} className="w-3 h-3 mr-1.5" />
                              View Details
                      </Link>
                    </Button>

                          {app.status === 'accepted' && (
                      <Button
                        size="sm"
                              className="h-8 rounded-full text-xs bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 animate-pulse-orange"
                        asChild
                      >
                              <Link href={`/opportunities/${app.opportunity_id}`}>
                                <HugeiconsIcon icon={Upload01Icon} className="w-3 h-3 mr-1.5" />
                          Submit Work
                        </Link>
                      </Button>
                    )}

                          {['pending', 'reviewing'].includes(app.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                              className="h-8 rounded-full text-xs text-red-500/70 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => handleWithdraw(app.id)}
                      >
                              <HugeiconsIcon icon={CancelCircleIcon} className="w-3 h-3 mr-1.5" />
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
        </SpotlightCard>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── Empty State ── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            <SpotlightCard className="text-center py-16">
            <div className="animate-float inline-block mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={SparklesIcon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {searchQuery || activeTab !== 'all'
                ? 'No matching applications'
                : 'No applications yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {searchQuery || activeTab !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Start exploring opportunities and submit your first application'}
            </p>
            <Button
              className="bg-brand-500 hover:bg-brand-600 rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
              asChild
            >
              <Link href="/opportunities">
                Browse Opportunities
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            </SpotlightCard>
          </motion.div>
      )}
      </div>
    </div>
  )
}
