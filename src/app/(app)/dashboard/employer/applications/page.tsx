'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon, ArrowUpDownIcon, CancelCircleIcon, CheckmarkCircle01Icon, Clock01Icon, LinkSquare01Icon, Loading02Icon, Message01Icon, PackageIcon, Refresh01Icon, RotateLeft01Icon, Search01Icon, SparklesIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { MdAttachMoney } from 'react-icons/md'
import { motion, useInView, AnimatePresence } from 'motion/react'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import DeliverablePreview from '@/components/DeliverablePreview'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WorkSubmission {
  id: string
  application_id: string
  opportunity_id: string
  creative_id: string
  employer_id: string
  message: string
  files: { url: string; name: string; size: number; type: string; path?: string; bucket?: string; protected?: boolean }[]
  status: 'submitted' | 'revision_requested' | 'approved' | 'payment_pending' | 'superseded'
  revision_count?: number
  feedback: string | null
  created_at: string
  updated_at: string
}

interface EscrowStatus {
  escrow: {
    id: string
    status: string
    payment_amount: number
    payment_percentage: number
    currency: string
    files_released: boolean
    agreed_amount: number
  } | null
  payment_status: string
  files_released: boolean
  payment_amount?: number
  payment_percentage?: number
  currency?: string
}

interface Application {
  id: string
  status: string
  cover_letter: string
  proposed_budget: number
  created_at: string
  applicant_id: string
  opportunity_id: string
  portfolio_id: string | null
  opportunity?: {
    id: string
    title: string
    type: string
    category: string
    budget_min: number
    budget_max: number
    currency: string
    status: string
  }
  applicant?: {
    full_name: string
    avatar_url: string | null
    bio: string
    skills: string[]
  }
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

function useCountUp(target: number, duration = 1200, isActive = true) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || target === 0) { setValue(target); return }
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

const statusConfig = {
  pending: { icon: Clock01Icon, label: 'Pending', color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', light: 'bg-brand-500/10', border: 'border-brand-500/30', ring: 'ring-brand-500/20' },
  reviewing: { icon: ViewIcon, label: 'Reviewing', color: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', light: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', ring: 'ring-brand-purple-500/20' },
  accepted: { icon: CheckmarkCircle01Icon, label: 'Accepted', color: 'text-emerald-500', bg: 'bg-emerald-500', light: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: 'ring-emerald-500/20' },
  rejected: { icon: CancelCircleIcon, label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400', light: 'bg-red-500/10', border: 'border-red-500/30', ring: 'ring-red-400/20' },
} as const

type StatusKey = keyof typeof statusConfig

function getTypeColor(type?: string) {
  switch (type?.toLowerCase()) {
    case 'gig': return 'bg-brand-purple-500'
    case 'job': return 'bg-brand-500'
    case 'investment': return 'bg-brand-purple-500'
    default: return 'bg-brand-purple-500'
  }
}

function getUrgencyDays(createdAt: string): { days: number; color: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 2) return { days, color: 'bg-brand-500' }
  if (days <= 5) return { days, color: 'bg-brand-500' }
  return { days, color: 'bg-red-400' }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EmployerApplicationsPage() {
  const { userId, role, isLoading: sessionLoading } = useSession()
  
  const [isLoading, setIsLoading] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedCovers, setExpandedCovers] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Deliveries state
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set())
  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, WorkSubmission[]>>({})
  const [loadingDeliveries, setLoadingDeliveries] = useState<Set<string>>(new Set())
  const [reviewingSubmission, setReviewingSubmission] = useState<WorkSubmission | null>(null)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false)

  // Payment state
  const [escrowStatusMap, setEscrowStatusMap] = useState<Record<string, EscrowStatus>>({})
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)
  const [mandatoryPayDialog, setMandatoryPayDialog] = useState<{ open: boolean; submissionId: string; amount: number } | null>(null)

  // Stats ref for count-up
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-40px' })

  // ── Data Loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId && role === 'employer') loadApplications()
  }, [userId, role])

  const loadApplications = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/applications?role=employer')
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

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleUpdateStatus = async (applicationId: string, newStatus: string) => {
    setUpdatingId(applicationId)
    try {
      const response = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, status: newStatus }),
      })
      if (response.ok) {
        setApplications(prev => prev.map(app => app.id === applicationId ? { ...app, status: newStatus } : app))
        const msgs: Record<string, string> = { reviewing: 'Application marked as reviewing', accepted: 'Application accepted!', rejected: 'Application rejected' }
        toast.success(msgs[newStatus] || 'Status updated')
      } else {
        toast.error('Failed to update application status')
      }
    } catch {
      toast.error('Failed to update')
    } finally {
      setUpdatingId(null)
    }
  }

  const toggleDeliveries = async (applicationId: string) => {
    const newExpanded = new Set(expandedDeliveries)
    if (newExpanded.has(applicationId)) {
      newExpanded.delete(applicationId)
      setExpandedDeliveries(newExpanded)
      return
    }
    newExpanded.add(applicationId)
    setExpandedDeliveries(newExpanded)

    if (!deliveriesMap[applicationId]) {
      setLoadingDeliveries(prev => new Set([...prev, applicationId]))
      try {
        const response = await fetch(`/api/work-submissions?application_id=${applicationId}`)
        if (response.ok) {
          const data = await response.json()
          setDeliveriesMap(prev => ({ ...prev, [applicationId]: data.submissions || [] }))
        }
      } catch {
        toast.error('Failed to load deliveries')
      } finally {
        setLoadingDeliveries(prev => { const n = new Set(prev); n.delete(applicationId); return n })
      }
    }
  }

  const handleReviewSubmission = (submission: WorkSubmission, action: 'approved' | 'revision_requested') => {
    setReviewingSubmission(submission)
    if (action === 'approved') {
      updateSubmissionStatus(submission.id, 'approved', submission.application_id)
    } else {
      setRevisionFeedback('')
      setIsReviewDialogOpen(true)
    }
  }

  const submitRevisionRequest = async () => {
    if (!reviewingSubmission) return
    await updateSubmissionStatus(reviewingSubmission.id, 'revision_requested', reviewingSubmission.application_id, revisionFeedback.trim() || undefined)
    setIsReviewDialogOpen(false)
    setReviewingSubmission(null)
    setRevisionFeedback('')
  }

  const updateSubmissionStatus = async (submissionId: string, status: 'approved' | 'revision_requested', applicationId: string, feedback?: string) => {
    setIsUpdatingSubmission(true)
    try {
      const response = await fetch('/api/work-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, status, feedback }),
      })

      const data = await response.json()

      if (response.ok) {
        setDeliveriesMap(prev => ({
          ...prev,
          [applicationId]: (prev[applicationId] || []).map(s =>
            s.id === submissionId ? { ...s, status: data.submission.status, feedback: data.submission.feedback } : s
          ),
        }))

        if (data.payment_required) {
          toast.success('Work approved! Redirecting to payment...')
          initiatePayment(submissionId, data.payment_percentage || 100)
        } else {
          toast.success(status === 'approved' ? 'Work approved!' : 'Revision requested')
        }
      } else {
        if (data.must_pay_partial) {
          // Max revisions exhausted -- show mandatory 50% payment dialog
          const app = applications.find(a =>
            (deliveriesMap[a.id] || []).some(s => s.id === submissionId)
          )
          const budget = app?.proposed_budget || 0
          setMandatoryPayDialog({
            open: true,
            submissionId,
            amount: budget * 0.5,
          })
        } else {
          toast.error(data.error || 'Failed to update submission')
        }
      }
    } catch {
      toast.error('Failed to update submission')
    } finally {
      setIsUpdatingSubmission(false)
    }
  }

  const initiatePayment = async (submissionId: string, paymentPercentage: number) => {
    setIsPaymentProcessing(true)
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          payment_percentage: paymentPercentage,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl
        }
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to initiate payment')
      }
    } catch {
      toast.error('Failed to initiate payment')
    } finally {
      setIsPaymentProcessing(false)
    }
  }

  const fetchEscrowStatus = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/payments/status?submission_id=${submissionId}`)
      if (response.ok) {
        const data: EscrowStatus = await response.json()
        setEscrowStatusMap(prev => ({ ...prev, [submissionId]: data }))
      }
    } catch {
      // Silently fail
    }
  }

  // ── Derived Data ──────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    pending: applications.filter(a => a.status === 'pending').length,
    reviewing: applications.filter(a => a.status === 'reviewing').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }), [applications])

  const pendingCount = useCountUp(counts.pending, 1000, statsInView && !isLoading)
  const reviewingCount = useCountUp(counts.reviewing, 1100, statsInView && !isLoading)
  const acceptedCount = useCountUp(counts.accepted, 1200, statsInView && !isLoading)
  const rejectedCount = useCountUp(counts.rejected, 1300, statsInView && !isLoading)
  const countUpValues = { pending: pendingCount, reviewing: reviewingCount, accepted: acceptedCount, rejected: rejectedCount }

  const filtered = useMemo(() => {
    let result = applications.filter(app => {
      const matchesSearch = !searchQuery ||
        app.applicant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.opportunity?.title?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

    // Sort
    if (sortBy === 'oldest') result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    else if (sortBy === 'budget-high') result = [...result].sort((a, b) => (b.proposed_budget || 0) - (a.proposed_budget || 0))
    else result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return result
  }, [applications, searchQuery, statusFilter, sortBy])

  const grouped = useMemo(() => {
    return filtered.reduce((acc, app) => {
    const oppId = app.opportunity_id
      const opp = app.opportunity
    if (!acc[oppId]) {
        acc[oppId] = { title: opp?.title || 'Unknown Opportunity', type: opp?.type, applications: [] }
    }
    acc[oppId].applications.push(app)
    return acc
    }, {} as Record<string, { title: string; type?: string; applications: Application[] }>)
  }, [filtered])

  // ── Loading Guard ─────────────────────────────────────────────────────────

  if (sessionLoading || (role !== 'employer' && !sessionLoading)) {
  return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ━━━ SECTION 1: Hero Header ━━━ */}
      <section className="relative overflow-hidden">
        <div className="relative container mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-4">
          {/* Back button */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-foreground gap-1.5 -ml-2" asChild>
          <Link href="/dashboard/employer">
                <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
                Dashboard
          </Link>
        </Button>
          </motion.div>

          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <motion.p variants={fadeUp} className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-brand-purple-400 dark:text-brand-400/60 font-semibold mb-2">
              Application Review
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Review{' '}
              <span className="text-brand-dark dark:text-foreground">
                Applications
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg">
              {applications.length} total application{applications.length !== 1 ? 's' : ''} across your opportunities.
            </motion.p>
          </motion.div>

          {/* ── Stat Pills (Section 2) ── */}
          <motion.div
            ref={statsRef}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-6 flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
          >
            {/* All pill */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setStatusFilter('all')}
              className={cn(
                'relative flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-200',
                statusFilter === 'all'
                  ? 'bg-card/80 backdrop-blur-sm border-brand-500/30 shadow-lg shadow-brand-500/5'
                  : 'bg-card/40 backdrop-blur-sm border-border/50 hover:border-border'
              )}
            >
              {statusFilter === 'all' && (
                <motion.div layoutId="statPillActive" className="absolute inset-0 rounded-xl border-2 border-brand-500/40" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative text-sm font-semibold text-foreground">All</span>
              <span className="relative text-xs text-muted-foreground">{applications.length}</span>
            </motion.button>

            {(Object.keys(statusConfig) as StatusKey[]).map((key) => {
              const cfg = statusConfig[key]
              const count = countUpValues[key]
              const isActive = statusFilter === key

              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStatusFilter(isActive ? 'all' : key)}
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all duration-200',
                    isActive
                      ? 'bg-card/80 backdrop-blur-sm shadow-lg'
                      : 'bg-card/40 backdrop-blur-sm border-border/50 hover:border-border',
                    isActive && cfg.border
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="statPillActive"
                      className={cn('absolute inset-0 rounded-xl border-2', cfg.border)}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <HugeiconsIcon icon={cfg.icon} className={cn('relative w-4 h-4', cfg.color)} />
                  <span className="relative text-lg font-bold text-foreground tabular-nums">{isLoading ? '-' : count}</span>
                  <span className="relative text-xs text-muted-foreground capitalize">{cfg.label}</span>
                </motion.button>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-20">

        {/* ━━━ SECTION 3: Search + Sort ━━━ */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-6 mb-8 flex flex-col sm:flex-row gap-3"
        >
        <div className="relative flex-1">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <Input
              placeholder="Search by applicant name or opportunity title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-xl bg-card/60 backdrop-blur-sm border-border/60 text-sm focus-visible:ring-brand-500/30"
          />
        </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44 h-12 rounded-xl bg-card/60 backdrop-blur-sm border-border/60">
              <HugeiconsIcon icon={ArrowUpDownIcon} className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="budget-high">Budget: High-Low</SelectItem>
          </SelectContent>
        </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl border-border/60 flex-shrink-0"
            onClick={loadApplications}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Refresh01Icon} className={cn('w-4.5 h-4.5', isLoading && 'animate-spin')} />
          </Button>
        </motion.div>

        {/* ━━━ SECTION 4: Grouped Applications ━━━ */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
            <p className="text-sm text-muted-foreground">Loading applications...</p>
      </div>
        ) : Object.keys(grouped).length > 0 ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-8"
          >
            {Object.entries(grouped).map(([oppId, group]) => {
              const isCollapsed = collapsedGroups.has(oppId)
              const typeColor = getTypeColor(group.type)
              const pendingInGroup = group.applications.filter(a => a.status === 'pending').length

          return (
                <motion.div key={oppId} variants={fadeUp}>
                  {/* Shared group container */}
                  <SpotlightCard className="overflow-hidden">
                    {/* Group Header */}
                    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/30 bg-muted/20">
                      <div className={cn('w-1 h-6 rounded-full flex-shrink-0', typeColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{group.title}</h2>
                          {group.type && (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0">
                              {group.type}
                            </Badge>
                          )}
                </div>
                      </div>
                      {/* Bulk actions for pending */}
                      {pendingInGroup > 1 && !isCollapsed && (
                        <div className="hidden sm:flex items-center gap-1.5">
                          <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] rounded-lg gap-1 text-emerald-500 hover:bg-emerald-500/5 border-emerald-500/30"
                              onClick={() => {
                                group.applications
                                  .filter(a => a.status === 'pending')
                                  .forEach(a => handleUpdateStatus(a.id, 'accepted'))
                              }}
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />
                              Accept All ({pendingInGroup})
                            </Button>
                          </motion.div>
                          <motion.div whileTap={{ scale: 0.95 }}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] rounded-lg gap-1 text-red-400 hover:bg-red-500/5 border-red-500/30"
                              onClick={() => {
                                group.applications
                                  .filter(a => a.status === 'pending')
                                  .forEach(a => handleUpdateStatus(a.id, 'rejected'))
                              }}
                            >
                              <HugeiconsIcon icon={CancelCircleIcon} className="w-3 h-3" />
                              Reject All
                            </Button>
                          </motion.div>
                        </div>
                      )}
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {group.applications.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => {
                          const next = new Set(collapsedGroups)
                          isCollapsed ? next.delete(oppId) : next.add(oppId)
                          setCollapsedGroups(next)
                        }}
                      >
                        {isCollapsed ? <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4" /> : <HugeiconsIcon icon={ArrowUp01Icon} className="w-4 h-4" />}
                      </Button>
      </div>

                    {/* Application Rows */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-border/30">
                            {group.applications.map((app, idx) => (
                              <ApplicationRow
                                key={app.id}
                                app={app}
                                index={idx}
                                isUpdating={updatingId === app.id}
                                isDeliveryExpanded={expandedDeliveries.has(app.id)}
                                deliveries={deliveriesMap[app.id]}
                                isLoadingDeliveries={loadingDeliveries.has(app.id)}
                                isExpandedCover={expandedCovers.has(app.id)}
                                isUpdatingSubmission={isUpdatingSubmission}
                                isPaymentProcessing={isPaymentProcessing}
                                escrowStatusMap={escrowStatusMap}
                                onUpdateStatus={handleUpdateStatus}
                                onToggleDeliveries={toggleDeliveries}
                                onToggleCover={() => {
                                  const next = new Set(expandedCovers)
                                  next.has(app.id) ? next.delete(app.id) : next.add(app.id)
                                  setExpandedCovers(next)
                                }}
                                onReviewSubmission={handleReviewSubmission}
                                onInitiatePayment={initiatePayment}
                                onFetchEscrowStatus={fetchEscrowStatus}
                              />
                            ))}
        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
              </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <SpotlightCard className="flex flex-col items-center justify-center py-20 text-center">
            <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {searchQuery || statusFilter !== 'all' ? 'No matching applications' : 'No applications yet'}
                                </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Applications to your opportunities will appear here.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                                  variant="outline"
                className="rounded-full"
                onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              >
                Clear Filters
              </Button>
            )}
            </SpotlightCard>
          </motion.div>
        )}
                              </div>
                              
      {/* ━━━ Floating Attention Bar ━━━ */}
      <AnimatePresence>
        {counts.pending > 0 && statusFilter === 'all' && !isLoading && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-brand-500/30 shadow-xl shadow-black/10">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-sm text-foreground font-medium">
                {counts.pending} application{counts.pending !== 1 ? 's' : ''} need{counts.pending === 1 ? 's' : ''} your attention
              </span>
              <Button
                size="sm"
                className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-1 h-7 text-xs"
                onClick={() => setStatusFilter('pending')}
              >
                Review Now <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
              </Button>
                                </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Mandatory 50% Payment Dialog ━━━ */}
      <Dialog open={mandatoryPayDialog?.open || false} onOpenChange={(open) => !open && setMandatoryPayDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Creative Compensation Required</DialogTitle>
            <DialogDescription>
              Maximum revisions (2) have been reached. You must compensate the creative for their time with 50% of the agreed amount.
            </DialogDescription>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 mt-2"
          >
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-sm font-semibold text-orange-500">Amount Due</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                SLE {mandatoryPayDialog?.amount?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                50% of the original agreed amount
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              This payment compensates the creative for their time and effort. You will not receive the work files.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => setMandatoryPayDialog(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
                disabled={isPaymentProcessing}
                onClick={() => {
                  if (mandatoryPayDialog?.submissionId) {
                    initiatePayment(mandatoryPayDialog.submissionId, 50)
                  }
                }}
              >
                {isPaymentProcessing ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MdAttachMoney className="w-4 h-4 mr-1" />
                )}
                Pay 50%
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* ━━━ Revision Dialog ━━━ */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>Provide feedback about what needs to be changed</DialogDescription>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="revision-feedback">Feedback</Label>
              <Textarea
                id="revision-feedback"
                placeholder="Describe what changes or improvements are needed..."
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                rows={4}
                className="rounded-lg"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">This feedback will be sent to the creative</p>
                <p className="text-xs text-muted-foreground tabular-nums">{revisionFeedback.length}/1000</p>
                              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => { setIsReviewDialogOpen(false); setReviewingSubmission(null) }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
                onClick={submitRevisionRequest}
                disabled={isUpdatingSubmission}
              >
                {isUpdatingSubmission ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> : <HugeiconsIcon icon={RotateLeft01Icon} className="w-4 h-4 mr-2" />}
                Request Revision
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Application Row ────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  index,
  isUpdating,
  isDeliveryExpanded,
  deliveries,
  isLoadingDeliveries,
  isExpandedCover,
  isUpdatingSubmission,
  isPaymentProcessing,
  escrowStatusMap,
  onUpdateStatus,
  onToggleDeliveries,
  onToggleCover,
  onReviewSubmission,
  onInitiatePayment,
  onFetchEscrowStatus,
}: {
  app: Application
  index: number
  isUpdating: boolean
  isDeliveryExpanded: boolean
  deliveries?: WorkSubmission[]
  isLoadingDeliveries: boolean
  isExpandedCover: boolean
  isUpdatingSubmission: boolean
  isPaymentProcessing: boolean
  escrowStatusMap: Record<string, EscrowStatus>
  onUpdateStatus: (id: string, status: string) => void
  onToggleDeliveries: (id: string) => void
  onToggleCover: () => void
  onReviewSubmission: (sub: WorkSubmission, action: 'approved' | 'revision_requested') => void
  onInitiatePayment: (submissionId: string, percentage: number) => void
  onFetchEscrowStatus: (submissionId: string) => void
}) {
  const cfg = statusConfig[app.status as StatusKey] || statusConfig.pending
  const urgency = getUrgencyDays(app.created_at)
  const applicant = app.applicant

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group/row relative hover:bg-muted/20 transition-colors duration-200"
    >
      {/* Left status indicator */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-0.5', cfg.bg)} />

      <div className="px-4 sm:px-5 py-4">
        {/* ── Main row: avatar + info + actions ── */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0 mt-0.5">
            <Avatar className={cn('w-10 h-10 ring-2', cfg.ring)}>
              <AvatarImage src={applicant?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold text-xs">
                {applicant?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
              </AvatarFallback>
            </Avatar>
            {app.status === 'pending' && (
              <div className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card', urgency.color)} title={`${urgency.days}d waiting`} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {applicant?.full_name || 'Unknown Applicant'}
              </h3>
              <Badge variant="outline" className={cn('text-[10px] capitalize', cfg.light, cfg.color, cfg.border)}>
                {cfg.label}
              </Badge>
              {app.status === 'pending' && urgency.days > 5 && (
                <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30 gap-0.5">
                  <HugeiconsIcon icon={AlertCircleIcon} className="w-3 h-3" />
                  {urgency.days}d
                </Badge>
              )}
                                {app.proposed_budget > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto sm:ml-0">
                                    <MdAttachMoney className="w-3 h-3" />
                  <span className="font-medium text-foreground">Le {app.proposed_budget.toLocaleString()}</span>
                                  </span>
                                )}
            </div>

            {/* Compact meta */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {applicant?.skills && applicant.skills.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {applicant.skills.slice(0, 3).join(' · ')}
                  {applicant.skills.length > 3 && ` +${applicant.skills.length - 3}`}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60">·</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(app.created_at)}
                                </span>
                                {app.portfolio_id && (
                <>
                  <span className="text-[10px] text-muted-foreground/60">·</span>
                  <Link
                    href={`/portfolio/view/${app.portfolio_id}`}
                    className="text-[10px] text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 font-medium flex items-center gap-0.5 transition-colors"
                  >
                    <HugeiconsIcon icon={LinkSquare01Icon} className="w-3 h-3" />
                    Portfolio
                                    </Link>
                </>
                                )}
                            </div>
                          </div>

          {/* ── Actions (hover-reveal for pending/reviewing, always for accepted/rejected) ── */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {app.status === 'pending' && (
              <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity duration-200">
                <motion.div whileTap={{ scale: 0.93 }}>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1 text-brand-purple-600 dark:text-brand-400 hover:bg-brand-purple-500/5" disabled={isUpdating} onClick={() => onUpdateStatus(app.id, 'reviewing')}>
                    {isUpdating ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />}
                    <span className="hidden sm:inline">Review</span>
                                </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.93 }}>
                  <Button size="sm" className="h-7 text-[11px] rounded-lg gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isUpdating} onClick={() => onUpdateStatus(app.id, 'accepted')}>
                    {isUpdating ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />}
                    <span className="hidden sm:inline">Accept</span>
                                </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.93 }}>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1 text-red-400 hover:bg-red-500/5" disabled={isUpdating} onClick={() => onUpdateStatus(app.id, 'rejected')}>
                    {isUpdating ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <HugeiconsIcon icon={CancelCircleIcon} className="w-3 h-3" />}
                    <span className="hidden sm:inline">Reject</span>
                                </Button>
                </motion.div>
              </div>
                            )}
                            {app.status === 'reviewing' && (
              <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity duration-200">
                <motion.div whileTap={{ scale: 0.93 }}>
                  <Button size="sm" className="h-7 text-[11px] rounded-lg gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isUpdating} onClick={() => onUpdateStatus(app.id, 'accepted')}>
                    {isUpdating ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />}
                    <span className="hidden sm:inline">Accept</span>
                                </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.93 }}>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1 text-red-400 hover:bg-red-500/5" disabled={isUpdating} onClick={() => onUpdateStatus(app.id, 'rejected')}>
                    {isUpdating ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <HugeiconsIcon icon={CancelCircleIcon} className="w-3 h-3" />}
                    <span className="hidden sm:inline">Reject</span>
                                </Button>
                </motion.div>
              </div>
                            )}
                            {app.status === 'accepted' && (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1 text-brand-purple-600 dark:text-brand-400 hover:bg-brand-500/5" onClick={() => onToggleDeliveries(app.id)}>
                  <HugeiconsIcon icon={PackageIcon} className="w-3 h-3" />
                  <span className="hidden sm:inline">Deliveries</span>
                  {isDeliveryExpanded ? <HugeiconsIcon icon={ArrowUp01Icon} className="w-3 h-3" /> : <HugeiconsIcon icon={ArrowDown01Icon} className="w-3 h-3" />}
                                </Button>
              </motion.div>
                            )}
                            {app.status === 'rejected' && (
              <span className="text-[10px] text-muted-foreground/60 italic">Rejected</span>
                            )}
                          </div>
                        </div>

        {/* ── Expandable Cover Letter ── */}
        {app.cover_letter && isExpandedCover && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2.5 ml-[52px] p-3 rounded-lg bg-muted/30 border border-border/30"
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cover Letter</p>
            <p className="text-sm text-foreground leading-relaxed">{app.cover_letter}</p>
          </motion.div>
        )}

        {/* Cover letter toggle */}
        {app.cover_letter && (
          <button
            onClick={onToggleCover}
            className="ml-[52px] mt-1.5 text-[10px] text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 font-medium transition-colors"
          >
            {isExpandedCover ? 'Hide cover letter' : 'Show cover letter'}
          </button>
        )}

        {/* ── Deliveries Section ── */}
        <AnimatePresence>
          {isDeliveryExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease }}
              className="overflow-hidden"
            >
              <div className="mt-3 ml-[52px] pt-3 border-t border-border/30">
                <h4 className="text-[10px] font-semibold text-foreground mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                  <HugeiconsIcon icon={PackageIcon} className="w-3 h-3 text-brand-purple-600 dark:text-brand-400" />
                              Work Deliveries
                            </h4>

                {isLoadingDeliveries ? (
                  <div className="flex items-center justify-center py-4">
                    <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 animate-spin text-brand-purple-600 dark:text-brand-400" />
                              </div>
                ) : (deliveries?.length || 0) > 0 ? (
                  <div className="space-y-2.5">
                    {deliveries!.filter(s => s.status !== 'superseded').map((sub, si) => {
                      const escrow = escrowStatusMap[sub.id]
                      const filesReleased = escrow?.files_released || sub.status === 'approved'

                      return (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: si * 0.05 }}
                        className="rounded-lg bg-muted/20 border border-border/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                      <div className="flex items-center gap-2">
                            <SubmissionStatusBadge status={sub.status} />
                            {sub.revision_count !== undefined && sub.revision_count > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/30">
                                Rev {sub.revision_count}/2
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(sub.created_at)}</span>
                                      </div>
                                      {sub.status === 'submitted' && (
                            <div className="flex gap-1.5">
                              <motion.div whileTap={{ scale: 0.93 }}>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-6 text-[10px] rounded-md gap-1 px-2" disabled={isUpdatingSubmission} onClick={() => onReviewSubmission(sub, 'approved')}>
                                  {isUpdatingSubmission ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" /> : <><HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" /> Approve & Pay</>}
                                          </Button>
                              </motion.div>
                              <motion.div whileTap={{ scale: 0.93 }}>
                                <Button size="sm" variant="outline" className="text-brand-600 dark:text-brand-400 hover:bg-brand-500/5 h-6 text-[10px] rounded-md gap-1 px-2" disabled={isUpdatingSubmission} onClick={() => onReviewSubmission(sub, 'revision_requested')}>
                                  <HugeiconsIcon icon={RotateLeft01Icon} className="w-3 h-3" /> Revise
                                          </Button>
                              </motion.div>
                                        </div>
                                      )}
                                      {sub.status === 'payment_pending' && (
                            <motion.div whileTap={{ scale: 0.93 }}>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-6 text-[10px] rounded-md gap-1 px-2"
                                disabled={isPaymentProcessing}
                                onClick={() => onInitiatePayment(sub.id, 100)}
                              >
                                {isPaymentProcessing
                                  ? <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" />
                                  : <><MdAttachMoney className="w-3 h-3" /> Pay Now</>
                                }
                              </Button>
                            </motion.div>
                                      )}
                                    </div>

                                    {sub.message && (
                          <p className="text-xs text-foreground flex items-start gap-1.5 mb-1.5">
                            <HugeiconsIcon icon={Message01Icon} className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                          {sub.message}
                                        </p>
                                    )}

                                    {sub.files && sub.files.length > 0 && (
                          <DeliverablePreview
                            files={sub.files}
                            submissionId={sub.id}
                            filesReleased={filesReleased}
                          />
                                    )}

                                    {sub.feedback && (
                          <div className="mt-2 p-2 rounded-md bg-brand-500/5 border border-brand-500/15">
                            <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-0.5">Feedback</p>
                            <p className="text-xs text-foreground">{sub.feedback}</p>
                                      </div>
                                    )}
                      </motion.div>
                      )
                    })}
                              </div>
                            ) : (
                  <div className="text-center py-5">
                    <HugeiconsIcon icon={PackageIcon} className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">No deliveries yet</p>
                              </div>
                            )}
                          </div>
            </motion.div>
                        )}
        </AnimatePresence>
              </div>
    </motion.div>
  )
}

// ─── Submission Status Badge ────────────────────────────────────────────────

function SubmissionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'submitted':
      return (
        <Badge variant="outline" className="bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 text-[10px] gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-purple-500" />
          Submitted
        </Badge>
      )
    case 'revision_requested':
      return (
        <Badge variant="outline" className="bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30 text-[10px] gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          Revision Requested
        </Badge>
      )
    case 'payment_pending':
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 text-[10px] gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Awaiting Payment
        </Badge>
      )
    case 'approved':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Paid & Approved
        </Badge>
      )
    case 'superseded':
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
          Superseded
        </Badge>
      )
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
  }
}
