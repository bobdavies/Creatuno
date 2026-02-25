'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Bookmark01Icon,
  Camera01Icon,
  CheckmarkCircle01Icon,
  DollarCircleIcon,
  FilterIcon,
  Loading02Icon,
  MusicNote01Icon,
  PaintBrushIcon,
  Search01Icon,
  SparklesIcon,
  Video01Icon,
  ViewIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/user-session-provider'
import SpotlightCard from '@/components/SpotlightCard'
import { formatCurrency } from '@/lib/currency'

const ease = [0.23, 1, 0.32, 1] as const

const CATEGORIES = [
  { label: 'All', value: 'all', icon: SparklesIcon },
  { label: 'Design', value: 'Design', icon: PaintBrushIcon },
  { label: 'Film', value: 'Film', icon: Video01Icon },
  { label: 'Photography', value: 'Photography', icon: Camera01Icon },
  { label: 'Music', value: 'Music', icon: MusicNote01Icon },
  { label: 'Tech', value: 'Tech', icon: SparklesIcon },
]

const SORTS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Most Interest', value: 'most-interest' },
  { label: 'Highest Ask', value: 'highest-ask' },
]

interface Pitch {
  id: string
  title: string
  tagline: string | null
  description: string
  category: string | null
  funding_ask: number | null
  currency: string
  cover_image: string | null
  video_url: string | null
  skills: string[]
  status: string
  interest_count: number
  view_count: number
  created_at: string
  sender: { user_id: string; full_name: string; avatar_url: string | null } | null
  creative: { user_id: string; full_name: string; avatar_url: string | null; skills: string[] } | null
  portfolio: { id: string; title: string; slug: string } | null
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function PitchStagePage() {
  const { user } = useUser()
  const { role } = useSession()
  const [pitches, setPitches] = useState<Pitch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const loadPitches = useCallback(async (append = false, cursor?: string) => {
    if (!append) setIsLoading(true)
    else setIsLoadingMore(true)

    try {
      const params = new URLSearchParams({ status: 'live', sort })
      if (category !== 'all') params.set('category', category)
      if (search.trim()) params.set('search', search.trim())
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/pitches?${params}`)
      if (!res.ok) throw new Error()

      const data = await res.json()
      if (append) {
        setPitches(prev => [...prev, ...(data.pitches || [])])
      } else {
        setPitches(data.pitches || [])
      }
      setNextCursor(data.nextCursor || null)
    } catch {
      toast.error('Failed to load pitches')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [category, sort, search])

  useEffect(() => {
    const timeout = setTimeout(() => loadPitches(), 300)
    return () => clearTimeout(timeout)
  }, [loadPitches])

  const handleExpressInterest = async (pitchId: string) => {
    try {
      const res = await fetch(`/api/pitches/${pitchId}/interest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (res.ok) {
        toast.success('Interest expressed! The creator has been notified.')
        setPitches(prev => prev.map(p => p.id === pitchId ? { ...p, interest_count: p.interest_count + 1 } : p))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to express interest')
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const isCreatorOrMentor = role === 'creative' || role === 'mentor'
  const isInvestor = role === 'investor'

  return (
    <div className="min-h-screen pb-28">

      {/* ━━━ HERO ━━━ */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-brand-purple-500/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--brand-purple-rgb,139,92,246),0.08),transparent_70%)]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="text-center"
          >
            <Badge className="mb-4 bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 text-xs font-bold uppercase tracking-wider">
              <HugeiconsIcon icon={SparklesIcon} className="w-3 h-3 mr-1" />
              The Pitch Stage
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Where Creative Vision Meets{' '}
              <span className="bg-gradient-to-r from-brand-500 to-brand-purple-500 bg-clip-text text-transparent">Investment</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
              Discover talented creatives seeking investment. Browse pitches, explore portfolios, and invest in the next generation of creative talent.
            </p>

            {isCreatorOrMentor && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ease }}
                className="mt-6"
              >
                <Button asChild className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark px-6">
                  <Link href="/pitch-stage/create">
                    <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                    Create a Pitch
                  </Link>
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ━━━ FILTERS ━━━ */}
        <motion.div
          className="sticky top-16 z-20 bg-background/80 backdrop-blur-xl -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 border-b border-border/50"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ease }}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search pitches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl bg-muted/50 border-border/50 h-10"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border',
                    category === cat.value
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30'
                      : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50'
                  )}
                >
                  <HugeiconsIcon icon={cat.icon} className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-xs font-medium text-foreground appearance-none cursor-pointer"
            >
              {SORTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* ━━━ PITCH GRID ━━━ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : pitches.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
              <HugeiconsIcon icon={SparklesIcon} className="w-8 h-8 text-brand-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No pitches yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isCreatorOrMentor
                ? 'Be the first to step onto the stage!'
                : 'Check back soon for creative investment opportunities.'
              }
            </p>
            {isCreatorOrMentor && (
              <Button asChild className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark">
                <Link href="/pitch-stage/create">Create Your First Pitch</Link>
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              <AnimatePresence mode="popLayout">
                {pitches.map((pitch, i) => (
                  <PitchCard
                    key={pitch.id}
                    pitch={pitch}
                    index={i}
                    isInvestor={isInvestor}
                    onExpressInterest={handleExpressInterest}
                  />
                ))}
              </AnimatePresence>
            </div>

            {nextCursor && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={() => loadPitches(true, nextCursor)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Load More Pitches
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PitchCard({
  pitch,
  index,
  isInvestor,
  onExpressInterest,
}: {
  pitch: Pitch
  index: number
  isInvestor: boolean
  onExpressInterest: (id: string) => void
}) {
  const isMentorChampioned = pitch.sender?.user_id !== pitch.creative?.user_id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, ease }}
    >
      <SpotlightCard className="h-full" spotlightColor="rgba(var(--brand-purple-rgb, 139, 92, 246), 0.08)">
        <div className="flex flex-col h-full rounded-2xl border border-border/50 bg-card overflow-hidden group">
          {/* Cover */}
          <div className="relative h-40 bg-gradient-to-br from-brand-500/20 via-brand-purple-500/10 to-muted/30 overflow-hidden">
            {pitch.cover_image ? (
              <img
                src={pitch.cover_image}
                alt={pitch.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 text-brand-500/30" />
              </div>
            )}

            {pitch.category && (
              <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm text-foreground border-0 text-[10px] font-bold uppercase">
                {pitch.category}
              </Badge>
            )}

            {pitch.funding_ask && (
              <Badge className="absolute top-3 right-3 bg-brand-500/90 text-brand-dark border-0 text-[10px] font-bold">
                {formatCurrency(pitch.funding_ask, pitch.currency)}
              </Badge>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 p-4 flex flex-col">
            <Link href={`/pitch-stage/${pitch.id}`} className="block">
              <h3 className="font-bold text-foreground text-sm line-clamp-1 group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
                {pitch.title}
              </h3>
              {pitch.tagline && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pitch.tagline}</p>
              )}
            </Link>

            {/* Creator info */}
            <div className="flex items-center gap-2 mt-3">
              <Avatar className="w-6 h-6">
                <AvatarImage src={pitch.creative?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-[10px] font-bold">
                  {pitch.creative?.full_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{pitch.creative?.full_name}</p>
                {isMentorChampioned && (
                  <p className="text-[10px] text-brand-purple-500 dark:text-brand-400 truncate">
                    Championed by {pitch.sender?.full_name}
                  </p>
                )}
              </div>
            </div>

            {/* Skills */}
            {pitch.skills?.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {pitch.skills.slice(0, 3).map(skill => (
                  <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Stats + Actions */}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
                  {pitch.view_count}
                </span>
                <span className="flex items-center gap-1">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />
                  {pitch.interest_count} interested
                </span>
                <span>{timeAgo(pitch.created_at)}</span>
              </div>

              {isInvestor && (
                <button
                  onClick={(e) => { e.preventDefault(); onExpressInterest(pitch.id) }}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                >
                  I&apos;m Interested
                </button>
              )}
            </div>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}
