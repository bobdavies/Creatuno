'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading02Icon,
  SparklesIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/user-session-provider'

const ease = [0.23, 1, 0.32, 1] as const

interface Pitch {
  id: string
  title: string
  tagline: string | null
  category: string | null
  funding_ask: number | null
  currency: string
  status: string
  interest_count: number
  view_count: number
  created_at: string
  creative: { full_name: string; avatar_url: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  live: { label: 'Live', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  funded: { label: 'Funded', className: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border/50' },
}

function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export default function MyPitchesPage() {
  const router = useRouter()
  const { role } = useSession()
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (role && !['creative', 'mentor'].includes(role)) {
      toast.error('Only creatives and mentors can manage pitches')
      router.push('/pitch-stage')
      return
    }
    loadPitches()
  }, [role])

  const loadPitches = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/pitches?mine=true')
      if (res.ok) {
        const data = await res.json()
        setPitches(data.pitches || [])
      }
    } catch {
      toast.error('Failed to load pitches')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pitch?')) return
    try {
      const res = await fetch(`/api/pitches/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Pitch deleted')
        setPitches(prev => prev.filter(p => p.id !== id))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/pitches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'live' }),
      })
      if (res.ok) {
        toast.success('Pitch published!')
        loadPitches()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to publish')
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleClose = async (id: string) => {
    try {
      const res = await fetch(`/api/pitches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      if (res.ok) {
        toast.success('Pitch closed')
        loadPitches()
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const filteredPitches = filter === 'all' ? pitches : pitches.filter(p => p.status === filter)

  return (
    <div className="min-h-screen pb-28">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-brand-purple-500/10 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <Link
            href="/pitch-stage"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-all mb-6"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
            Back to Pitch Stage
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Pitches</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage and track your pitches on The Pitch Stage</p>
            </div>
            <Button asChild className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark">
              <Link href="/pitch-stage/create">
                <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                New Pitch
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {['all', 'draft', 'live', 'funded', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-medium transition-all border capitalize',
                filter === f
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30'
                  : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50'
              )}
            >
              {f} {f !== 'all' && `(${pitches.filter(p => p.status === f).length})`}
              {f === 'all' && ` (${pitches.length})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : filteredPitches.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <HugeiconsIcon icon={SparklesIcon} className="w-8 h-8 text-brand-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {filter === 'all' ? 'No pitches yet' : `No ${filter} pitches`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first pitch to appear on The Pitch Stage</p>
            <Button asChild className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark">
              <Link href="/pitch-stage/create">Create Your First Pitch</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPitches.map((pitch, i) => (
              <motion.div
                key={pitch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease }}
                className="rounded-2xl border border-border/50 bg-card p-4 hover:border-brand-500/20 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={cn('text-[9px] font-bold uppercase border', STATUS_CONFIG[pitch.status]?.className)}>
                        {STATUS_CONFIG[pitch.status]?.label}
                      </Badge>
                      {pitch.category && (
                        <span className="text-[10px] text-muted-foreground">{pitch.category}</span>
                      )}
                    </div>

                    <Link href={`/pitch-stage/${pitch.id}`} className="block">
                      <h3 className="text-sm font-bold text-foreground hover:text-brand-purple-600 dark:hover:text-brand-400 transition-colors truncate">
                        {pitch.title}
                      </h3>
                    </Link>

                    {role === 'mentor' && pitch.creative && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Championing: {pitch.creative.full_name}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
                        {pitch.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />
                        {pitch.interest_count} interested
                      </span>
                      {pitch.funding_ask && (
                        <span className="font-medium text-brand-600 dark:text-brand-400">
                          {formatCurrency(pitch.funding_ask, pitch.currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {pitch.status === 'draft' && (
                      <Button
                        size="sm"
                        className="rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark text-[10px] h-7 px-3"
                        onClick={() => handlePublish(pitch.id)}
                      >
                        Publish
                      </Button>
                    )}

                    {pitch.status === 'live' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-[10px] h-7 px-3"
                        onClick={() => handleClose(pitch.id)}
                      >
                        Close
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-[10px] h-7 w-7 p-0"
                      asChild
                    >
                      <Link href={`/pitch-stage/${pitch.id}`}>
                        <HugeiconsIcon icon={Edit02Icon} className="w-3.5 h-3.5" />
                      </Link>
                    </Button>

                    {['draft', 'closed'].includes(pitch.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-[10px] h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(pitch.id)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
