'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Cancel01Icon, CheckmarkCircle01Icon, Loading02Icon, Location01Icon, Search01Icon, SentIcon, SparklesIcon, UserAdd01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import SpotlightCard from '@/components/SpotlightCard'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creative {
  user_id: string
  fullName: string
  avatarUrl: string | null
  bio: string
  skills: string[]
  location: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8

const specialtyFilters = [
  'All Specialties',
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Branding', 'Illustration', 'Motion Graphics',
  'Social Media', 'Content Strategy', 'Freelancing', 'Business Development',
]

const ease = [0.23, 1, 0.32, 1] as const

const avatarGradients = [
  'from-brand-purple-500 to-brand-purple-600',
  'from-brand-500 to-brand-purple-600',
  'from-brand-purple-500 to-brand-purple-600',
  'from-brand-500 to-brand-purple-500',
  'from-brand-500 to-brand-purple-600',
  'from-brand-purple-500 to-brand-500',
]

function getGradient(index: number) {
  return avatarGradients[index % avatarGradients.length]
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ScoutTalentsPage() {
  const router = useRouter()
  const { role, isLoading: sessionLoading } = useSession()
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSpecialty, setActiveSpecialty] = useState('All Specialties')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  // Offer dialog state
  const [offerTarget, setOfferTarget] = useState<Creative | null>(null)
  const [offerMessage, setOfferMessage] = useState('')
  const [isSendingOffer, setIsSendingOffer] = useState(false)
  const [sentOffers, setSentOffers] = useState<Set<string>>(new Set())

  // ── Role guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionLoading && role !== 'mentor') {
      toast.error('This page is for mentors only')
      router.push('/mentorship')
    }
  }, [sessionLoading, role, router])

  // ── Data Loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    loadCreatives()
    loadSentOffers()
  }, [])

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [searchQuery, activeSpecialty])

  const loadCreatives = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/profiles/creatives')
      if (response.ok) {
        const data = await response.json()
        setCreatives(data.creatives || [])
      }
    } catch (error) {
      console.error('Error loading creatives:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSentOffers = async () => {
    try {
      const response = await fetch('/api/mentorship/offers?role=mentor')
      if (response.ok) {
        const data = await response.json()
        const ids = new Set<string>((data.offers || []).map((o: { mentee_id: string }) => o.mentee_id))
        setSentOffers(ids)
      }
    } catch {
      // ignore
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSendOffer = async () => {
    if (!offerTarget || !offerMessage.trim()) {
      toast.error('Please write a message for the creative')
      return
    }

    setIsSendingOffer(true)
    try {
      const response = await fetch('/api/mentorship/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creative_id: offerTarget.user_id,
          message: offerMessage.trim(),
        }),
      })

      if (response.ok) {
        toast.success(`Mentorship offer sent to ${offerTarget.fullName}!`)
        setSentOffers(prev => new Set(prev).add(offerTarget.user_id))
        setOfferTarget(null)
        setOfferMessage('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to send offer')
      }
    } catch {
      toast.error('Failed to send offer')
    } finally {
      setIsSendingOffer(false)
    }
  }

  // ── Derived Data ───────────────────────────────────────────────────────────

  const filteredCreatives = useMemo(() => {
    return creatives.filter(c => {
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.skills?.some(s => s.toLowerCase().includes(q))

      const matchesSpecialty = activeSpecialty === 'All Specialties' ||
        c.skills?.some(s => s.toLowerCase() === activeSpecialty.toLowerCase())

      return matchesSearch && matchesSpecialty
    })
  }, [creatives, searchQuery, activeSpecialty])

  const visibleCreatives = filteredCreatives.slice(0, visibleCount)
  const hasMore = visibleCount < filteredCreatives.length

  // ── Guard render ───────────────────────────────────────────────────────────

  if (sessionLoading || role !== 'mentor') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ━━━ Hero Section ━━━ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-brand-500/8 blur-[100px]" />
          <div className="absolute top-1/3 -left-16 w-[300px] h-[300px] rounded-full bg-brand-purple-500/5 blur-[80px]" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 border border-brand-purple-500/20 dark:border-brand-500/20 mb-4">
              <HugeiconsIcon icon={SparklesIcon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
              <span className="text-xs font-medium text-brand-purple-600 dark:text-brand-400">Mentor Talent Scouting</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Scout Creative{' '}
              <span className="text-brand-dark dark:text-foreground">
                Talents
              </span>
            </h1>
            <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg">
              Discover emerging creative professionals and offer them your mentorship.
              Help shape the next generation of talent.
            </p>
          </motion.div>

          {/* Search + Filter */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease }}
            className="mt-6"
          >
            <div className="relative max-w-2xl">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, skill, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 rounded-xl bg-card/60 backdrop-blur-sm border-border/60 text-sm focus-visible:ring-brand-purple-500/30 dark:ring-brand-500/30"
              />
            </div>

            {/* Specialty Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mt-4 scrollbar-none -mx-1 px-1">
              {specialtyFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveSpecialty(filter)}
                  className={cn(
                    'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border whitespace-nowrap',
                    activeSpecialty === filter
                      ? 'bg-brand-500 text-brand-dark border-brand-500'
                      : 'bg-card/50 text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ━━━ Content ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-20">
        {/* Stats strip */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 text-sm text-muted-foreground mb-6 mt-2"
          >
            <span>
              Showing <span className="text-foreground font-medium">{Math.min(visibleCount, filteredCreatives.length)}</span> of{' '}
              <span className="text-foreground font-medium">{filteredCreatives.length}</span> creatives
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <span>
              <span className="text-brand-purple-600 dark:text-brand-400 font-medium">{sentOffers.size}</span> offers sent
            </span>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
            <p className="text-sm text-muted-foreground">Discovering creative talents...</p>
          </div>
        ) : filteredCreatives.length > 0 ? (
          <>
            {/* Creative Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {visibleCreatives.map((creative, index) => (
                <motion.div
                  key={creative.user_id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: index * 0.06, ease }}
                >
                  <CreativeCard
                    creative={creative}
                    index={index}
                    hasSentOffer={sentOffers.has(creative.user_id)}
                    onOfferMentorship={() => {
                      setOfferTarget(creative)
                      setOfferMessage('')
                    }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center gap-2 mt-10"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 gap-2 border-border/60 hover:border-brand-purple-500/30 dark:border-brand-500/30"
                  onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                >
                  Load More Creatives
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  Showing {Math.min(visibleCount, filteredCreatives.length)} of {filteredCreatives.length} creatives
                </p>
              </motion.div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={Search01Icon} className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No creatives found</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {searchQuery || activeSpecialty !== 'All Specialties'
                ? 'Try adjusting your search or filter.'
                : 'No creative professionals have joined yet.'}
            </p>
            {(searchQuery || activeSpecialty !== 'All Specialties') && (
              <Button
                variant="outline"
                className="mt-4 rounded-full"
                onClick={() => { setSearchQuery(''); setActiveSpecialty('All Specialties') }}
              >
                Clear Filters
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* ━━━ Offer Mentorship Dialog ━━━ */}
      <Dialog open={!!offerTarget} onOpenChange={(open) => { if (!open) setOfferTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Offer Mentorship</DialogTitle>
            <DialogDescription>
              Send a mentorship offer to {offerTarget?.fullName}
            </DialogDescription>
          </DialogHeader>

          {offerTarget && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 mt-2"
            >
              {/* Creative Preview */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-purple-500/5 dark:bg-brand-500/5 border border-brand-500/15">
                <Avatar className="w-12 h-12 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20">
                  <AvatarImage src={offerTarget.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">
                    {offerTarget.fullName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{offerTarget.fullName}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {offerTarget.skills?.slice(0, 2).join(' · ') || 'Creative Professional'}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Your Message <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Introduce yourself and explain why you'd like to mentor this creative..."
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  rows={5}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  The creative will see this message and can accept or decline your offer.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setOfferTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark"
                  onClick={handleSendOffer}
                  disabled={isSendingOffer || !offerMessage.trim()}
                >
                  {isSendingOffer ? (
                    <>
                      <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                      Send Offer
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Creative Card ───────────────────────────────────────────────────────────

function CreativeCard({
  creative,
  index,
  hasSentOffer,
  onOfferMentorship,
}: {
  creative: Creative
  index: number
  hasSentOffer: boolean
  onOfferMentorship: () => void
}) {
  const gradient = getGradient(index)

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="group relative"
    >
      <SpotlightCard className="overflow-hidden hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300">
      {/* Avatar Section */}
      <div className={cn('relative aspect-square bg-gradient-to-br', gradient)}>
        {creative.avatarUrl && (
          <img
            src={creative.avatarUrl}
            alt={creative.fullName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Role badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-brand-purple-500/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
          Creative
        </div>

        {/* Sent indicator */}
        {hasSentOffer && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-[10px] font-bold shadow-lg">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />
            Offer Sent
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-foreground text-base leading-tight truncate">
          {creative.fullName}
        </h3>
        {creative.skills?.length > 0 && (
          <p className="text-brand-purple-600 dark:text-brand-400 font-semibold text-[11px] uppercase tracking-wider mt-0.5 truncate">
            {creative.skills[0]}
          </p>
        )}

        {creative.location && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Location01Icon} className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{creative.location}</span>
          </div>
        )}

        {/* Skills */}
        {creative.skills?.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {creative.skills.slice(0, 3).map(s => (
              <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                {s}
              </Badge>
            ))}
            {creative.skills.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                +{creative.skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 space-y-2">
          <Button
            size="sm"
            className={cn(
              'w-full rounded-lg text-white',
              hasSentOffer
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-brand-500 hover:bg-brand-600'
            )}
            disabled={hasSentOffer}
            onClick={onOfferMentorship}
          >
            {hasSentOffer ? (
              <>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5 mr-1.5" />
                Offer Sent
              </>
            ) : (
              <>
                <HugeiconsIcon icon={UserAdd01Icon} className="w-3.5 h-3.5 mr-1.5" />
                Offer Mentorship
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-lg border-border/60"
            asChild
          >
            <Link href={`/portfolio/user/${creative.user_id}`}>
              <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5 mr-1.5" />
              View Portfolio
            </Link>
          </Button>
        </div>
      </div>
      </SpotlightCard>
    </motion.div>
  )
}
