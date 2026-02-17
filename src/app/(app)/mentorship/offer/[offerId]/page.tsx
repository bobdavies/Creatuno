'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Cancel01Icon, CheckmarkCircle01Icon, Clock01Icon, Loading02Icon, Location01Icon, Message01Icon, QuoteUpIcon, Shield01Icon, SparklesIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────

interface MentorProfile {
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  skills: string[] | null
  location: string | null
  mentor_expertise: string[] | null
  is_available_for_mentorship: boolean
  max_mentees: number
}

interface Offer {
  id: string
  mentor_id: string
  mentee_id: string
  message: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  mentor: MentorProfile
}

// ─── Animation variants ──────────────────────────────────────────────────

const ease = [0.25, 0.1, 0.25, 1] as const

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, ease },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease },
  },
}

// ─── Helper ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function OfferDetailPage() {
  const params = useParams()
  const router = useRouter()
  const offerId = params.offerId as string

  const [offer, setOffer] = useState<Offer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isResponding, setIsResponding] = useState(false)
  const [respondedStatus, setRespondedStatus] = useState<'accepted' | 'declined' | null>(null)

  useEffect(() => {
    if (offerId) loadOffer()
  }, [offerId])

  const loadOffer = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/mentorship/offers?id=${offerId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.offer) {
          setOffer(data.offer)
          if (data.offer.status !== 'pending') {
            setRespondedStatus(data.offer.status)
          }
        }
      } else {
        toast.error('Offer not found')
        router.push('/mentorship')
      }
    } catch {
      toast.error('Failed to load offer')
      router.push('/mentorship')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRespond = async (status: 'accepted' | 'declined') => {
    if (!offer) return
    setIsResponding(true)
    try {
      const res = await fetch('/api/mentorship/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.id, status }),
      })
      if (res.ok) {
        setRespondedStatus(status)
        if (status === 'accepted') {
          toast.success('Mentorship offer accepted! Redirecting to chat...')
          setTimeout(() => {
            router.push(`/messages/chat/${offer.mentor_id}`)
          }, 1500)
        } else {
          toast.success('Offer declined.')
          setTimeout(() => {
            router.push('/mentorship')
          }, 1200)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to respond')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsResponding(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-500" />
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-muted-foreground">Offer not found.</p>
        <Button variant="outline" asChild>
          <Link href="/mentorship">Back to Mentorship</Link>
        </Button>
      </div>
    )
  }

  const mentor = offer.mentor
  const initials = mentor.full_name?.split(' ').map(n => n[0]).join('') || '?'
  const expertise = mentor.mentor_expertise || []
  const skills = mentor.skills || []
  const isPending = offer.status === 'pending' && !respondedStatus

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="pb-24 md:pb-8">
      {/* Background gradient */}
      <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-purple-500/8 via-brand-purple-500/3 to-transparent pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-6"
      >
        {/* Back button */}
        <motion.div variants={itemVariants} className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => router.back()}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
            Back
          </Button>
        </motion.div>

        {/* ── Offer Status Badge (for already responded) ── */}
        <AnimatePresence>
          {respondedStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className={cn(
                'flex items-center gap-3 px-5 py-4 rounded-2xl border',
                respondedStatus === 'accepted'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              )}>
                {respondedStatus === 'accepted' ? (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div>
                  <p className={cn(
                    'font-semibold text-sm',
                    respondedStatus === 'accepted' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {respondedStatus === 'accepted' ? 'Offer Accepted' : 'Offer Declined'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {respondedStatus === 'accepted'
                      ? 'You are now connected with this mentor. Redirecting to chat...'
                      : 'This offer has been declined.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mentor Hero Section ── */}
        <motion.div variants={scaleIn} className="relative">
          <SpotlightCard className="overflow-hidden">
          {/* Purple gradient banner */}
          <div className="h-28 sm:h-32 bg-gradient-to-r from-brand-purple-600 via-brand-purple-500 to-brand-purple-400 relative">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_50%,white_1px,transparent_1px)] bg-[length:20px_20px]" />
            {/* Floating label */}
            <div className="absolute top-4 left-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <HugeiconsIcon icon={SparklesIcon} className="w-3 h-3 text-white" />
                <span className="text-[11px] font-semibold text-white uppercase tracking-wider">
                  Mentorship Offer
                </span>
              </div>
            </div>
            {/* Date */}
            <div className="absolute top-4 right-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3 text-white" />
                <span className="text-[11px] font-medium text-white">
                  {formatDate(offer.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Avatar + info */}
          <div className="px-5 sm:px-6 pb-6">
            <div className="relative -mt-12 mb-4">
              <Avatar className="w-24 h-24 ring-4 ring-card shadow-xl">
                <AvatarImage src={mentor.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-brand-purple-500 to-brand-purple-600 text-white font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {mentor.full_name || 'Mentor'}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {mentor.location && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={Location01Icon} className="w-3.5 h-3.5" />
                  {mentor.location}
                </span>
              )}
              {mentor.is_available_for_mentorship && (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Accepting Mentees
                </Badge>
              )}
            </div>

            {mentor.bio && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {mentor.bio}
              </p>
            )}
          </div>
          </SpotlightCard>
        </motion.div>

        {/* ── Expertise Areas ── */}
        {expertise.length > 0 && (
          <motion.div variants={itemVariants} className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon icon={Shield01Icon} className="w-4 h-4 text-brand-purple-500" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Expertise Areas
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {expertise.map((area) => (
                <motion.div
                  key={area}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Badge
                    variant="outline"
                    className="text-sm py-1.5 px-4 bg-brand-purple-500/5 text-brand-purple-600 dark:text-brand-purple-400 border-brand-purple-500/20 hover:bg-brand-purple-500/10 transition-colors"
                  >
                    {area}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Skills ── */}
        {skills.length > 0 && (
          <motion.div variants={itemVariants} className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon icon={UserGroupIcon} className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Skills
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Mentor&apos;s Message ── */}
        <motion.div variants={itemVariants} className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <HugeiconsIcon icon={QuoteUpIcon} className="w-4 h-4 text-brand-purple-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Message from Mentor
            </h2>
          </div>
          <div className="relative rounded-2xl bg-brand-purple-500/5 border border-brand-purple-500/15 px-6 py-5">
            {/* Decorative quote */}
            <div className="absolute top-3 right-4 text-brand-purple-500/10">
              <HugeiconsIcon icon={QuoteUpIcon} className="w-10 h-10" />
            </div>
            <p className="text-foreground leading-relaxed relative z-10">
              {offer.message}
            </p>
            <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-brand-purple-500/10">
              <Avatar className="w-6 h-6">
                <AvatarImage src={mentor.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-brand-purple-500 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {mentor.full_name || 'Mentor'} &middot; {formatDate(offer.created_at)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Action Buttons ── */}
        <motion.div variants={itemVariants} className="mt-8">
          {isPending ? (
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6">
              <p className="text-sm text-muted-foreground text-center mb-5">
                Would you like to be mentored by <span className="font-semibold text-foreground">{mentor.full_name || 'this mentor'}</span>?
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 h-12 text-base font-semibold rounded-xl gap-2"
                    onClick={() => handleRespond('accepted')}
                    disabled={isResponding}
                  >
                    {isResponding ? (
                      <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-5 h-5" />
                    )}
                    Accept Offer
                  </Button>
                </motion.div>
                <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600 h-12 text-base font-semibold rounded-xl gap-2"
                    onClick={() => handleRespond('declined')}
                    disabled={isResponding}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
                    Decline
                  </Button>
                </motion.div>
              </div>
            </div>
          ) : respondedStatus === 'accepted' ? (
            <div className="flex flex-col items-center gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="bg-brand-purple-600 hover:bg-brand-purple-700 text-white rounded-xl h-12 px-8 text-base font-semibold gap-2 shadow-lg shadow-brand-purple-500/20"
                  asChild
                >
                  <Link href={`/messages/chat/${offer.mentor_id}`}>
                    <HugeiconsIcon icon={Message01Icon} className="w-5 h-5" />
                    Message {mentor.full_name?.split(' ')[0] || 'Mentor'}
                  </Link>
                </Button>
              </motion.div>
              <Link href="/mentorship" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Back to Mentorship
              </Link>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button variant="outline" className="rounded-xl" asChild>
                <Link href="/mentorship">Back to Mentorship</Link>
              </Button>
            </div>
          )}
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </motion.div>
    </div>
  )
}
