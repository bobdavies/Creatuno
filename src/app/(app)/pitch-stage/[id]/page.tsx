'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Bookmark01Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading02Icon,
  Location01Icon,
  Message01Icon,
  SentIcon,
  SparklesIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'motion/react'
import { MdAttachMoney } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/user-session-provider'
import { formatCurrency } from '@/lib/currency'

const ease = [0.23, 1, 0.32, 1] as const

interface PitchData {
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
  total_funded: number | null
  created_at: string
  sender_id: string
  creative_id: string
  sender: { user_id: string; full_name: string; avatar_url: string | null; bio: string | null; skills: string[]; role: string } | null
  creative: { user_id: string; full_name: string; avatar_url: string | null; bio: string | null; skills: string[]; location: string | null } | null
  portfolio: { id: string; title: string; slug: string; tagline: string | null; description: string | null } | null
}

interface Interest {
  id: string
  message: string | null
  created_at: string
  investor: { user_id: string; full_name: string; avatar_url: string | null } | null
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {}
  return null
}

export default function PitchDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const { role } = useSession()

  const [pitch, setPitch] = useState<PitchData | null>(null)
  const [interests, setInterests] = useState<Interest[]>([])
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showInterestDialog, setShowInterestDialog] = useState(false)
  const [interestMessage, setInterestMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Funding state
  const [showFundDialog, setShowFundDialog] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [isFunding, setIsFunding] = useState(false)

  useEffect(() => {
    loadPitch()
  }, [id])

  const loadPitch = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/pitches/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPitch(data.pitch)
      setHasExpressedInterest(data.hasExpressedInterest || false)
      setInterests(data.interests || [])
    } catch {
      toast.error('Failed to load pitch')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExpressInterest = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/pitches/${id}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: interestMessage.trim() || null }),
      })
      if (res.ok) {
        toast.success('Interest expressed! The creator has been notified.')
        setHasExpressedInterest(true)
        setShowInterestDialog(false)
        setPitch(prev => prev ? { ...prev, interest_count: prev.interest_count + 1 } : prev)
        loadPitch()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to express interest')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawInterest = async () => {
    try {
      const res = await fetch(`/api/pitches/${id}/interest`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Interest withdrawn')
        setHasExpressedInterest(false)
        setPitch(prev => prev ? { ...prev, interest_count: Math.max(0, prev.interest_count - 1) } : prev)
        loadPitch()
      }
    } catch {
      toast.error('Failed to withdraw interest')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/pitches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Pitch ${newStatus === 'funded' ? 'marked as funded' : newStatus === 'closed' ? 'closed' : 'updated'}!`)
        loadPitch()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update pitch')
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this pitch?')) return
    try {
      const res = await fetch(`/api/pitches/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Pitch deleted')
        router.push('/pitch-stage/my-pitches')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete pitch')
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleFundPitch = async () => {
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    setIsFunding(true)
    try {
      const res = await fetch('/api/payments/pitch-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch_id: id, amount }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to initiate funding')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsFunding(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (!pitch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-bold text-foreground">Pitch not found</h2>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/pitch-stage">Browse Pitches</Link>
        </Button>
      </div>
    )
  }

  const isSender = user?.id === pitch.sender_id
  const isCreative = user?.id === pitch.creative_id
  const isOwner = isSender || isCreative
  const isInvestor = role === 'investor'
  const isMentorChampioned = pitch.sender_id !== pitch.creative_id
  const embedUrl = pitch.video_url ? getEmbedUrl(pitch.video_url) : null

  return (
    <div className="min-h-screen pb-28">
      {/* Hero */}
      <div className="relative">
        <div className="h-64 sm:h-80 bg-gradient-to-br from-brand-500/20 via-brand-purple-500/10 to-muted/30 relative overflow-hidden">
          {pitch.cover_image ? (
            <img src={pitch.cover_image} alt={pitch.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <HugeiconsIcon icon={SparklesIcon} className="w-16 h-16 text-brand-500/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        {/* Back nav */}
        <div className="absolute top-4 left-4 sm:left-6">
          <Link
            href="/pitch-stage"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs text-foreground hover:bg-background transition-all"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>

        {/* Status badge */}
        <div className="absolute top-4 right-4 sm:right-6">
          <Badge className={cn(
            'text-[10px] font-bold uppercase border-0',
            pitch.status === 'live' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
            pitch.status === 'funded' ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' :
            pitch.status === 'draft' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
            'bg-muted text-muted-foreground'
          )}>
            {pitch.status}
          </Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
              {pitch.category && (
                <Badge className="mb-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20 text-[10px] font-bold uppercase">
                  {pitch.category}
                </Badge>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{pitch.title}</h1>
              {pitch.tagline && (
                <p className="text-muted-foreground mt-1">{pitch.tagline}</p>
              )}
            </motion.div>

            {/* Video embed */}
            {embedUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ease }}
                className="rounded-2xl overflow-hidden border border-border/50 aspect-video"
              >
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </motion.div>
            )}

            {/* Pitch narrative */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">The Pitch</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {pitch.description.split('\n').map((para, i) => (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed">{para}</p>
                ))}
              </div>
            </motion.div>

            {/* Portfolio preview */}
            {pitch.portfolio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ease }}
              >
                <Link
                  href={`/portfolio/${pitch.creative?.user_id}/${pitch.portfolio.slug}`}
                  className="block rounded-2xl border border-border/50 bg-card p-5 hover:border-brand-500/30 transition-all group"
                >
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Showcase Portfolio</h3>
                  <p className="text-sm font-semibold text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
                    {pitch.portfolio.title}
                  </p>
                  {pitch.portfolio.tagline && (
                    <p className="text-xs text-muted-foreground mt-1">{pitch.portfolio.tagline}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-brand-500 mt-3 font-medium">
                    View full portfolio
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3 h-3 rotate-180" />
                  </span>
                </Link>
              </motion.div>
            )}

            {/* Interests (visible to owner) */}
            {isOwner && interests.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ease }}
                className="rounded-2xl border border-border/50 bg-card p-6"
              >
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                  Interested Investors ({interests.length})
                </h2>
                <div className="space-y-3">
                  {interests.map(interest => (
                    <div key={interest.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={interest.investor?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                          {interest.investor?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{interest.investor?.full_name}</p>
                          <span className="text-[10px] text-muted-foreground">{formatDate(interest.created_at)}</span>
                        </div>
                        {interest.message && (
                          <p className="text-xs text-muted-foreground mt-1">{interest.message}</p>
                        )}
                        <Link
                          href={`/messages?compose=true&to=${interest.investor?.user_id}&name=${encodeURIComponent(interest.investor?.full_name || '')}`}
                          className="inline-flex items-center gap-1 text-[10px] text-brand-500 font-medium mt-2"
                        >
                          <HugeiconsIcon icon={Message01Icon} className="w-3 h-3" />
                          Message
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, ease }}
              className="rounded-2xl border border-border/50 bg-card p-5"
            >
              {pitch.funding_ask && (
                <div className="mb-4 pb-4 border-b border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Funding Ask</p>
                  <p className="text-xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                    {formatCurrency(pitch.funding_ask, pitch.currency)}
                  </p>
                  {(pitch.total_funded ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Funded</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(pitch.total_funded ?? 0, pitch.currency)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-purple-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, ((pitch.total_funded ?? 0) / pitch.funding_ask) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {Math.round(((pitch.total_funded ?? 0) / pitch.funding_ask) * 100)}% funded
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Interested</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{pitch.interest_count}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Views</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{pitch.view_count}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/30 flex items-center gap-2 text-[10px] text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                Published {formatDate(pitch.created_at)}
              </div>

              {pitch.skills?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {pitch.skills.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Creator card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, ease }}
              className="rounded-2xl border border-border/50 bg-card p-5"
            >
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-3">Creative</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 ring-2 ring-brand-500/20">
                  <AvatarImage src={pitch.creative?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-sm font-bold">
                    {pitch.creative?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{pitch.creative?.full_name}</p>
                  {pitch.creative?.location && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={Location01Icon} className="w-3 h-3" />
                      {pitch.creative.location}
                    </p>
                  )}
                </div>
              </div>
              {pitch.creative?.bio && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{pitch.creative.bio}</p>
              )}
            </motion.div>

            {/* Mentor card (if championed) */}
            {isMentorChampioned && pitch.sender && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, ease }}
                className="rounded-2xl border border-brand-purple-500/20 bg-brand-purple-500/5 p-5"
              >
                <p className="text-[10px] text-brand-purple-600 dark:text-brand-400 uppercase font-bold tracking-wider mb-3">
                  Championed By
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 ring-2 ring-brand-purple-500/20">
                    <AvatarImage src={pitch.sender?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                      {pitch.sender?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{pitch.sender?.full_name}</p>
                    <Badge className="bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/20 text-[9px]">
                      Mentor
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, ease }}
              className="space-y-2"
            >
              {isInvestor && pitch.status === 'live' && (
                <>
                  <Button
                    className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      setFundAmount(pitch.funding_ask ? String(pitch.funding_ask) : '')
                      setShowFundDialog(true)
                    }}
                  >
                    <MdAttachMoney className="w-4 h-4 mr-2" />
                    Fund This Pitch
                  </Button>

                  {hasExpressedInterest ? (
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 text-center">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-6 h-6 text-brand-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-foreground">You&apos;ve expressed interest</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">The creator has been notified</p>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl text-xs"
                        onClick={handleWithdrawInterest}
                      >
                        Withdraw Interest
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-brand-dark"
                      onClick={() => setShowInterestDialog(true)}
                    >
                      <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-2" />
                      I&apos;m Interested
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-xs"
                    asChild
                  >
                    <Link href={`/messages?compose=true&to=${pitch.creative?.user_id}&name=${encodeURIComponent(pitch.creative?.full_name || '')}`}>
                      <HugeiconsIcon icon={Message01Icon} className="w-4 h-4 mr-2" />
                      Message Creator
                    </Link>
                  </Button>
                </>
              )}

              {isOwner && (
                <>
                  {pitch.status === 'draft' && (
                    <Button
                      className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-brand-dark"
                      onClick={() => handleStatusChange('live')}
                    >
                      <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-2" />
                      Publish to Pitch Stage
                    </Button>
                  )}

                  {pitch.status === 'live' && (
                    <>
                      <Button
                        className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleStatusChange('funded')}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 mr-2" />
                        Mark as Funded
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl text-xs"
                        onClick={() => handleStatusChange('closed')}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 mr-2" />
                        Close Pitch
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-xs"
                    asChild
                  >
                    <Link href={`/pitch-stage/create?edit=${pitch.id}`}>
                      <HugeiconsIcon icon={Edit02Icon} className="w-4 h-4 mr-2" />
                      Edit Pitch
                    </Link>
                  </Button>

                  {['draft', 'closed'].includes(pitch.status) && (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl text-xs text-red-500 hover:text-red-600 hover:border-red-500/30"
                      onClick={handleDelete}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4 mr-2" />
                      Delete Pitch
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Interest Dialog */}
      <Dialog open={showInterestDialog} onOpenChange={setShowInterestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Express Interest</DialogTitle>
            <DialogDescription>
              Let {pitch.creative?.full_name} know you&apos;re interested in investing. You can include an optional message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
              <p className="text-sm font-semibold text-foreground">{pitch.title}</p>
              {pitch.funding_ask && (
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  Asking: {formatCurrency(pitch.funding_ask, pitch.currency)}
                </p>
              )}
            </div>

            <div>
              <Textarea
                placeholder="Optional: Tell the creator why you're interested, what excites you about their work..."
                value={interestMessage}
                onChange={(e) => setInterestMessage(e.target.value)}
                className="rounded-xl min-h-[100px] resize-none"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{interestMessage.length}/500</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowInterestDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-brand-500 hover:bg-brand-600 text-brand-dark"
                onClick={handleExpressInterest}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                )}
                Express Interest
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fund Pitch Dialog */}
      <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fund This Pitch</DialogTitle>
            <DialogDescription>
              Support {pitch.creative?.full_name}&apos;s work by funding their pitch. You&apos;ll be redirected to complete payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
              <p className="text-sm font-semibold text-foreground">{pitch.title}</p>
              {pitch.funding_ask && (
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  Asking: {formatCurrency(pitch.funding_ask, pitch.currency)}
                </p>
              )}
              {(pitch.total_funded ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Already funded: {formatCurrency(pitch.total_funded ?? 0, pitch.currency)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Amount ({pitch.currency || 'SLE'})</label>
              <Input
                type="number"
                placeholder="Enter amount to fund"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="rounded-xl mt-1.5"
                min={1}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                A 5% platform fee will be applied. The recipient receives {fundAmount ? formatCurrency(parseFloat(fundAmount) * 0.95, pitch.currency) : '...'}.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowFundDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                onClick={handleFundPitch}
                disabled={isFunding || !fundAmount || parseFloat(fundAmount) <= 0}
              >
                {isFunding ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MdAttachMoney className="w-4 h-4 mr-2" />
                )}
                Fund Pitch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
