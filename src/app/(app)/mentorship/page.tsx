'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, Award01Icon, Cancel01Icon, CheckmarkCircle01Icon, Clock01Icon, FolderOpenIcon, GitCompareIcon, Loading02Icon, Location01Icon, Message01Icon, Refresh01Icon, Search01Icon, SentIcon, SlidersHorizontalIcon, SparklesIcon, StarIcon, UserCheck01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { offlineDB } from '@/lib/offline'
import type { OfflinePortfolio } from '@/types'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import SpotlightCard from '@/components/SpotlightCard'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { useSession } from '@/components/providers/user-session-provider'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Mentor {
  id: string
  user_id: string
  fullName: string
  avatarUrl: string | null
  bio: string
  location: string
  skills: string[]
  mentorExpertise: string[]
  maxMentees: number
  isAvailableForMentorship: boolean
  averageRating?: number
  totalReviews?: number
}

interface MentorshipRequest {
  id: string
  mentor_id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string
  goals: string
  created_at: string
  mentor?: {
    full_name: string
    avatar_url: string | null
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 8

const skillOptions = [
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Branding', 'Illustration', 'Motion Graphics',
  'Social Media', 'Content Strategy', 'Freelancing', 'Business Development',
]

const ease = [0.23, 1, 0.32, 1] as const

// Avatar gradient palettes for fallback
const avatarGradients = [
  'from-brand-500 to-brand-purple-600',
  'from-brand-purple-500 to-brand-purple-600',
  'from-brand-500 to-brand-purple-600',
  'from-brand-purple-500 to-brand-purple-600',
  'from-brand-500 to-brand-purple-500',
  'from-brand-purple-500 to-brand-500',
]

function getAvatarGradient(index: number) {
  return avatarGradients[index % avatarGradients.length]
}

// ─── Page Component (role-gated) ─────────────────────────────────────────────

export default function MentorshipPage() {
  const { role, isLoading: sessionLoading } = useSession()

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // Mentor sees "My Mentees" management view
  if (role === 'mentor') {
    return <MentorMenteesView />
  }

  // Everyone else sees the "Find Your Mentor" view
  return <FindMentorView />
}

// ─── Find Mentor View (for creatives, employers, investors) ─────────────────

function FindMentorView() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'find' | 'my'>('find')
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  // Comparison state
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  
  // Request form state
  const [portfolios, setPortfolios] = useState<OfflinePortfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [goals, setGoals] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  
  // My mentorship state
  const [myRequests, setMyRequests] = useState<MentorshipRequest[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)

  // ── Auto-open request from URL params (e.g. from portfolio contact button) ──

  useEffect(() => {
    const requestMentorId = searchParams.get('request')
    const requestMentorName = searchParams.get('name')
    if (requestMentorId && mentors.length > 0) {
      const mentor = mentors.find(m => m.user_id === requestMentorId)
      if (mentor) {
        setSelectedMentor(mentor)
        setIsRequestOpen(true)
      } else if (requestMentorName) {
        setSelectedMentor({
          id: requestMentorId,
          user_id: requestMentorId,
          fullName: decodeURIComponent(requestMentorName),
          avatarUrl: null,
          bio: '',
          location: '',
          skills: [],
          mentorExpertise: [],
          maxMentees: 5,
          isAvailableForMentorship: true,
        } as Mentor)
        setIsRequestOpen(true)
      }
    }
  }, [searchParams, mentors])

  // ── Data Loading ───────────────────────────────────────────────────────────

  useEffect(() => {
    loadMentors()
    loadPortfolios()
    loadMyRequests()
  }, [])

  useEffect(() => {
    if (activeTab === 'my') loadMyRequests()
  }, [activeTab])

  // Build a lookup map: mentor_id -> most relevant MentorshipRequest
  const mentorRequestMap = useMemo(() => {
    const map = new Map<string, MentorshipRequest>()
    for (const req of myRequests) {
      const existing = map.get(req.mentor_id)
      // Keep the most relevant: pending/accepted win over declined
      if (!existing || (existing.status === 'declined' && req.status !== 'declined')) {
        map.set(req.mentor_id, req)
      }
    }
    return map
  }, [myRequests])

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [searchQuery])

  const loadMentors = async () => {
    setIsLoading(true)
    try {
      // Try cache first when offline
      let cached: any = null
      try {
        const { getCachedData } = await import('@/lib/offline/indexed-db')
        cached = await getCachedData('api', 'mentorship:mentors')
      } catch {}

      if (!navigator.onLine && cached?.payload) {
        setMentors(cached.payload)
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/mentors')
      if (response.ok) {
        const data = await response.json()
        const mentorList: Mentor[] = data.mentors || []
        
        const mentorsWithRatings = await Promise.all(
          mentorList.map(async (mentor) => {
            try {
              const ratingRes = await fetch(`/api/mentorship/feedback?mentor_id=${mentor.user_id}`)
              if (ratingRes.ok) {
                const ratingData = await ratingRes.json()
                return {
                  ...mentor,
                  averageRating: ratingData.averageRating || 0,
                  totalReviews: ratingData.totalReviews || 0,
                }
              }
            } catch {
              // ignore
            }
            return mentor
          })
        )
        setMentors(mentorsWithRatings)

        // Cache for offline
        try {
          const { cacheData } = await import('@/lib/offline/indexed-db')
          await cacheData('api', 'mentorship:mentors', { payload: mentorsWithRatings }, 30 * 60 * 1000)
        } catch {}
      }
    } catch (error) {
      console.error('Error loading mentors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPortfolios = async () => {
    try {
      const allPortfolios = await offlineDB.getAllPortfolios()
      setPortfolios(allPortfolios)
      setSelectedPortfolio('__none__')
    } catch (error) {
      console.error('Error loading portfolios:', error)
    }
  }

  const loadMyRequests = async () => {
    setIsLoadingRequests(true)
    try {
      // Try cache first when offline
      let cached: any = null
      try {
        const { getCachedData } = await import('@/lib/offline/indexed-db')
        cached = await getCachedData('api', 'mentorship:requests')
      } catch {}

      if (!navigator.onLine && cached?.payload) {
        setMyRequests(cached.payload)
        setIsLoadingRequests(false)
        return
      }

      const response = await fetch('/api/mentorship')
      if (response.ok) {
        const data = await response.json()
        setMyRequests(data.requests || [])

        // Cache for offline
        try {
          const { cacheData } = await import('@/lib/offline/indexed-db')
          await cacheData('api', 'mentorship:requests', { payload: data.requests || [] }, 15 * 60 * 1000)
        } catch {}
      }
    } catch (error) {
      console.error('Error loading requests:', error)
    } finally {
      setIsLoadingRequests(false)
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleOpenRequest = useCallback((mentor: Mentor) => {
    setSelectedMentor(mentor)
    setIsRequestOpen(true)
    setRequestMessage('')
    setGoals('')
    setSelectedSkills([])
  }, [])

  const handleSubmitRequest = async () => {
    if (!selectedMentor) return
    if (!requestMessage.trim()) { toast.error('Please write a message to the mentor'); return }
    if (!goals.trim()) { toast.error('Please describe your goals'); return }

    setIsSubmitting(true)
    try {
      let portfolioId = null
      if (selectedPortfolio && selectedPortfolio !== '__none__') {
        const portfolio = portfolios.find(p => p.localId === selectedPortfolio)
        if (portfolio?.id && !portfolio.id.startsWith('local_')) {
          portfolioId = portfolio.id
        }
      }

      const response = await fetch('/api/mentorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentor_id: selectedMentor.user_id,
          message: requestMessage.trim(),
          goals: goals.trim(),
          skills_to_develop: selectedSkills,
          portfolio_id: portfolioId,
        }),
      })

      if (response.ok) {
        toast.success('Mentorship request sent!')
        setIsRequestOpen(false)
        setSelectedMentor(null)
        loadMyRequests()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to send request')
      }
    } catch {
      toast.error('Failed to send request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return
    try {
      await fetch(`/api/mentorship?id=${requestId}`, { method: 'DELETE' })
      setMyRequests(prev => prev.filter(r => r.id !== requestId))
      toast.success('Request cancelled')
    } catch {
      toast.error('Failed to cancel request')
    }
  }

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const response = await fetch('/api/mentorship/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, status: 'accepted' }),
      })
      if (response.ok) {
        toast.success('Mentorship offer accepted! You are now connected with your mentor.')
        setMyRequests(prev => prev.map(r => r.id === offerId ? { ...r, status: 'accepted' as const } : r))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to accept offer')
      }
    } catch {
      toast.error('Failed to accept offer')
    }
  }

  const handleDeclineOffer = async (offerId: string) => {
    try {
      const response = await fetch('/api/mentorship/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, status: 'declined' }),
      })
      if (response.ok) {
        toast.success('Mentorship offer declined.')
        setMyRequests(prev => prev.map(r => r.id === offerId ? { ...r, status: 'declined' as const } : r))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to decline offer')
      }
    } catch {
      toast.error('Failed to decline offer')
    }
  }

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill))
    } else if (selectedSkills.length < 5) {
      setSelectedSkills([...selectedSkills, skill])
    } else {
      toast.error('Maximum 5 skills allowed')
    }
  }

  const toggleCompare = useCallback((mentorId: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(mentorId)) {
        next.delete(mentorId)
      } else if (next.size < 3) {
        next.add(mentorId)
      } else {
        toast.error('You can compare up to 3 mentors')
      }
      return next
    })
  }, [])

  // ── Derived Data ───────────────────────────────────────────────────────────

  const filteredMentors = useMemo(() => {
    return mentors.filter(mentor => {
      const q = searchQuery.toLowerCase()
      return !q ||
        mentor.fullName.toLowerCase().includes(q) ||
        mentor.bio?.toLowerCase().includes(q) ||
        mentor.skills?.some(s => s.toLowerCase().includes(q)) ||
        mentor.mentorExpertise?.some(e => e.toLowerCase().includes(q)) ||
        mentor.location?.toLowerCase().includes(q)
    })
  }, [mentors, searchQuery])

  const availableCount = useMemo(() => filteredMentors.filter(m => m.isAvailableForMentorship).length, [filteredMentors])

  // Featured mentor: highest-rated available mentor
  const featuredMentor = useMemo(() => {
    return filteredMentors.find(
      m => m.isAvailableForMentorship && (m.averageRating ?? 0) >= 4.5
    ) || null
  }, [filteredMentors])

  // Grid mentors (exclude featured) with pagination
  const gridMentors = useMemo(() => {
    const list = featuredMentor
      ? filteredMentors.filter(m => m.id !== featuredMentor.id)
      : filteredMentors
    return list.slice(0, visibleCount)
  }, [filteredMentors, featuredMentor, visibleCount])

  const totalAfterFeatured = featuredMentor ? filteredMentors.length - 1 : filteredMentors.length
  const hasMore = visibleCount < totalAfterFeatured

  const compareMentors = useMemo(() => {
    return mentors.filter(m => compareIds.has(m.id))
  }, [mentors, compareIds])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ━━━ Hero Section ━━━ */}
      <section className="relative overflow-hidden">
        <div className="relative container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          {/* Tabs at top-right */}
          <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
                Find Your{' '}
                <span className="text-brand-dark dark:text-foreground">
                  Mentor
                </span>
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease }}
                className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg"
              >
                Connect with experienced Sierra Leone creatives to level up your craft.
                Our offline-first experience ensures you stay inspired anywhere.
              </motion.p>
            </motion.div>

            {/* Tab pills */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex-shrink-0"
            >
              <div className="inline-flex rounded-full bg-muted/60 backdrop-blur-sm p-1 border border-border/50">
                {(['find', 'my'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'relative px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                      activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="mentorTab"
                        className="absolute inset-0 rounded-full bg-background shadow-sm border border-border/50"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">
                      {tab === 'find' ? 'Find Mentors' : 'My Requests'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Search + Filter Bar */}
          <AnimatePresence mode="wait">
      {activeTab === 'find' && (
              <motion.div
                key="search-bar"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.25, ease }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative flex-1">
                    <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
            <Input
                      placeholder="Search by skill (e.g., Photography, UI/UX, Motion Design)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 h-12 rounded-xl bg-card/60 backdrop-blur-sm border-border/60 text-sm focus-visible:ring-brand-purple-500/30 dark:ring-brand-500/30"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="h-12 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-brand-dark border-brand-500 hover:border-brand-600 gap-2"
                    onClick={loadMentors}
                    disabled={isLoading}
                  >
                    {isLoading ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 animate-spin" /> : <HugeiconsIcon icon={SlidersHorizontalIcon} className="w-4 h-4" />}
                    <span className="hidden sm:inline">Filters</span>
                  </Button>
          </div>

              </motion.div>
            )}
          </AnimatePresence>
          </div>
      </section>

      {/* ━━━ Content ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-20">
        <AnimatePresence mode="wait">
          {/* ── Find Mentors Tab ── */}
          {activeTab === 'find' && (
            <motion.div
              key="find-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease }}
            >
              {/* Stats strip */}
              {!isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-4 text-sm text-muted-foreground mb-6 mt-4"
                >
                  <span>
                    Showing <span className="text-foreground font-medium">{Math.min(visibleCount, totalAfterFeatured) + (featuredMentor ? 1 : 0)}</span> of{' '}
                    <span className="text-foreground font-medium">{filteredMentors.length}</span> mentors
                  </span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>
                    <span className="text-green-500 font-medium">{availableCount}</span> available now
                  </span>
                  {compareIds.size > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span className="text-brand-purple-600 dark:text-brand-400 font-medium">{compareIds.size} selected to compare</span>
                    </>
                  )}
                </motion.div>
              )}

          {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
                  <p className="text-sm text-muted-foreground">Loading mentors...</p>
            </div>
          ) : filteredMentors.length > 0 ? (
                <>
                  {/* Featured Mentor Spotlight */}
                  {featuredMentor && (
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease }}
                      className="mb-6"
                    >
                      <FeaturedMentorCard
                        mentor={featuredMentor}
                        onRequestMentorship={() => handleOpenRequest(featuredMentor)}
                      />
                    </motion.div>
                  )}

                  {/* Mentor Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                    {gridMentors.map((mentor, index) => (
                      <motion.div
                  key={mentor.id} 
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.45, delay: index * 0.06, ease }}
                      >
                        <MentorCard
                  mentor={mentor} 
                          index={index}
                          isCompareSelected={compareIds.has(mentor.id)}
                          existingRequest={mentorRequestMap.get(mentor.user_id) || null}
                  onRequestMentorship={() => handleOpenRequest(mentor)}
                          onToggleCompare={() => toggleCompare(mentor.id)}
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
                        Load More Mentors
                        <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4" />
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Showing {Math.min(visibleCount, totalAfterFeatured)} of {totalAfterFeatured} mentors
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
                    <HugeiconsIcon icon={UserGroupIcon} className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No mentors found</h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {searchQuery
                      ? 'Try adjusting your search to find more mentors.'
                      : 'Check back later for available mentors.'}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4 rounded-full"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── My Requests Tab ── */}
      {activeTab === 'my' && (
            <motion.div
              key="my-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease }}
              className="pt-4"
            >
          {isLoadingRequests ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
                  <p className="text-sm text-muted-foreground">Loading requests...</p>
            </div>
          ) : myRequests.length > 0 ? (
                <div className="space-y-3">
                  {myRequests.map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.06, ease }}
                    >
                      <RequestCard
                        request={request}
                        onCancel={handleCancelRequest}
                        onAcceptOffer={handleAcceptOffer}
                        onDeclineOffer={handleDeclineOffer}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                    <HugeiconsIcon icon={Message01Icon} className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No mentorship requests</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mb-4">
                    Find a mentor to start your learning journey
                  </p>
                  <Button
                    className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2"
                    onClick={() => setActiveTab('find')}
                  >
                    <HugeiconsIcon icon={Search01Icon} className="w-4 h-4" />
                    Browse Mentors
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
                          </div>

      {/* ━━━ Floating Comparison Bar ━━━ */}
      <AnimatePresence>
        {compareIds.size > 0 && activeTab === 'find' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/10">
              <div className="flex -space-x-2">
                {compareMentors.map((m) => (
                  <Avatar key={m.id} className="w-8 h-8 ring-2 ring-background">
                    <AvatarImage src={m.avatarUrl || undefined} />
                    <AvatarFallback className="bg-brand-500 text-brand-dark text-xs">
                      {m.fullName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                ))}
                        </div>
              <span className="text-sm text-muted-foreground">
                {compareIds.size} mentor{compareIds.size > 1 ? 's' : ''} selected
              </span>
                          <Button
                            size="sm"
                className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-1.5"
                onClick={() => setIsCompareOpen(true)}
                          >
                <HugeiconsIcon icon={GitCompareIcon} className="w-3.5 h-3.5" />
                Compare
                          </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setCompareIds(new Set())}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Compare Dialog ━━━ */}
      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Mentors</DialogTitle>
            <DialogDescription>Side-by-side comparison of selected mentors</DialogDescription>
          </DialogHeader>
          <div className={cn('grid gap-4 mt-4', compareMentors.length === 1 ? 'grid-cols-1' : compareMentors.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {compareMentors.map((mentor) => (
              <SpotlightCard key={mentor.id} className="space-y-4 p-4">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="w-16 h-16 mb-2">
                    <AvatarImage src={mentor.avatarUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-lg font-bold">
                      {mentor.fullName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <h4 className="font-semibold text-foreground text-sm">{mentor.fullName}</h4>
                  <p className="text-xs text-muted-foreground">{mentor.location || 'N/A'}</p>
                      </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      {(mentor.averageRating ?? 0) > 0 ? (
                        <>
                          <HugeiconsIcon icon={StarIcon} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          {mentor.averageRating} ({mentor.totalReviews})
                        </>
                      ) : 'No reviews'}
                    </span>
                    </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className={cn('font-medium', mentor.isAvailableForMentorship ? 'text-green-500' : 'text-red-400')}>
                      {mentor.isAvailableForMentorship ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Max mentees</span>
                    <span className="font-medium text-foreground">{mentor.maxMentees}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Skills</span>
                    <div className="flex flex-wrap gap-1">
                      {mentor.skills?.slice(0, 4).map(s => (
                        <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Button 
                  size="sm"
                  className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark"
                  disabled={!mentor.isAvailableForMentorship}
                  onClick={() => { setIsCompareOpen(false); handleOpenRequest(mentor) }}
                >
                  Request Mentorship
                </Button>
        </SpotlightCard>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ━━━ Request Mentorship Dialog ━━━ */}
      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Mentorship</DialogTitle>
            <DialogDescription>
              Send a personalized request to {selectedMentor?.fullName}
            </DialogDescription>
          </DialogHeader>

          {selectedMentor && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 mt-4"
            >
              {/* Mentor Preview */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-purple-500/5 dark:bg-brand-500/5 border border-brand-500/15">
                <Avatar className="w-12 h-12 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20">
                  <AvatarImage src={selectedMentor.avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">
                    {selectedMentor.fullName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{selectedMentor.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMentor.skills?.slice(0, 2).join(' · ')}
                  </p>
                </div>
                {selectedMentor.averageRating && selectedMentor.averageRating > 0 && (
                  <div className="ml-auto flex items-center gap-1 text-sm">
                    <HugeiconsIcon icon={StarIcon} className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium text-foreground">{selectedMentor.averageRating}</span>
                  </div>
                )}
              </div>

              {/* Portfolio Selection */}
              <div className="space-y-2">
                <Label>Attach Portfolio (optional)</Label>
                {portfolios.length > 0 ? (
                  <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select a portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No portfolio</SelectItem>
                      {portfolios.map((p) => {
                        const data = p.data as Record<string, unknown>
                        return (
                          <SelectItem key={p.localId} value={p.localId}>
                            {data.title as string || 'Untitled Portfolio'}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No portfolios available.{' '}
                    <Link href="/dashboard/portfolios/new" className="text-brand-purple-600 dark:text-brand-400 hover:underline">
                      Create one
                    </Link>
                  </p>
                )}
              </div>

              {/* Skills to Develop */}
              <div className="space-y-2">
                <Label>Skills you want to develop (select up to 5)</Label>
                <div className="flex flex-wrap gap-2">
                  {skillOptions.map((skill, i) => (
                    <motion.div
                      key={skill}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, delay: i * 0.02 }}
                    >
                      <Badge
                      variant={selectedSkills.includes(skill) ? 'default' : 'outline'}
                        className={cn(
                          'cursor-pointer transition-all',
                        selectedSkills.includes(skill) 
                            ? 'bg-brand-500 hover:bg-brand-600 border-brand-500'
                            : 'hover:border-brand-purple-500/50 dark:border-brand-500/50'
                        )}
                      onClick={() => toggleSkill(skill)}
                    >
                      {skill}
                    </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-2">
                <Label htmlFor="goals">
                  Your Goals <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="goals"
                  placeholder="What do you hope to achieve through this mentorship?"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={3}
                  className="rounded-lg"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">
                  Personal Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  placeholder="Introduce yourself and explain why you'd like this mentor..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  A personalized message increases your chances of being accepted
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setIsRequestOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark"
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || !requestMessage.trim() || !goals.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                      Send Request
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

// ─── Featured Mentor Card ────────────────────────────────────────────────────

function FeaturedMentorCard({
  mentor, 
  onRequestMentorship,
}: { 
  mentor: Mentor
  onRequestMentorship: () => void 
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group relative"
    >
      <SpotlightCard className="overflow-hidden bg-gradient-to-r from-brand-500/10 via-brand-purple-500/5 to-transparent border border-brand-purple-500/20 dark:border-brand-500/20 hover:border-brand-500/40">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple-500/5 dark:bg-brand-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20">
            <AvatarImage src={mentor.avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-2xl font-bold">
              {mentor.fullName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -top-1 -left-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple-500 text-white text-[10px] font-bold uppercase tracking-wide shadow-lg">
            <HugeiconsIcon icon={SparklesIcon} className="w-3 h-3" />
            Featured
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
              <div>
              <h3 className="text-xl font-bold text-foreground">{mentor.fullName}</h3>
              <p className="text-sm text-brand-purple-600 dark:text-brand-400 font-semibold uppercase tracking-wide mt-0.5">
                {mentor.mentorExpertise?.[0] || mentor.skills?.[0] || 'Creative Professional'}
              </p>
            </div>
            {mentor.averageRating && mentor.averageRating > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                <HugeiconsIcon icon={StarIcon} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold text-foreground">{mentor.averageRating}</span>
                <span className="text-xs text-muted-foreground">({mentor.totalReviews})</span>
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
            {mentor.bio || 'Experienced mentor ready to help you grow your creative career.'}
          </p>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {mentor.location && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Location01Icon} className="w-3 h-3" />
                {mentor.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={UserGroupIcon} className="w-3 h-3" />
              Max {mentor.maxMentees} mentees
            </span>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-2.5 h-2.5 mr-0.5" />
              Available
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-6 gap-2 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
              onClick={onRequestMentorship}
            >
              Request Mentorship
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href={`/portfolio/user/${mentor.user_id}`}>
                View Portfolio
              </Link>
            </Button>
          </div>
        </div>
      </div>
      </SpotlightCard>
    </motion.div>
  )
}

// ─── Mentor Card (Grid) ──────────────────────────────────────────────────────

function MentorCard({
  mentor,
  index,
  isCompareSelected,
  existingRequest,
  onRequestMentorship,
  onToggleCompare,
}: {
  mentor: Mentor
  index: number
  isCompareSelected: boolean
  existingRequest?: MentorshipRequest | null
  onRequestMentorship: () => void
  onToggleCompare: () => void
}) {
  const gradient = getAvatarGradient(index)

  // Determine the button state based on existing request
  const isMentorOffer = existingRequest?.goals === '__mentor_offer__'
  const isPendingOffer = isMentorOffer && existingRequest?.status === 'pending'
  const isPendingRequest = !isMentorOffer && existingRequest?.status === 'pending'
  const isAccepted = existingRequest?.status === 'accepted'
  const isDeclined = existingRequest?.status === 'declined'
  const showDefaultButton = !existingRequest || isDeclined

  // Build meta line: location + capacity
  const metaParts: string[] = []
  if (mentor.location) metaParts.push(mentor.location)
  metaParts.push(`${mentor.maxMentees} mentee slots`)

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative',
        isCompareSelected && 'ring-2 ring-brand-purple-500/50 dark:ring-brand-500/50'
      )}
    >
      <SpotlightCard className={cn(
        'overflow-hidden transition-all duration-300',
        isPendingOffer && 'hover:shadow-lg hover:shadow-brand-purple-500/5',
        isAccepted && 'hover:shadow-lg hover:shadow-emerald-500/5',
        !isCompareSelected && !isPendingOffer && !isAccepted && 'hover:shadow-lg hover:shadow-black/5'
      )}>
      {/* Profile image area */}
      <div className={cn('relative h-44 bg-gradient-to-br', gradient)}>
        {mentor.avatarUrl ? (
          <img
            src={mentor.avatarUrl}
            alt={mentor.fullName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white/60">
              {mentor.fullName?.split(' ').map(n => n[0]).join('') || '?'}
            </span>
          </div>
        )}

        {/* Subtle bottom fade for readability */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Status pill (top-left) */}
        {isPendingOffer && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-brand-purple-600/90 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide">
            Offer Received
          </div>
        )}
        {isAccepted && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide">
            Your Mentor
          </div>
        )}
        {mentor.isAvailableForMentorship && !isPendingOffer && !isAccepted && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-green-600/90 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide">
            Available
          </div>
        )}

        {/* Rating (top-right, text only) */}
        {mentor.averageRating != null && mentor.averageRating > 0 && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium">
            {mentor.averageRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-foreground text-[15px] leading-snug truncate">
                  {mentor.fullName}
                </h3>
        <p className="text-muted-foreground text-sm mt-0.5 truncate">
          {mentor.mentorExpertise?.[0] || mentor.skills?.[0] || 'Creative Mentor'}
        </p>

        <p className="text-xs text-muted-foreground/70 mt-2 truncate">
          {metaParts.join(' \u00B7 ')}
        </p>

        {/* Action */}
        <div className="mt-4">
          {isPendingOffer && existingRequest && (
            <Button
              size="sm"
              className="w-full rounded-lg bg-brand-purple-500 hover:bg-brand-purple-600 text-white"
              asChild
            >
              <Link href={`/mentorship/offer/${existingRequest.id}`}>
                View Offer
              </Link>
            </Button>
          )}

          {isAccepted && (
            <Button
              size="sm"
              className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
              asChild
            >
              <Link href={`/messages/chat/${mentor.user_id}`}>
                Message Mentor
              </Link>
            </Button>
          )}

          {isPendingRequest && (
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-lg border-brand-purple-500/30 text-brand-purple-600 dark:text-brand-purple-400 bg-brand-purple-500/5 cursor-default"
              disabled
            >
              Request Pending
            </Button>
          )}

          {showDefaultButton && (
            <Button
              size="sm"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark"
              disabled={!mentor.isAvailableForMentorship}
              onClick={onRequestMentorship}
            >
              Request Mentorship
            </Button>
          )}

          <Link
            href={`/portfolio/user/${mentor.user_id}`}
            className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-2.5 py-1"
          >
            View Portfolio
          </Link>
              </div>
      </div>
      </SpotlightCard>
    </motion.div>
  )
}

// ─── Request Card ────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onCancel,
  onAcceptOffer,
  onDeclineOffer,
}: {
  request: MentorshipRequest
  onCancel: (id: string) => void
  onAcceptOffer?: (id: string) => void
  onDeclineOffer?: (id: string) => void
}) {
  const isMentorOffer = request.goals === '__mentor_offer__'
  const [isResponding, setIsResponding] = useState(false)

  const statusConfig = {
    pending: {
      icon: Clock01Icon,
      label: isMentorOffer ? 'Offer Pending' : 'Pending',
      className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    },
    accepted: {
      icon: CheckmarkCircle01Icon,
      label: 'Accepted',
      className: 'bg-green-500/10 text-green-500 border-green-500/30',
    },
    declined: {
      icon: Cancel01Icon,
      label: 'Declined',
      className: 'bg-red-500/10 text-red-500 border-red-500/30',
    },
  }

  const status = statusConfig[request.status]

  const handleAccept = async () => {
    setIsResponding(true)
    onAcceptOffer?.(request.id)
  }

  const handleDecline = async () => {
    setIsResponding(true)
    onDeclineOffer?.(request.id)
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <SpotlightCard className={cn(
        'p-4 hover:border-border transition-colors flex flex-col gap-0',
        isMentorOffer && request.status === 'pending' && 'ring-1 ring-brand-purple-500/30 dark:ring-brand-500/30'
      )}>
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12 ring-2 ring-border/50">
          <AvatarImage src={request.mentor?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">
            {request.mentor?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {isMentorOffer && request.status === 'pending' && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                  <HugeiconsIcon icon={Award01Icon} className="w-3 h-3" />
                  Mentorship Offer
                </div>
              )}
              <h3 className="font-semibold text-foreground truncate">
                {isMentorOffer
                  ? `${request.mentor?.full_name || 'A mentor'} wants to mentor you`
                  : (request.mentor?.full_name || 'Unknown Mentor')}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={status.className}>
                  <HugeiconsIcon icon={status.icon} className="w-3 h-3 mr-1" />
                  {status.label}
              </Badge>
                <span className="text-xs text-muted-foreground">
                  {isMentorOffer ? 'Received' : 'Sent'} {formatDistanceToNow(request.created_at)}
                </span>
            </div>
          </div>
            {!isMentorOffer && request.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg flex-shrink-0"
                onClick={() => onCancel(request.id)}
              >
                Cancel
              </Button>
            )}
        </div>

          {isMentorOffer ? (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {request.message}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              <span className="font-medium text-foreground/80">Goals:</span> {request.goals}
            </p>
          )}

          {/* Accept/Decline buttons for mentor offers */}
          {isMentorOffer && request.status === 'pending' && onAcceptOffer && onDeclineOffer && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="rounded-lg bg-green-600 hover:bg-green-700 text-white gap-1.5"
                onClick={handleAccept}
                disabled={isResponding}
              >
                {isResponding ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg border-red-500/30 text-red-500 hover:bg-red-500/10 gap-1.5"
                onClick={handleDecline}
                disabled={isResponding}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                Decline
              </Button>
            </div>
          )}

          {/* Active mentorship section */}
          {request.status === 'accepted' && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-600">Active Mentorship</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/messages/chat/${request.mentor_id}`}>
                  <Button size="sm" className="rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark gap-1.5 h-8 text-xs">
                    <HugeiconsIcon icon={Message01Icon} className="w-3.5 h-3.5" />
                    Message Mentor
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      </SpotlightCard>
    </motion.div>
  )
}

// ─── Mentor Mentees View (for mentor role) ──────────────────────────────────

interface MenteeInfo {
  id: string
  mentor_id: string
  mentee_id: string
  status: string
  started_at: string
  mentee?: {
    full_name: string
    avatar_url: string | null
    bio: string
    skills: string[]
    location: string
  }
}

interface SentOffer {
  id: string
  mentor_id: string
  mentee_id: string
  status: string
  message: string
  goals: string
  created_at: string
  mentee?: {
    full_name: string
    avatar_url: string | null
    bio: string
    skills: string[]
    location: string
  }
}

function MentorMenteesView() {
  const [activeTab, setActiveTab] = useState<'mentees' | 'offers'>('mentees')
  const [mentees, setMentees] = useState<MenteeInfo[]>([])
  const [sentOffers, setSentOffers] = useState<SentOffer[]>([])
  const [isLoadingMentees, setIsLoadingMentees] = useState(true)
  const [isLoadingOffers, setIsLoadingOffers] = useState(true)

  useEffect(() => {
    loadMentees()
    loadSentOffers()
  }, [])

  const loadMentees = async () => {
    setIsLoadingMentees(true)
    try {
      const response = await fetch('/api/mentorship?role=mentor&status=accepted')
      if (response.ok) {
        const data = await response.json()
        setMentees(data.mentorships || data.requests || [])
      }
    } catch (error) {
      console.error('Error loading mentees:', error)
    } finally {
      setIsLoadingMentees(false)
    }
  }

  const loadSentOffers = async () => {
    setIsLoadingOffers(true)
    try {
      const response = await fetch('/api/mentorship/offers?role=mentor')
      if (response.ok) {
        const data = await response.json()
        setSentOffers(data.offers || [])
      }
    } catch (error) {
      console.error('Error loading sent offers:', error)
    } finally {
      setIsLoadingOffers(false)
    }
  }

  const pendingOffers = sentOffers.filter(o => o.status === 'pending')
  const acceptedOffers = sentOffers.filter(o => o.status === 'accepted')
  const declinedOffers = sentOffers.filter(o => o.status === 'declined')

  return (
    <div className="min-h-screen bg-background">
      {/* ━━━ Hero Section ━━━ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-brand-500/8 blur-[100px]" />
          <div className="absolute top-1/3 -left-16 w-[300px] h-[300px] rounded-full bg-brand-purple-500/5 blur-[80px]" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 border border-brand-purple-500/20 dark:border-brand-500/20 mb-3">
                <HugeiconsIcon icon={UserGroupIcon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
                <span className="text-xs font-medium text-brand-purple-600 dark:text-brand-400">Mentorship Management</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
                My{' '}
                <span className="text-brand-dark dark:text-foreground">
                  Mentees
                </span>
              </h1>
              <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-lg">
                Manage your active mentorship relationships and track sent offers.
              </p>
            </motion.div>

            {/* Tab pills */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="flex-shrink-0"
            >
              <div className="inline-flex rounded-full bg-muted/60 backdrop-blur-sm p-1 border border-border/50">
                {(['mentees', 'offers'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'relative px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                      activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="mentorMgmtTab"
                        className="absolute inset-0 rounded-full bg-background shadow-sm border border-border/50"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {tab === 'mentees' ? 'Active Mentees' : 'Sent Offers'}
                      {tab === 'offers' && pendingOffers.length > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-500 text-brand-dark text-[10px] font-bold">
                          {pendingOffers.length}
                        </span>
                      )}
                    </span>
                  </button>
            ))}
          </div>
            </motion.div>
          </div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease }}
            className="flex items-center gap-6 text-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                <span className="text-foreground font-semibold">{mentees.length}</span> active mentees
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">
                <span className="text-foreground font-semibold">{pendingOffers.length}</span> pending offers
              </span>
            </div>
            <Link
              href="/mentorship/scout"
              className="ml-auto text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-600 dark:hover:text-brand-400 font-medium flex items-center gap-1 text-sm transition-colors"
            >
              <HugeiconsIcon icon={SparklesIcon} className="w-3.5 h-3.5" />
              Scout More Talents
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ━━━ Content ━━━ */}
      <div className="container mx-auto px-4 sm:px-6 pb-20">
        <AnimatePresence mode="wait">
          {/* ── Active Mentees Tab ── */}
          {activeTab === 'mentees' && (
            <motion.div
              key="mentees-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease }}
              className="pt-6"
            >
              {isLoadingMentees ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
                  <p className="text-sm text-muted-foreground">Loading mentees...</p>
                </div>
              ) : mentees.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {mentees.map((mentee, index) => (
                    <motion.div
                      key={mentee.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: index * 0.06, ease }}
                    >
                      <MenteeCard mentee={mentee} index={index} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                    <HugeiconsIcon icon={UserGroupIcon} className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No active mentees yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mb-4">
                    Scout for talented creatives and offer them your mentorship to get started.
                  </p>
                  <Button
                    className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2"
                    asChild
                  >
                    <Link href="/mentorship/scout">
                      <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4" />
                      Scout Talents
                    </Link>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Sent Offers Tab ── */}
          {activeTab === 'offers' && (
            <motion.div
              key="offers-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease }}
              className="pt-6"
            >
              {isLoadingOffers ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400" />
                  <p className="text-sm text-muted-foreground">Loading offers...</p>
                </div>
              ) : sentOffers.length > 0 ? (
                <div className="space-y-3">
                  {/* Pending offers */}
                  {pendingOffers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4 text-yellow-500" />
                        Pending ({pendingOffers.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingOffers.map((offer, i) => (
                          <motion.div
                            key={offer.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.06, ease }}
                          >
                            <SentOfferCard offer={offer} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accepted offers */}
                  {acceptedOffers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-green-500" />
                        Accepted ({acceptedOffers.length})
                      </h3>
                      <div className="space-y-3">
                        {acceptedOffers.map((offer, i) => (
                          <motion.div
                            key={offer.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.06, ease }}
                          >
                            <SentOfferCard offer={offer} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Declined offers */}
                  {declinedOffers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 text-red-500" />
                        Declined ({declinedOffers.length})
                      </h3>
                      <div className="space-y-3">
                        {declinedOffers.map((offer, i) => (
                          <motion.div
                            key={offer.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.06, ease }}
                          >
                            <SentOfferCard offer={offer} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
            </div>
          ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                    <HugeiconsIcon icon={SentIcon} className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">No offers sent yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mb-4">
                    Find creative talents and offer them your mentorship.
                  </p>
                  <Button
                    className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2"
                    asChild
                  >
                    <Link href="/mentorship/scout">
                      <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4" />
                      Scout Talents
                    </Link>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Mentee Card (for mentor view) ──────────────────────────────────────────

function MenteeCard({ mentee, index }: { mentee: MenteeInfo; index: number }) {
  const gradient = avatarGradients[index % avatarGradients.length]

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300"
    >
      <SpotlightCard className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14 ring-2 ring-green-500/20">
            <AvatarImage src={mentee.mentee?.avatar_url || undefined} />
            <AvatarFallback className={cn('bg-gradient-to-br text-white font-bold text-lg', gradient)}>
              {mentee.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">
              {mentee.mentee?.full_name || 'Unknown'}
            </h3>
            {mentee.mentee?.skills && mentee.mentee.skills.length > 0 && (
              <p className="text-brand-purple-600 dark:text-brand-400 font-semibold text-[11px] uppercase tracking-wider mt-0.5 truncate">
                {mentee.mentee.skills[0]}
              </p>
            )}
            {mentee.mentee?.location && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Location01Icon} className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{mentee.mentee.location}</span>
              </div>
            )}
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px] flex-shrink-0">
            <HugeiconsIcon icon={UserCheck01Icon} className="w-3 h-3 mr-0.5" />
            Active
          </Badge>
        </div>

        {mentee.mentee?.bio && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{mentee.mentee.bio}</p>
        )}

        {mentee.mentee?.skills && mentee.mentee.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {mentee.mentee.skills.slice(0, 4).map(s => (
              <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
          {mentee.started_at && (
            <span>Started {formatDistanceToNow(mentee.started_at)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg border-border/60"
            asChild
          >
            <Link href={`/portfolio/user/${mentee.mentee_id}`}>
              <HugeiconsIcon icon={FolderOpenIcon} className="w-3.5 h-3.5 mr-1.5" />
              View Portfolio
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg border-border/60"
            asChild
          >
            <Link href={`/messages/chat/${mentee.mentee_id}`}>
              <HugeiconsIcon icon={Message01Icon} className="w-3.5 h-3.5 mr-1.5" />
              Message
            </Link>
          </Button>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}

// ─── Sent Offer Card (for mentor view) ──────────────────────────────────────

function SentOfferCard({ offer }: { offer: SentOffer }) {
  const statusConfig = {
    pending: {
      icon: Clock01Icon,
      label: 'Pending',
      className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    },
    accepted: {
      icon: CheckmarkCircle01Icon,
      label: 'Accepted',
      className: 'bg-green-500/10 text-green-500 border-green-500/30',
    },
    declined: {
      icon: Cancel01Icon,
      label: 'Declined',
      className: 'bg-red-500/10 text-red-500 border-red-500/30',
    },
  } as const

  const config = statusConfig[offer.status as keyof typeof statusConfig] || statusConfig.pending

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <SpotlightCard className="p-4 sm:p-5 hover:border-border transition-colors">
      <div className="flex items-start gap-4">
        <Avatar className="w-12 h-12 ring-2 ring-border/50">
          <AvatarImage src={offer.mentee?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-purple-600 text-white font-bold">
            {offer.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {offer.mentee?.full_name || 'Unknown Creative'}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={config.className}>
                  <HugeiconsIcon icon={config.icon} className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
          <span className="text-xs text-muted-foreground">
                  Sent {formatDistanceToNow(offer.created_at)}
          </span>
              </div>
        </div>
        <Button 
          size="sm"
              variant="outline"
              className="rounded-lg flex-shrink-0"
              asChild
            >
              <Link href={`/portfolio/user/${offer.mentee_id}`}>
                View Portfolio
              </Link>
        </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {offer.message}
          </p>
        </div>
      </div>
      </SpotlightCard>
    </motion.div>
  )
}
