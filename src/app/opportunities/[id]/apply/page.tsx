'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AnalyticsUpIcon,
  ArrowLeft01Icon,
  Briefcase01Icon,
  CheckmarkCircle01Icon,
  FileAttachmentIcon,
  Loading02Icon,
  SentIcon,
  SparklesIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { MdAttachMoney, MdBolt } from 'react-icons/md'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import SpotlightCard from '@/components/SpotlightCard'
import { useSession } from '@/components/providers/user-session-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

type OpportunityType = 'gig' | 'job' | 'investment'

interface Opportunity {
  id: string
  title: string
  type: OpportunityType
  budgetMin: number
  budgetMax: number
  currency: string
  companyName: string | null
  author: {
    id: string
    fullName: string
    avatarUrl?: string
  }
}

interface ServerPortfolio {
  id: string
  title: string
  tagline: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

function getTypeAccent(type: OpportunityType) {
  switch (type) {
    case 'gig':        return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', bar: 'from-brand-purple-500 to-brand-500' }
    case 'job':        return { text: 'text-brand-600 dark:text-brand-400',        bg: 'bg-brand-500/10',        border: 'border-brand-500/30',        bar: 'from-brand-500 to-brand-600' }
    case 'investment': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', bar: 'from-brand-purple-500 to-brand-500' }
  }
}

function getTypeLabel(type: OpportunityType) {
  switch (type) {
    case 'gig':        return 'Gig'
    case 'job':        return 'Full-time Job'
    case 'investment': return 'Investment'
  }
}

function getTypeIcon(type: OpportunityType, cls = 'w-3 h-3') {
  switch (type) {
    case 'gig':        return <MdBolt className={cls} />
    case 'job':        return <HugeiconsIcon icon={Briefcase01Icon} className={cls} />
    case 'investment': return <HugeiconsIcon icon={AnalyticsUpIcon} className={cls} />
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const params   = useParams()
  const router   = useRouter()
  const { user, isLoaded } = useUser()
  const { userId: sessionUserId, role } = useSession()
  const opportunityId = params.id as string

  const [opportunity,   setOpportunity]   = useState<Opportunity | null>(null)
  const [isLoadingOpp,  setIsLoadingOpp]  = useState(true)
  const [portfolios,    setPortfolios]    = useState<ServerPortfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState('')
  const [coverLetter,   setCoverLetter]   = useState('')
  const [proposedBudget, setProposedBudget] = useState('')
  const [isSubmitting,  setIsSubmitting]  = useState(false)

  // Redirect away if not a creative
  useEffect(() => {
    if (isLoaded && (!user || role === 'business')) {
      router.replace(`/opportunities/${opportunityId}`)
    }
  }, [isLoaded, user, role, opportunityId, router])

  useEffect(() => { loadOpportunity() }, [opportunityId])

  useEffect(() => {
    if (sessionUserId) {
      loadPortfolios()
      checkAlreadyApplied()
    }
  }, [opportunityId, sessionUserId])

  const loadOpportunity = async () => {
    setIsLoadingOpp(true)
    try {
      const res = await fetch(`/api/opportunities?id=${opportunityId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.opportunity) setOpportunity(data.opportunity)
      }
    } catch (e) {
      console.error('Error loading opportunity:', e)
    } finally {
      setIsLoadingOpp(false)
    }
  }

  const loadPortfolios = async () => {
    try {
      const res = await fetch('/api/portfolios')
      if (res.ok) {
        const data = await res.json()
        const list: ServerPortfolio[] = data.portfolios || []
        setPortfolios(list)
        if (list.length > 0) setSelectedPortfolio(list[0].id)
      }
    } catch (e) {
      console.error('Error loading portfolios:', e)
    }
  }

  const checkAlreadyApplied = async () => {
    try {
      const res = await fetch(`/api/applications?opportunity_id=${opportunityId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.applications?.length > 0) {
          toast.info('You have already applied for this opportunity.')
          router.replace(`/opportunities/${opportunityId}`)
        }
      }
    } catch { /* ignore */ }
  }

  const handleApply = async () => {
    if (!selectedPortfolio) { toast.error('Please select a portfolio to showcase'); return }
    if (!coverLetter.trim()) { toast.error('Please write a cover letter'); return }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id:  opportunityId,
          portfolio_id:    selectedPortfolio,
          cover_letter:    coverLetter.trim(),
          proposed_budget: proposedBudget ? parseFloat(proposedBudget) : null,
        }),
      })
      if (res.ok) {
        toast.success('Application submitted successfully!')
        router.push(`/opportunities/${opportunityId}`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit application')
      }
    } catch (e) {
      console.error('Error submitting application:', e)
      toast.error('Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  const coverLen = coverLetter.length
  const coverMax = 2000
  const coverPct = Math.min((coverLen / coverMax) * 100, 100)
  const isComplete = !!selectedPortfolio && coverLetter.trim().length > 0

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoadingOpp || !isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Opportunity not found.</p>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/opportunities">Back to Opportunities</Link>
        </Button>
      </div>
    )
  }

  const accent = getTypeAccent(opportunity.type)
  const poster = opportunity.companyName ?? opportunity.author.fullName

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Full-width hero bar ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease }}
        className="relative overflow-hidden border-b border-border/40"
      >
        {/* gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple-600/15 via-brand-500/8 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between gap-4">
          {/* Back */}
          <Button variant="ghost" size="sm" className="rounded-full shrink-0 text-muted-foreground hover:text-foreground gap-1.5" asChild>
            <Link href={`/opportunities/${opportunityId}`}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>

          {/* Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/30 to-brand-purple-500/20 flex items-center justify-center shrink-0">
              <HugeiconsIcon icon={SentIcon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Submit Application</p>
              <p className="text-sm font-bold text-foreground truncate">{opportunity.title}</p>
            </div>
          </div>

          {/* Step badge */}
          <div className="shrink-0 flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border', accent.bg, accent.border, accent.text)}>
              {getTypeIcon(opportunity.type, 'w-3 h-3')}
              {getTypeLabel(opportunity.type)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Two-column body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">

          {/* ════ LEFT — sticky context panel ════ */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.05 }}
            className="lg:sticky lg:top-24 space-y-4"
          >
            <SpotlightCard
              className="overflow-hidden"
              spotlightColor="rgba(126, 93, 167, 0.12)"
            >
              {/* Top gradient accent strip */}
              <div className={cn('h-1 w-full bg-gradient-to-r', accent.bar)} />

              <div className="p-5 space-y-5">
                {/* Type badge */}
                <div className="flex items-center justify-between">
                  <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', accent.bg, accent.border, accent.text)}>
                    {getTypeIcon(opportunity.type, 'w-3 h-3')}
                    {getTypeLabel(opportunity.type)}
                  </div>
                  <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 text-muted-foreground/50" />
                </div>

                {/* Opportunity title */}
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-snug">
                    {opportunity.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{poster}</p>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/50" />

                {/* Budget */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <MdAttachMoney className="w-3.5 h-3.5" />
                    Budget Range
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-foreground">
                      {opportunity.budgetMin.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">–</span>
                    <span className="text-xl font-bold text-foreground">
                      {opportunity.budgetMax.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium ml-0.5">
                      {opportunity.currency}
                    </span>
                  </div>
                  {/* gradient range bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full bg-gradient-to-r w-full', accent.bar)} />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-border/50" />

                {/* Posted by */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Posted by</p>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 ring-offset-2 ring-offset-background">
                      <AvatarImage src={opportunity.author.avatarUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                        {opportunity.author.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{opportunity.author.fullName}</p>
                      {opportunity.companyName && (
                        <p className="text-xs text-muted-foreground">{opportunity.companyName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                  <div className="flex gap-2.5">
                    <HugeiconsIcon icon={UserCircleIcon} className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your application will be reviewed by <span className="font-semibold text-foreground">{poster}</span>. Showcase your best work to stand out.
                    </p>
                  </div>
                </div>
              </div>
            </SpotlightCard>

            {/* Completion indicator */}
            <div className="px-1 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Application completeness</span>
                <span className={cn('font-bold', isComplete ? 'text-green-500' : 'text-muted-foreground')}>
                  {isComplete ? 'Ready' : 'Incomplete'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full bg-gradient-to-r', isComplete ? 'from-green-500 to-green-400' : 'from-brand-500 to-brand-purple-500')}
                  animate={{ width: `${(!selectedPortfolio ? 0 : 50) + (coverLetter.trim() ? 50 : 0)}%` }}
                  transition={{ duration: 0.4, ease }}
                />
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className={cn('flex items-center gap-1', selectedPortfolio && 'text-green-500 font-medium')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', selectedPortfolio ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                  Portfolio
                </span>
                <span className={cn('flex items-center gap-1', coverLetter.trim() && 'text-green-500 font-medium')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', coverLetter.trim() ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                  Cover letter
                </span>
              </div>
            </div>
          </motion.div>

          {/* ════ RIGHT — open form column ════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="lg:col-span-2 space-y-10 pb-24 lg:pb-10"
          >

            {/* ── Section 1: Portfolio ── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
                <h2 className="text-base font-bold text-foreground">Choose Your Portfolio</h2>
                <Badge variant="outline" className="ml-auto text-[10px] font-bold uppercase tracking-wider border-red-500/30 text-red-500 bg-red-500/5">
                  Required
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4 -mt-2">
                Select the portfolio that best represents your work for this opportunity.
              </p>

              {portfolios.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {portfolios.map((p, i) => {
                    const isSelected = selectedPortfolio === p.id
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease, delay: i * 0.05 }}
                        onClick={() => setSelectedPortfolio(p.id)}
                        className={cn(
                          'relative w-full text-left p-4 rounded-2xl border-2 transition-all duration-200',
                          'hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                          isSelected
                            ? 'border-brand-500 bg-gradient-to-br from-brand-500/5 to-brand-purple-500/5 shadow-md shadow-brand-500/10'
                            : 'border-border/50 bg-card hover:border-brand-purple-500/40 hover:shadow-sm'
                        )}
                      >
                        {/* Selected checkmark */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center"
                          >
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5 text-brand-dark" />
                          </motion.div>
                        )}

                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', isSelected ? 'bg-brand-500/15' : 'bg-muted')}>
                          <HugeiconsIcon icon={SparklesIcon} className={cn('w-4 h-4', isSelected ? 'text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground')} />
                        </div>
                        <p className={cn('text-sm font-bold leading-tight', isSelected ? 'text-foreground' : 'text-foreground/80')}>
                          {p.title || 'Untitled Portfolio'}
                        </p>
                        {p.tagline && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.tagline}</p>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed border-border bg-muted/20 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                    <HugeiconsIcon icon={FileAttachmentIcon} className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">No portfolios yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a portfolio to start applying</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full mt-1" asChild>
                    <Link href="/dashboard/portfolios/new">Create a Portfolio</Link>
                  </Button>
                </div>
              )}
            </section>

            {/* ── Section 2: Cover Letter ── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
                <h2 className="text-base font-bold text-foreground">Cover Letter</h2>
                <Badge variant="outline" className="ml-auto text-[10px] font-bold uppercase tracking-wider border-red-500/30 text-red-500 bg-red-500/5">
                  Required
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4 -mt-2">
                Tell the poster why you&apos;re the perfect fit. Be specific about your experience and what you bring to the table.
              </p>

              <div className="space-y-2">
                <Textarea
                  placeholder="Hi, I'm excited to apply for this opportunity because..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={9}
                  maxLength={coverMax}
                  className="resize-none rounded-2xl border-border/60 focus:border-brand-purple-500/50 focus:ring-brand-purple-500/20 bg-card text-sm leading-relaxed"
                />

                {/* Character counter bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r transition-colors',
                        coverPct < 50  ? 'from-muted-foreground/30 to-muted-foreground/50' :
                        coverPct < 80  ? 'from-brand-500 to-brand-purple-500' :
                        coverPct < 100 ? 'from-brand-purple-500 to-brand-purple-600' :
                                         'from-red-500 to-red-400'
                      )}
                      animate={{ width: `${coverPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs font-medium tabular-nums shrink-0',
                    coverPct >= 100 ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {coverLen} / {coverMax}
                  </span>
                </div>

                {/* Writing tips */}
                <div className="rounded-xl bg-brand-purple-500/5 border border-brand-purple-500/15 p-3 mt-3">
                  <p className="text-xs font-semibold text-brand-purple-600 dark:text-brand-400 mb-1.5">Tips for a strong cover letter</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5"><span className="text-brand-500 mt-0.5">·</span> Mention specific skills relevant to this {opportunity.type}</li>
                    <li className="flex items-start gap-1.5"><span className="text-brand-500 mt-0.5">·</span> Share a brief example of similar work you&apos;ve done</li>
                    <li className="flex items-start gap-1.5"><span className="text-brand-500 mt-0.5">·</span> Keep it concise — 150–400 words is ideal</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ── Section 3: Proposed Budget (non-job) ── */}
            {opportunity.type !== 'job' && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
                  <h2 className="text-base font-bold text-foreground">Proposed Budget</h2>
                  <Badge variant="outline" className="ml-auto text-[10px] font-bold uppercase tracking-wider border-border text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4 -mt-2">
                  Enter your proposed fee. Leave blank to discuss directly with the poster.
                </p>

                <div className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      Your Rate ({opportunity.currency})
                    </Label>
                    <Input
                      type="number"
                      placeholder={`e.g. ${opportunity.budgetMin}`}
                      value={proposedBudget}
                      onChange={(e) => setProposedBudget(e.target.value)}
                      className="rounded-xl h-11 border-border/60 focus:border-brand-purple-500/50 focus:ring-brand-purple-500/20 bg-card"
                    />
                  </div>
                  <div className="shrink-0 pt-6">
                    <div className={cn('px-3 py-2 rounded-xl border text-xs font-semibold', accent.bg, accent.border, accent.text)}>
                      Range: {opportunity.budgetMin.toLocaleString()} – {opportunity.budgetMax.toLocaleString()} {opportunity.currency}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Desktop submit row ── */}
            <div className="hidden lg:flex items-center gap-3 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                className="rounded-xl text-muted-foreground hover:text-foreground"
                asChild
                disabled={isSubmitting}
              >
                <Link href={`/opportunities/${opportunityId}`}>Cancel</Link>
              </Button>
              <div className="flex-1" />
              <p className="text-xs text-muted-foreground">
                {isComplete ? 'Your application is ready to submit' : 'Complete all required fields to submit'}
              </p>
              <Button
                className={cn(
                  'rounded-xl px-6 font-bold transition-all',
                  isComplete
                    ? 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
                onClick={handleApply}
                disabled={isSubmitting || !isComplete}
              >
                {isSubmitting ? (
                  <>
                    <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Mobile sticky submit bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl px-4 py-3">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            className="rounded-xl flex-shrink-0"
            asChild
            disabled={isSubmitting}
          >
            <Link href={`/opportunities/${opportunityId}`}>Cancel</Link>
          </Button>
          <Button
            className={cn(
              'flex-1 rounded-xl font-bold transition-all',
              isComplete
                ? 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                : 'bg-muted text-muted-foreground'
            )}
            onClick={handleApply}
            disabled={isSubmitting || !isComplete}
          >
            {isSubmitting ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        </div>
      </div>

    </div>
  )
}
