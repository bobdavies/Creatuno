'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, FileAttachmentIcon, Loading02Icon, SentIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { userId: sessionUserId, role } = useSession()
  const opportunityId = params.id as string

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [isLoadingOpp, setIsLoadingOpp] = useState(true)

  const [portfolios, setPortfolios] = useState<ServerPortfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [proposedBudget, setProposedBudget] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAuthenticated = isLoaded && !!user

  // Redirect away if not a creative or not authenticated once auth is resolved
  useEffect(() => {
    if (isLoaded && (!user || role === 'business')) {
      router.replace(`/opportunities/${opportunityId}`)
    }
  }, [isLoaded, user, role, opportunityId, router])

  useEffect(() => {
    loadOpportunity()
  }, [opportunityId])

  useEffect(() => {
    if (sessionUserId) {
      loadPortfolios()
      checkAlreadyApplied()
    }
  }, [opportunityId, sessionUserId])

  const loadOpportunity = async () => {
    setIsLoadingOpp(true)
    try {
      const response = await fetch(`/api/opportunities?id=${opportunityId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.opportunity) setOpportunity(data.opportunity)
      }
    } catch (error) {
      console.error('Error loading opportunity:', error)
    } finally {
      setIsLoadingOpp(false)
    }
  }

  const loadPortfolios = async () => {
    try {
      const response = await fetch('/api/portfolios')
      if (response.ok) {
        const data = await response.json()
        const serverPortfolios: ServerPortfolio[] = data.portfolios || []
        setPortfolios(serverPortfolios)
        if (serverPortfolios.length > 0) setSelectedPortfolio(serverPortfolios[0].id)
      }
    } catch (error) {
      console.error('Error loading portfolios:', error)
    }
  }

  const checkAlreadyApplied = async () => {
    try {
      const response = await fetch(`/api/applications?opportunity_id=${opportunityId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.applications && data.applications.length > 0) {
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
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          portfolio_id: selectedPortfolio,
          cover_letter: coverLetter.trim(),
          proposed_budget: proposedBudget ? parseFloat(proposedBudget) : null,
        }),
      })
      if (response.ok) {
        toast.success('Application submitted successfully!')
        router.push(`/opportunities/${opportunityId}`)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to submit application')
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      toast.error('Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoadingOpp || !isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400 mb-3" />
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8"
        >
          <Button variant="ghost" size="sm" className="rounded-full -ml-2 text-muted-foreground hover:text-foreground" asChild>
            <Link href={`/opportunities/${opportunityId}`}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1.5" />
              Back to opportunity
            </Link>
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.05 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={SparklesIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Submit your application</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {opportunity.companyName ?? opportunity.author.fullName}
              </p>
            </div>
          </div>
          <div className="pl-14">
            <p className="text-base font-semibold text-foreground">{opportunity.title}</p>
          </div>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
          className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-6"
        >
          {/* Portfolio Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Select Portfolio <span className="text-red-500">*</span>
            </Label>
            {portfolios.length > 0 ? (
              <div className="space-y-2">
                {portfolios.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPortfolio(p.id)}
                    className={cn(
                      'w-full text-left p-3.5 rounded-xl border-2 transition-all',
                      selectedPortfolio === p.id
                        ? 'border-brand-500 bg-brand-purple-500/5 dark:bg-brand-500/5'
                        : 'border-border/50 hover:border-brand-purple-500/30 dark:hover:border-brand-500/30'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">{p.title || 'Untitled Portfolio'}</p>
                    {p.tagline && <p className="text-xs text-muted-foreground mt-0.5">{p.tagline}</p>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-muted/50 border border-dashed border-border text-center">
                <HugeiconsIcon icon={FileAttachmentIcon} className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">You don&apos;t have any portfolios yet</p>
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href="/dashboard/portfolios/new">Create a Portfolio</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Cover Letter */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Cover Letter <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Tell them why you're the perfect fit for this opportunity..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={7}
              className="resize-none focus:ring-brand-purple-500/30 dark:ring-brand-500/30"
            />
            <p className="text-xs text-muted-foreground">Explain your relevant experience and why you're interested</p>
          </div>

          {/* Proposed Budget */}
          {opportunity.type !== 'job' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Proposed Budget ({opportunity.currency})
              </Label>
              <Input
                type="number"
                placeholder={`e.g. ${opportunity.budgetMin}`}
                value={proposedBudget}
                onChange={(e) => setProposedBudget(e.target.value)}
                className="focus:ring-brand-purple-500/30 dark:ring-brand-500/30"
              />
              <p className="text-xs text-muted-foreground">
                Budget range: {opportunity.budgetMin} – {opportunity.budgetMax} {opportunity.currency}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              asChild
              disabled={isSubmitting}
            >
              <Link href={`/opportunities/${opportunityId}`}>Cancel</Link>
            </Button>
            <Button
              className="flex-1 bg-brand-500 hover:bg-brand-600 rounded-xl font-bold"
              onClick={handleApply}
              disabled={isSubmitting || !selectedPortfolio || !coverLetter.trim()}
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
  )
}
