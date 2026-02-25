'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading02Icon,
  Message01Icon,
  PackageIcon,
  Refresh01Icon,
  RotateLeft01Icon,
  Search01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
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

interface DeliverableFile {
  url: string | null
  name: string
  size: number
  type: string
  path?: string
  bucket?: string
  protected?: boolean
}

interface WorkSubmission {
  id: string
  application_id: string
  opportunity_id: string
  creative_id: string
  employer_id: string
  message: string
  files: DeliverableFile[]
  status: 'submitted' | 'revision_requested' | 'approved' | 'payment_pending' | 'superseded'
  revision_count?: number
  feedback: string | null
  created_at: string
  updated_at: string
  profiles?: { full_name: string; avatar_url: string | null }
  opportunities?: { id: string; title: string; type: string; category: string }
  applications?: { id: string; proposed_budget: number }
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

type StatusFilter = 'all' | 'submitted' | 'revision_requested' | 'payment_pending' | 'approved'

// ─── Animation ──────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusConfig: Record<StatusFilter, { label: string; color: string; bg: string; light: string; border: string }> = {
  all: { label: 'All', color: 'text-foreground', bg: 'bg-foreground', light: 'bg-muted', border: 'border-border' },
  submitted: { label: 'Submitted', color: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', light: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30' },
  revision_requested: { label: 'Revision Requested', color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', light: 'bg-brand-500/10', border: 'border-brand-500/30' },
  payment_pending: { label: 'Awaiting Payment', color: 'text-orange-500', bg: 'bg-orange-500', light: 'bg-orange-500/10', border: 'border-orange-500/30' },
  approved: { label: 'Paid & Complete', color: 'text-emerald-500', bg: 'bg-emerald-500', light: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
}

function useCountUp(target: number, duration = 1200, isActive = true) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const animRef = useRef<number>(0)
  useEffect(() => {
    if (!isActive || target === 0) { setValue(target); return }
    startTime.current = null
    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts
      const p = Math.min((ts - startTime.current) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [target, duration, isActive])
  return value
}

const FEEDBACK_TEMPLATES = [
  'Please adjust the colors/contrast',
  'File format needs to be different',
  'Resolution/quality is too low',
  'Missing elements from the brief',
  'Great work, just minor tweaks needed',
]

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EmployerDeliverablesPage() {
  const { userId, role, isLoading: sessionLoading } = useSession()

  const [isLoading, setIsLoading] = useState(true)
  const [submissions, setSubmissions] = useState<WorkSubmission[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Review state
  const [reviewingSubmission, setReviewingSubmission] = useState<WorkSubmission | null>(null)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [isUpdatingSubmission, setIsUpdatingSubmission] = useState(false)

  // Payment state
  const [escrowStatusMap, setEscrowStatusMap] = useState<Record<string, EscrowStatus>>({})
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)
  const [mandatoryPayDialog, setMandatoryPayDialog] = useState<{ open: boolean; submissionId: string; amount: number } | null>(null)

  // Expanded messages
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Stats
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-40px' })

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId && role === 'employer') loadSubmissions()
  }, [userId, role])

  useEffect(() => {
    if (submissions.length === 0) return
    const subsNeedingEscrow = submissions.filter(s =>
      ['submitted', 'approved', 'payment_pending'].includes(s.status)
    )
    subsNeedingEscrow.forEach(s => fetchEscrowStatus(s.id))
  }, [submissions])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userId && role === 'employer') {
        loadSubmissions()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [userId, role])

  const loadSubmissions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/work-submissions?role=employer')
      if (res.ok) {
        const data = await res.json()
        setSubmissions(data.submissions || [])
      }
    } catch (err) {
      console.error('Error loading submissions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleReviewSubmission = (sub: WorkSubmission, action: 'approved' | 'revision_requested') => {
    setReviewingSubmission(sub)
    if (action === 'approved') {
      updateSubmissionStatus(sub.id, 'approved')
    } else {
      setRevisionFeedback('')
      setIsReviewDialogOpen(true)
    }
  }

  const submitRevisionRequest = async () => {
    if (!reviewingSubmission) return
    await updateSubmissionStatus(reviewingSubmission.id, 'revision_requested', revisionFeedback.trim() || undefined)
    setIsReviewDialogOpen(false)
    setReviewingSubmission(null)
    setRevisionFeedback('')
  }

  const updateSubmissionStatus = async (submissionId: string, status: 'approved' | 'revision_requested', feedback?: string) => {
    setIsUpdatingSubmission(true)
    try {
      const response = await fetch('/api/work-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, status, feedback }),
      })
      const data = await response.json()

      if (response.ok) {
        setSubmissions(prev => prev.map(s =>
          s.id === submissionId ? { ...s, status: data.submission.status, feedback: data.submission.feedback } : s
        ))
        if (data.payment_required) {
          toast.success('Work approved! Redirecting to payment...')
          initiatePayment(submissionId, data.payment_percentage || 100)
        } else {
          toast.success(status === 'approved' ? 'Work approved!' : 'Revision requested')
        }
      } else {
        if (data.must_pay_partial) {
          const sub = submissions.find(s => s.id === submissionId)
          const budget = sub?.applications?.proposed_budget || 0
          setMandatoryPayDialog({ open: true, submissionId, amount: budget * 0.5 })
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
        body: JSON.stringify({ submission_id: submissionId, payment_percentage: paymentPercentage }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.redirectUrl) window.location.href = data.redirectUrl
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
      const res = await fetch(`/api/payments/status?submission_id=${submissionId}`)
      if (res.ok) {
        const data: EscrowStatus = await res.json()
        setEscrowStatusMap(prev => ({ ...prev, [submissionId]: data }))
      }
    } catch { /* silent */ }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const active = useMemo(() => submissions.filter(s => s.status !== 'superseded'), [submissions])

  const counts = useMemo(() => ({
    submitted: active.filter(s => s.status === 'submitted').length,
    revision_requested: active.filter(s => s.status === 'revision_requested').length,
    payment_pending: active.filter(s => s.status === 'payment_pending').length,
    approved: active.filter(s => s.status === 'approved').length,
  }), [active])

  const submittedCount = useCountUp(counts.submitted, 1000, statsInView && !isLoading)
  const revisionCount = useCountUp(counts.revision_requested, 1100, statsInView && !isLoading)
  const paymentCount = useCountUp(counts.payment_pending, 1200, statsInView && !isLoading)
  const approvedCount = useCountUp(counts.approved, 1300, statsInView && !isLoading)
  const countUpValues: Record<StatusFilter, number> = {
    all: active.length,
    submitted: submittedCount,
    revision_requested: revisionCount,
    payment_pending: paymentCount,
    approved: approvedCount,
  }

  const filtered = useMemo(() => {
    return active.filter(s => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      const matchesSearch = !searchQuery ||
        s.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.opportunities?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.message?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [active, statusFilter, searchQuery])

  // ── Guards ────────────────────────────────────────────────────────────────

  if (sessionLoading || (role !== 'employer' && !sessionLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ━━━ Hero Header ━━━ */}
      <section className="relative overflow-hidden">
        <div className="relative container mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-4">
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
              Deliverables Review
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Review{' '}
              <span className="text-brand-dark dark:text-foreground">
                Deliverables
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg">
              Preview work submissions, approve deliverables, and manage payments — all in one place.
            </motion.p>
          </motion.div>

          {/* ── Stat Pills ── */}
          <motion.div
            ref={statsRef}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mt-6 flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
          >
            {(Object.keys(statusConfig) as StatusFilter[]).map((key) => {
              const cfg = statusConfig[key]
              const count = isLoading ? '-' : key === 'all' ? active.length : countUpValues[key]
              const isActive = statusFilter === key

              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStatusFilter(isActive && key !== 'all' ? 'all' : key)}
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
                      layoutId="deliverablePillActive"
                      className={cn('absolute inset-0 rounded-xl border-2', cfg.border)}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  {key !== 'all' && <div className={cn('relative w-2 h-2 rounded-full', cfg.bg)} />}
                  <span className="relative text-lg font-bold text-foreground tabular-nums">{count}</span>
                  <span className="relative text-xs text-muted-foreground">{cfg.label}</span>
                </motion.button>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ━━━ Main Content ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-20">

        {/* ── Search + Refresh ── */}
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
              placeholder="Search by creative name or opportunity..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-xl bg-card/60 backdrop-blur-sm border-border/60 text-sm focus-visible:ring-brand-500/30"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-xl border-border/60 flex-shrink-0"
            onClick={loadSubmissions}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Refresh01Icon} className={cn('w-4.5 h-4.5', isLoading && 'animate-spin')} />
          </Button>
        </motion.div>

        {/* ── Submission Cards ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
            <p className="text-sm text-muted-foreground">Loading deliverables...</p>
          </div>
        ) : filtered.length > 0 ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-5"
          >
            {filtered.map((sub) => {
              const escrow = escrowStatusMap[sub.id]
              const filesReleased = escrow?.files_released || sub.status === 'approved'
              const isMessageLong = sub.message && sub.message.length > 150
              const isExpanded = expandedMessages.has(sub.id)

              return (
                <motion.div key={sub.id} variants={fadeUp}>
                  <SpotlightCard className="overflow-hidden">
                    <div className="p-5 sm:p-6">

                      {/* ── Header: Creative + Opportunity ── */}
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="w-10 h-10 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 flex-shrink-0">
                          <AvatarImage src={sub.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold text-xs">
                            {sub.profiles?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm">
                              {sub.profiles?.full_name || 'Unknown Creative'}
                            </h3>
                            <SubmissionStatusBadge status={sub.status} />
                            {escrow?.escrow?.status && (() => {
                              const escrowStatusLabels: Record<string, { label: string; className: string }> = {
                                payment_received: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
                                partial_payment_received: { label: 'Partial Paid', className: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
                                payout_initiated: { label: 'Payout Sent', className: 'bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/20' },
                                completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
                                partial_payout_completed: { label: 'Partial Complete', className: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
                                awaiting_payment: { label: 'Awaiting Payment', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
                              }
                              const cfg = escrowStatusLabels[escrow.escrow.status]
                              return cfg ? (
                                <Badge variant="outline" className={cn('text-[9px]', cfg.className)}>
                                  {cfg.label}
                                </Badge>
                              ) : null
                            })()}
                            {sub.revision_count !== undefined && sub.revision_count > 0 && (
                              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/30">
                                Rev {sub.revision_count}/2
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {sub.opportunities?.title && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {sub.opportunities.title}
                              </span>
                            )}
                            {sub.opportunities?.type && (
                              <>
                                <span className="text-[10px] text-muted-foreground/60">·</span>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0">
                                  {sub.opportunities.type}
                                </Badge>
                              </>
                            )}
                            <span className="text-[10px] text-muted-foreground/60">·</span>
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(sub.created_at)}</span>
                          </div>
                        </div>

                        {sub.applications?.proposed_budget ? (
                          <div className="text-right flex-shrink-0 hidden sm:block">
                            <p className="text-sm font-bold text-foreground">Le {sub.applications.proposed_budget.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</p>
                          </div>
                        ) : null}
                      </div>

                      {/* ── Message ── */}
                      {sub.message && (
                        <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                          <div className="flex items-start gap-2">
                            <HugeiconsIcon icon={Message01Icon} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-xs text-foreground leading-relaxed', !isExpanded && isMessageLong && 'line-clamp-3')}>
                                {sub.message}
                              </p>
                              {isMessageLong && (
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedMessages)
                                    isExpanded ? next.delete(sub.id) : next.add(sub.id)
                                    setExpandedMessages(next)
                                  }}
                                  className="text-[10px] text-brand-purple-600 dark:text-brand-400 hover:text-brand-600 font-medium mt-1 transition-colors"
                                >
                                  {isExpanded ? 'Show less' : 'Read more'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Feedback (if revision requested) ── */}
                      {sub.feedback && sub.status === 'revision_requested' && (
                        <div className="mb-4 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
                          <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">Your Feedback</p>
                          <p className="text-xs text-foreground">{sub.feedback}</p>
                        </div>
                      )}

                      {/* ── File Previews ── */}
                      {sub.files && sub.files.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <HugeiconsIcon icon={PackageIcon} className="w-3 h-3" />
                            {sub.files.length} Deliverable{sub.files.length > 1 ? 's' : ''}
                          </p>
                          <DeliverablePreview
                            files={sub.files}
                            submissionId={sub.id}
                            filesReleased={filesReleased}
                          />
                        </div>
                      )}

                      {/* ── Action Bar ── */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                        {sub.status === 'submitted' && (
                          <>
                            <motion.div whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 h-9"
                                disabled={isUpdatingSubmission}
                                onClick={() => handleReviewSubmission(sub, 'approved')}
                              >
                                {isUpdatingSubmission && reviewingSubmission?.id === sub.id
                                  ? <HugeiconsIcon icon={Loading02Icon} className="w-3.5 h-3.5 animate-spin" />
                                  : <><HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5" /> Approve &amp; Pay</>
                                }
                              </Button>
                            </motion.div>
                            <motion.div whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto text-brand-600 dark:text-brand-400 hover:bg-brand-500/5 rounded-lg gap-1.5 h-9"
                                disabled={isUpdatingSubmission}
                                onClick={() => handleReviewSubmission(sub, 'revision_requested')}
                              >
                                <HugeiconsIcon icon={RotateLeft01Icon} className="w-3.5 h-3.5" /> Request Revision
                              </Button>
                            </motion.div>
                          </>
                        )}
                        {sub.status === 'payment_pending' && (
                          <motion.div whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 h-9"
                              disabled={isPaymentProcessing}
                              onClick={() => initiatePayment(sub.id, 100)}
                            >
                              {isPaymentProcessing
                                ? <HugeiconsIcon icon={Loading02Icon} className="w-3.5 h-3.5 animate-spin" />
                                : <><MdAttachMoney className="w-4 h-4" /> Complete Payment</>
                              }
                            </Button>
                          </motion.div>
                        )}
                        {sub.status === 'revision_requested' && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <HugeiconsIcon icon={Clock01Icon} className="w-3.5 h-3.5" />
                            <span className="text-xs">Awaiting resubmission from creative</span>
                          </div>
                        )}
                        {sub.status === 'approved' && (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Paid &amp; Complete — files available for download</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <SpotlightCard className="flex flex-col items-center justify-center py-20 text-center">
              <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {searchQuery || statusFilter !== 'all' ? 'No matching deliverables' : 'No deliverables yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'When creatives submit work for your opportunities, it will appear here for review.'}
              </p>
              {(searchQuery || statusFilter !== 'all') ? (
                <Button variant="outline" className="rounded-full" onClick={() => { setSearchQuery(''); setStatusFilter('all') }}>
                  Clear Filters
                </Button>
              ) : (
                <Button className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2" asChild>
                  <Link href="/dashboard/employer/applications">
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4" />
                    View Applications
                  </Link>
                </Button>
              )}
            </SpotlightCard>
          </motion.div>
        )}
      </div>

      {/* ━━━ Floating Attention Bar ━━━ */}
      <AnimatePresence>
        {counts.submitted > 0 && statusFilter === 'all' && !isLoading && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-brand-purple-500/30 shadow-xl shadow-black/10">
              <div className="w-2 h-2 rounded-full bg-brand-purple-500 animate-pulse" />
              <span className="text-sm text-foreground font-medium">
                {counts.submitted} deliverable{counts.submitted !== 1 ? 's' : ''} need{counts.submitted === 1 ? 's' : ''} your review
              </span>
              <Button
                size="sm"
                className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-1 h-7 text-xs"
                onClick={() => setStatusFilter('submitted')}
              >
                Review Now <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <Label className="text-xs font-medium">Quick Templates</Label>
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => setRevisionFeedback(prev => prev ? `${prev}\n${tpl}` : tpl)}
                    className="text-[10px] px-2.5 py-1.5 rounded-full border border-border/60 hover:border-brand-500/40 hover:bg-brand-500/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revision-feedback">Feedback</Label>
              <Textarea
                id="revision-feedback"
                placeholder="Describe what changes or improvements are needed..."
                value={revisionFeedback}
                onChange={e => setRevisionFeedback(e.target.value)}
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
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => { setIsReviewDialogOpen(false); setReviewingSubmission(null) }}>
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
              <p className="text-xs text-muted-foreground mt-1">50% of the original agreed amount</p>
            </div>
            <p className="text-xs text-muted-foreground">
              This payment compensates the creative for their time and effort. You will not receive the work files.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setMandatoryPayDialog(null)}>Cancel</Button>
              <Button
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
                disabled={isPaymentProcessing}
                onClick={() => { if (mandatoryPayDialog?.submissionId) initiatePayment(mandatoryPayDialog.submissionId, 50) }}
              >
                {isPaymentProcessing ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> : <MdAttachMoney className="w-4 h-4 mr-1" />}
                Pay 50%
              </Button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Status Badge ───────────────────────────────────────────────────────────

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
          Paid &amp; Approved
        </Badge>
      )
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
  }
}
