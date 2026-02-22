'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Activity01Icon, Add01Icon, AnalyticsUpIcon, ArrowRight01Icon, Briefcase01Icon, Calendar01Icon, CancelCircleIcon, CheckListIcon, CheckmarkCircle01Icon, Clock01Icon, FileAttachmentIcon, FolderOpenIcon, Loading02Icon, Location01Icon, Message01Icon, Notification01Icon, PackageIcon, Search01Icon, SparklesIcon, ToggleOffIcon, ToggleOnIcon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { motion, useInView, AnimatePresence } from 'motion/react'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Opportunity {
  id: string
  title: string
  type: string
  status: string
  category: string
  applications_count: number
  created_at: string
  budget_min?: number
  budget_max?: number
  budgetMin?: number
  budgetMax?: number
  currency?: string
  deadline?: string
  location?: string
  is_remote?: boolean
}

interface Application {
  id: string
  status: string
  created_at: string
  cover_letter: string
  proposed_budget: number
  applicant_id: string
  applicant?: {
    full_name: string
    avatar_url: string | null
  }
  opportunity?: {
    id: string
    title: string
  }
}

interface WorkSubmission {
  id: string
  status: string
  message: string
  files: { name: string; size: number; url: string }[]
  created_at: string
  application_id: string
  creative?: {
    full_name: string
    avatar_url: string | null
  }
  opportunity?: {
    title: string
  }
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
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

// ─── Count-Up Hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, isActive = true) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || target === 0) {
      setValue(target)
      return
    }
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [target, duration, isActive])

  return value
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeColor(type: string) {
  switch (type?.toLowerCase()) {
    case 'gig': return { bg: 'bg-brand-500', text: 'text-brand-purple-600 dark:text-brand-400', light: 'bg-brand-purple-500/10 dark:bg-brand-500/10', border: 'border-brand-purple-500/30 dark:border-brand-500/30' }
    case 'job': return { bg: 'bg-brand-500', text: 'text-brand-600 dark:text-brand-400', light: 'bg-brand-500/10', border: 'border-brand-500/30' }
    case 'investment': return { bg: 'bg-brand-purple-500', text: 'text-brand-purple-600 dark:text-brand-400', light: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30' }
    default: return { bg: 'bg-brand-purple-500', text: 'text-brand-purple-600 dark:text-brand-400', light: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30' }
  }
}

function getDaysUntil(deadline?: string): number | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getNotificationIcon(type: string, className = 'w-2.5 h-2.5 text-white') {
  switch (type) {
    case 'new_application': return { iconEl: <HugeiconsIcon icon={FileAttachmentIcon} className={className} />, color: 'bg-brand-purple-500' }
    case 'work_submitted': return { iconEl: <HugeiconsIcon icon={PackageIcon} className={className} />, color: 'bg-brand-purple-500' }
    case 'new_message': return { iconEl: <HugeiconsIcon icon={Message01Icon} className={className} />, color: 'bg-brand-purple-500' }
    case 'mentorship_request': return { iconEl: <HugeiconsIcon icon={UserGroupIcon} className={className} />, color: 'bg-brand-purple-500' }
    default: return { iconEl: <HugeiconsIcon icon={Notification01Icon} className={className} />, color: 'bg-brand-500' }
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EmployerDashboardPage() {
  const { user } = useUser()
  const { userId, role, isLoading: sessionLoading } = useSession()
  
  const [isLoading, setIsLoading] = useState(true)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [messageCount, setMessageCount] = useState(0)

  // Refs for count-up
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-50px' })

  // ── Data Loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId && role === 'employer') {
      loadAllData()
    }
  }, [userId, role])

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      const [oppsRes, appsRes, subsRes, notifsRes, msgsRes] = await Promise.all([
        fetch('/api/opportunities?my=true'),
        fetch('/api/applications?role=employer'),
        fetch('/api/work-submissions?role=employer').catch(() => null),
        fetch('/api/notifications').catch(() => null),
        fetch('/api/messages?count_only=true').catch(() => null),
      ])

      if (oppsRes.ok) {
        const d = await oppsRes.json()
        setOpportunities(d.opportunities || [])
      }
      if (appsRes.ok) {
        const d = await appsRes.json()
        setApplications(d.applications || [])
      }
      if (subsRes?.ok) {
        const d = await subsRes.json()
        setSubmissions((d.submissions || []).filter((s: WorkSubmission) => s.status === 'submitted'))
      }
      if (notifsRes?.ok) {
        const d = await notifsRes.json()
        setNotifications((d.notifications || []).slice(0, 6))
      }
      if (msgsRes?.ok) {
        const d = await msgsRes.json()
        setMessageCount(d.count || 0)
      }
    } catch (error) {
      console.error('Error loading employer data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleToggleStatus = async (oppId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open'
    try {
      const response = await fetch('/api/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oppId, status: newStatus }),
      })
      if (response.ok) {
        setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, status: newStatus } : o))
        toast.success(`Opportunity ${newStatus === 'open' ? 'reopened' : 'closed'}`)
      } else {
        toast.error('Failed to update opportunity')
      }
    } catch {
      toast.error('Failed to update')
    }
  }

  // ── Derived Stats ─────────────────────────────────────────────────────────

  const openOpps = useMemo(() => opportunities.filter(o => o.status === 'open').length, [opportunities])
  const totalApps = applications.length
  const pendingApps = useMemo(() => applications.filter(a => a.status === 'pending').length, [applications])
  const reviewingApps = useMemo(() => applications.filter(a => a.status === 'reviewing').length, [applications])
  const acceptedApps = useMemo(() => applications.filter(a => a.status === 'accepted').length, [applications])
  const rejectedApps = useMemo(() => applications.filter(a => a.status === 'rejected').length, [applications])

  // Pipeline funnel max
  const pipelineMax = Math.max(pendingApps, reviewingApps, acceptedApps, 1)

  // Budget analytics
  const totalBudgetPosted = useMemo(() => {
    return opportunities
      .filter(o => o.status === 'open')
      .reduce((sum, o) => sum + (o.budget_max || o.budgetMax || 0), 0)
  }, [opportunities])

  const totalCommitted = useMemo(() => {
    return applications
      .filter(a => a.status === 'accepted')
      .reduce((sum, a) => sum + (a.proposed_budget || 0), 0)
  }, [applications])

  // Count-up values
  const activeCount = useCountUp(openOpps, 1200, statsInView && !isLoading)
  const appsCountUp = useCountUp(totalApps, 1500, statsInView && !isLoading)
  const pendingCountUp = useCountUp(pendingApps, 1000, statsInView && !isLoading)
  const hiresCountUp = useCountUp(acceptedApps, 1800, statsInView && !isLoading)

  // ── Loading State ─────────────────────────────────────────────────────────

  if (sessionLoading || (role !== 'employer' && !sessionLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  const firstName = user?.firstName || 'there'

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ━━━ SECTION 1: Hero ━━━ */}
      <section className="relative overflow-hidden">
        <div className="relative container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.p
              variants={fadeUp}
              className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-brand-purple-400 dark:text-brand-400/60 font-semibold mb-2"
            >
              Employer Dashboard
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight"
            >
              Welcome back,{' '}
              <span className="text-brand-dark dark:text-foreground">
                {firstName}
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg"
            >
              Manage your opportunities, review talent, and build your dream team.
            </motion.p>
          </motion.div>

          {/* ── Stat Counters ── */}
          <motion.div
            ref={statsRef}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-8 overflow-hidden"
          >
            <SpotlightCard className="overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50">
              {[
                { label: 'Active Opportunities', value: activeCount, icon: Briefcase01Icon, color: 'text-brand-purple-600 dark:text-brand-400' },
                { label: 'Total Applications', value: appsCountUp, icon: FileAttachmentIcon, color: 'text-brand-purple-500' },
                { label: 'Pending Reviews', value: pendingCountUp, icon: Clock01Icon, color: 'text-brand-purple-600 dark:text-brand-400' },
                { label: 'Hires Made', value: hiresCountUp, icon: CheckmarkCircle01Icon, color: 'text-brand-purple-600 dark:text-brand-400' },
              ].map((stat) => (
                <div key={stat.label} className="px-4 sm:px-6 py-5 text-center">
                  <HugeiconsIcon icon={stat.icon} className={cn('w-5 h-5 mx-auto mb-1.5', stat.color)} />
                  <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                    {isLoading ? <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin mx-auto" /> : stat.value}
                  </p>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-brand-purple-400 dark:text-brand-400/60 font-medium mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />
            </SpotlightCard>
          </motion.div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-24 md:pb-8">

        {/* ━━━ SECTION 2: Quick Actions ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-10 mb-14"
        >
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Quick Actions</h2>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-1 px-1">
            {[
              { label: 'Post Opportunity', href: '/opportunities/create', icon: Add01Icon, badge: null, gradient: 'from-brand-500/5 to-brand-purple-500/5' },
              { label: 'Review Applications', href: '/dashboard/employer/applications', icon: CheckListIcon, badge: pendingApps > 0 ? pendingApps : null, gradient: 'from-brand-purple-500/5 to-brand-purple-500/5' },
              { label: 'Messages', href: '/messages', icon: Message01Icon, badge: messageCount > 0 ? messageCount : null, gradient: 'from-brand-purple-500/5 to-brand-purple-500/5' },
              { label: 'Browse Portfolios', href: '/portfolios', icon: FolderOpenIcon, badge: null, gradient: 'from-brand-purple-500/5 to-brand-purple-500/5' },
              { label: 'Search Talent', href: '/search', icon: Search01Icon, badge: null, gradient: 'from-rose-500/5 to-pink-500/5' },
            ].map((action, i) => (
              <motion.div
                key={action.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="snap-start flex-shrink-0"
              >
                <Link
                  href={action.href}
                  className={cn(
                    'relative flex items-center gap-3 px-5 py-4 rounded-xl',
                    'bg-card/50 backdrop-blur-sm border border-border/50',
                    'hover:bg-gradient-to-r hover:shadow-lg hover:shadow-brand-purple-500/10 dark:shadow-brand-500/10 hover:border-brand-purple-500/20 dark:border-brand-500/20',
                    `hover:${action.gradient}`,
                    'transition-all duration-300 group'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-brand-purple-500/10 dark:bg-brand-500/10 transition-colors">
                    <HugeiconsIcon icon={action.icon} className="w-5 h-5 text-muted-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{action.label}</span>
                  {action.badge && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-brand-dark text-[10px] font-bold animate-pulse">
                      {action.badge}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ━━━ SECTION 3: Hiring Pipeline ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-14"
        >
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Hiring Pipeline</h2>
      </div>

          <SpotlightCard className="p-4 sm:p-5">
            {totalApps > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { label: 'Applied', count: pendingApps, color: 'bg-brand-500', lightColor: 'bg-brand-500/10', textColor: 'text-brand-600 dark:text-brand-400' },
                  { label: 'Reviewing', count: reviewingApps, color: 'bg-brand-purple-500', lightColor: 'bg-brand-purple-500/10', textColor: 'text-brand-purple-600 dark:text-brand-400' },
                  { label: 'Accepted', count: acceptedApps, color: 'bg-emerald-500', lightColor: 'bg-emerald-500/10', textColor: 'text-emerald-500' },
                  { label: 'Declined', count: rejectedApps, color: 'bg-red-400', lightColor: 'bg-red-500/10', textColor: 'text-red-400' },
                ].map((stage, i) => (
                  <motion.div
                    key={stage.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1, ease }}
                    className="text-center"
                  >
                    <div className={cn('inline-flex items-center justify-center w-12 h-12 rounded-xl mb-2', stage.lightColor)}>
                      <span className={cn('text-xl font-bold', stage.textColor)}>{stage.count}</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stage.label}</p>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.max((stage.count / pipelineMax) * 100, stage.count > 0 ? 10 : 0)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease }}
                        className={cn('h-full rounded-full', stage.color)}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <HugeiconsIcon icon={Activity01Icon} className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Your hiring pipeline will appear here once you receive applications.</p>
              </div>
            )}

            {/* Funnel flow indicator */}
            {totalApps > 0 && (
              <div className="hidden md:flex items-center justify-center gap-2 mt-5 pt-4 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {totalApps} total applicants
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                  {acceptedApps} hired ({totalApps > 0 ? Math.round((acceptedApps / totalApps) * 100) : 0}% conversion)
                </span>
              </div>
            )}
            </SpotlightCard>
        </motion.section>

        {/* ━━━ SECTION 4: Active Opportunities Grid ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-14"
        >
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Active Opportunities
              </h2>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {opportunities.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 text-xs gap-1" asChild>
              <Link href="/opportunities">
                View All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
              </Link>
            </Button>
      </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
                </div>
          ) : opportunities.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
              {opportunities.map((opp, i) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  index={i}
                  onToggleStatus={handleToggleStatus}
                />
              ))}

              {/* Add New CTA Card */}
              <motion.div variants={fadeUp}>
                <Link
                  href="/opportunities/create"
                  className="flex flex-col items-center justify-center h-full min-h-[220px] rounded-2xl border-2 border-dashed border-border/60 hover:border-brand-500/40 hover:bg-brand-purple-500/5 dark:bg-brand-500/5 transition-all duration-300 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center group-hover:bg-brand-purple-500/10 dark:bg-brand-500/10 transition-colors mb-3">
                    <HugeiconsIcon icon={Add01Icon} className="w-7 h-7 text-muted-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors" />
              </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Post New Opportunity
                  </span>
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <SpotlightCard className="flex flex-col items-center justify-center py-16 text-center">
              <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No opportunities yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Post your first opportunity to start attracting top creative talent.
              </p>
              <Button className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2" asChild>
                <Link href="/opportunities/create">
                  <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
                  Post Opportunity
                </Link>
              </Button>
              </SpotlightCard>
            </motion.div>
          )}
        </motion.section>

        {/* ━━━ SECTION 5: Recent Applications Timeline ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-14"
        >
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Recent Applications
              </h2>
              {pendingApps > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-brand-dark text-[10px] font-bold">
                  {pendingApps}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 text-xs gap-1" asChild>
              <Link href="/dashboard/employer/applications">
                View All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-brand-purple-600 dark:text-brand-400" />
            </div>
          ) : applications.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-2 bottom-2 w-px bg-border/50" />

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="space-y-4"
              >
                {applications.slice(0, 8).map((app, i) => {
                  const statusColors: Record<string, { dot: string; ring: string; badge: string }> = {
                    pending: { dot: 'bg-brand-500', ring: 'ring-brand-500/15', badge: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30' },
                    reviewing: { dot: 'bg-brand-purple-500', ring: 'ring-brand-purple-500/15', badge: 'bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30' },
                    accepted: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/15', badge: 'bg-green-500/10 text-green-500 border-green-500/30' },
                    rejected: { dot: 'bg-red-400', ring: 'ring-red-400/15', badge: 'bg-red-500/10 text-red-500 border-red-500/30' },
                  }
                  const colors = statusColors[app.status] || statusColors.pending

                  return (
                    <motion.div
                      key={app.id}
                      variants={fadeUp}
                      className="relative flex items-start gap-4 pl-12"
                    >
                      {/* Timeline dot */}
                      <div className={cn(
                        'absolute left-4 top-4 w-4 h-4 rounded-full ring-4',
                        colors.dot, colors.ring
                      )} />

                      <SpotlightCard className="flex-1 p-4 hover:border-border/60 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-9 h-9 flex-shrink-0">
                              <AvatarImage src={app.applicant?.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                                {app.applicant?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground text-sm truncate">
                                {app.applicant?.full_name || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Applied for {app.opportunity?.title || 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className={cn('text-[10px] capitalize', colors.badge)}>
                              {app.status}
                          </Badge>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(app.created_at)}
                          </span>
                          </div>
                        </div>

                        {app.proposed_budget > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Proposed: <span className="text-foreground font-medium">${app.proposed_budget.toLocaleString()}</span>
                          </p>
                        )}
                      </SpotlightCard>
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          ) : (
            <SpotlightCard className="flex flex-col items-center justify-center py-16 text-center">
              <HugeiconsIcon icon={FileAttachmentIcon} className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No applications yet. Post an opportunity to start receiving them.</p>
            </SpotlightCard>
          )}
        </motion.section>

        {/* ━━━ Two-Column: Deliveries + Spend ━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">

          {/* ━━━ SECTION 6: Pending Deliveries ━━━ */}
          <motion.section
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Pending Deliveries
              </h2>
              {submissions.length > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-brand-dark text-[10px] font-bold animate-pulse">
                  {submissions.length}
                </span>
              )}
            </div>

            <SpotlightCard className="overflow-hidden">
              {submissions.length > 0 ? (
                <div className="divide-y divide-border/30">
                  {submissions.slice(0, 4).map((sub, i) => (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease }}
                      className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={sub.creative?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-purple-600 text-white text-xs font-bold">
                          {sub.creative?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {sub.creative?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sub.opportunity?.title || 'Work Delivery'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="bg-brand-purple-500/10 text-brand-purple-500 border-brand-purple-500/30 text-[10px]">
                          <HugeiconsIcon icon={PackageIcon} className="w-3 h-3 mr-0.5" />
                          {sub.files?.length || 0} files
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-brand-purple-600 dark:text-brand-400 hover:bg-brand-purple-500/10 dark:bg-brand-500/10 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          asChild
                        >
                          <Link href="/dashboard/employer/applications">
                            Review
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <HugeiconsIcon icon={PackageIcon} className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No pending deliveries</p>
                </div>
              )}
            </SpotlightCard>
          </motion.section>

          {/* ━━━ SECTION 7: Spend Analytics ━━━ */}
          <motion.section
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Budget Overview
              </h2>
            </div>

            <SpotlightCard className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-6">
                {/* Total Posted */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                    Total Budget Posted
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                    ${totalBudgetPosted.toLocaleString()}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-muted/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-purple-500"
                    />
                  </div>
                </div>

                {/* Committed */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">
                    Committed
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                    ${totalCommitted.toLocaleString()}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-muted/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: totalBudgetPosted > 0 ? `${Math.min((totalCommitted / totalBudgetPosted) * 100, 100)}%` : '0%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2, ease }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-purple-500 to-brand-purple-600"
                    />
                  </div>
                </div>
              </div>

              {totalBudgetPosted > 0 && (
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/30">
                  <HugeiconsIcon icon={AnalyticsUpIcon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">
                      {Math.round((totalCommitted / totalBudgetPosted) * 100)}%
                    </span>{' '}
                    of posted budget committed to hires
                  </span>
                </div>
              )}
            </SpotlightCard>
          </motion.section>
        </div>

        {/* ━━━ SECTION 8: Activity Timeline ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Recent Activity
            </h2>
          </div>

          {notifications.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border/50" />

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="space-y-4"
              >
                {notifications.map((notif) => {
                  const { iconEl, color } = getNotificationIcon(notif.type)
                  return (
                    <motion.div
                      key={notif.id}
                      variants={fadeUp}
                      className="relative flex items-start gap-4 pl-10"
                    >
                      <div className={cn(
                        'absolute left-2 top-2 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-background',
                        color
                      )}>
                        {iconEl}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                          {!notif.is_read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDistanceToNow(notif.created_at)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>

              <div className="text-center mt-4">
                <Button variant="ghost" size="sm" className="text-brand-purple-600 dark:text-brand-400 text-xs gap-1" asChild>
                  <Link href="/notifications">
                    View All Activity <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                  </Link>
                </Button>
                    </div>
            </div>
          ) : (
            <SpotlightCard className="flex flex-col items-center justify-center py-16 text-center">
              <HugeiconsIcon icon={Notification01Icon} className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </SpotlightCard>
          )}
        </motion.section>

        {/* ━━━ SECTION 9: Footer CTA ━━━ */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600/15 via-brand-purple-500/10 to-brand-400/5 border border-brand-500/15 p-8 sm:p-10">
            <div className="relative text-center sm:text-left sm:flex items-center justify-between gap-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                  Ready to find your next{' '}
                  <span className="bg-gradient-to-r from-brand-500 to-brand-purple-500 bg-clip-text text-transparent">
                    star talent
                  </span>
                  ?
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Post an opportunity or browse portfolios to connect with creative professionals.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                <Button
                  className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-6 gap-2 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
                  asChild
                >
                  <Link href="/opportunities/create">
                    <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
                    Post Opportunity
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 border-border/60 hover:border-brand-purple-500/30 dark:border-brand-500/30"
                  asChild
                >
                  <Link href="/portfolios">
                    Browse Portfolios
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  )
}

// ─── Opportunity Card ───────────────────────────────────────────────────────

function OpportunityCard({
  opportunity: opp,
  index,
  onToggleStatus,
}: {
  opportunity: Opportunity
  index: number
  onToggleStatus: (id: string, status: string) => void
}) {
  const typeColor = getTypeColor(opp.type)
  const daysLeft = getDaysUntil(opp.deadline)

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="group"
    >
      <SpotlightCard className="overflow-hidden hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300">
      {/* Top accent bar */}
      <div className={cn('h-1', typeColor.bg)} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2 group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
              {opp.title}
                        </h3>
          </div>
          <button
            onClick={() => onToggleStatus(opp.id, opp.status)}
            className="flex-shrink-0 mt-0.5"
            title={opp.status === 'open' ? 'Close opportunity' : 'Reopen opportunity'}
          >
            {opp.status === 'open' ? (
              <HugeiconsIcon icon={ToggleOnIcon} className="w-6 h-6 text-emerald-500 hover:text-emerald-600 transition-colors" />
            ) : (
              <HugeiconsIcon icon={ToggleOffIcon} className="w-6 h-6 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </button>
                      </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <Badge variant="outline" className={cn('text-[10px] uppercase font-bold px-1.5 py-0', typeColor.light, typeColor.text, typeColor.border)}>
            {opp.type}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {opp.category}
          </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
              'text-[10px] px-1.5 py-0',
              opp.status === 'open'
                ? 'bg-green-500/10 text-green-500 border-green-500/30'
                : 'bg-muted/50 text-muted-foreground border-border'
            )}
          >
            {opp.status === 'open' ? 'Open' : 'Closed'}
                      </Badge>
                    </div>

        {/* Application bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Applications</span>
            <span className="font-semibold text-foreground">{opp.applications_count || 0}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min((opp.applications_count || 0) * 10, 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className={cn('h-full rounded-full', typeColor.bg)}
            />
          </div>
                </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
            {formatDistanceToNow(opp.created_at)}
          </span>
          {daysLeft !== null && (
            <span className={cn(
              'flex items-center gap-1',
              daysLeft <= 3 ? 'text-red-400 font-medium' : daysLeft <= 7 ? 'text-brand-purple-500' : ''
            )}>
              <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
              {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
            </span>
          )}
          {opp.location && (
            <span className="flex items-center gap-1 truncate">
              <HugeiconsIcon icon={Location01Icon} className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{opp.is_remote ? 'Remote' : opp.location}</span>
            </span>
          )}
        </div>

        {/* View link */}
        <div className="mt-4 pt-3 border-t border-border/30">
          <Link
            href={`/opportunities/${opp.id}`}
            className="flex items-center gap-1 text-xs font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 transition-colors group/link"
          >
            View Details
            <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>
    </div>
      </SpotlightCard>
    </motion.div>
  )
}
