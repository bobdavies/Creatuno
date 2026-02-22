'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, AnalyticsUpIcon, ArrowRight01Icon, Briefcase01Icon, Building02Icon, Cancel01Icon, Clock01Icon, Loading02Icon, Location01Icon, Refresh01Icon, Search01Icon, SparklesIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import { MdBolt } from 'react-icons/md'
import { motion, useInView, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/user-session-provider'
import SpotlightCard from '@/components/SpotlightCard'
import { LandingHeader } from '@/components/landing/landing-header'
import { LandingAuthProvider } from '@/components/landing/landing-auth-context'

// ─── Count-up Hook ──────────────────────────────────────────────────────────

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

// ─── Types ──────────────────────────────────────────────────────────────────

type OpportunityType = 'gig' | 'job' | 'investment'

interface Opportunity {
  id: string
  title: string
  description: string
  type: OpportunityType
  category: string
  budgetMin: number
  budgetMax: number
  currency: string
  location: string
  isRemote: boolean
  deadline: string
  requiredSkills: string[]
  experienceLevel: string | null
  companyName: string | null
  applicationsCount: number
  createdAt: string
  author: {
    id: string
    fullName: string
    avatarUrl?: string
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const categories = [
  'All Categories',
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Illustration', 'Branding', 'Content Writing',
  'Social Media', 'Mobile Development',
]

const locations = [
  'All Locations', 'Remote', 'Freetown', 'Bo', 'Kenema', 'Makeni', 'Other',
]

const budgetRanges = [
  { label: 'Any Budget', min: 0, max: Infinity },
  { label: '$0 - $100', min: 0, max: 100 },
  { label: '$100 - $500', min: 100, max: 500 },
  { label: '$500 - $1,000', min: 500, max: 1000 },
  { label: '$1,000 - $5,000', min: 1000, max: 5000 },
  { label: '$5,000+', min: 5000, max: Infinity },
]

const typeTabs = [
  { value: 'all', label: 'All', icon: SparklesIcon, color: 'orange' },
  { value: 'gig', label: 'Gigs', icon: MdBolt, color: 'brandPurple' },
  { value: 'job', label: 'Jobs', icon: Briefcase01Icon, color: 'brand' },
  { value: 'investment', label: 'Invest', icon: AnalyticsUpIcon, color: 'brandPurple' },
] as const

const ease = [0.23, 1, 0.32, 1] as const

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeAccent(type: OpportunityType) {
  switch (type) {
    case 'gig': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', border: 'border-brand-purple-500/30', bgLight: 'bg-brand-purple-500/10', gradient: 'from-brand-purple-500/20 to-brand-purple-400/5' }
    case 'job': return { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', border: 'border-brand-500/30', bgLight: 'bg-brand-500/10', gradient: 'from-brand-500/20 to-brand-400/5' }
    case 'investment': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', border: 'border-brand-purple-500/30', bgLight: 'bg-brand-purple-500/10', gradient: 'from-brand-purple-500/20 to-brand-purple-400/5' }
  }
}

function getTypeIconEl(type: OpportunityType, className = 'w-3 h-3 mr-1') {
  switch (type) {
    case 'gig': return <MdBolt className={className} />
    case 'job': return <HugeiconsIcon icon={Briefcase01Icon} className={className} />
    case 'investment': return <HugeiconsIcon icon={AnalyticsUpIcon} className={className} />
  }
}

function getTabIconEl(tab: (typeof typeTabs)[number], className = 'w-4 h-4') {
  if (tab.value === 'gig') return <MdBolt className={className} />
  return <HugeiconsIcon icon={tab.icon} className={className} />
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const { userId, role } = useSession()
  const isAuthenticated = !!userId
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedLocation, setSelectedLocation] = useState('All Locations')
  const [selectedBudget, setSelectedBudget] = useState(0)
  const [activeTab, setActiveTab] = useState('all')

  // Refs for scroll-triggered animations
  const heroRef = useRef(null)
  const gridRef = useRef(null)
  const heroInView = useInView(heroRef, { once: true, amount: 0.3 })
  const gridInView = useInView(gridRef, { once: true, amount: 0.1 })

  // Cached fetch for opportunities
  const { data: oppData, isLoading: isOppLoading, refresh: refreshOpportunities } = useCachedFetch<{ opportunities?: typeof opportunities }>('/api/opportunities', {
    cacheKey: 'opportunities:public',
    ttlMs: 30 * 60 * 1000, // 30 min
  })

  useEffect(() => {
    if (oppData?.opportunities) setOpportunities(oppData.opportunities)
    if (!isOppLoading) setIsLoading(false)
  }, [oppData, isOppLoading])

  const loadOpportunities = () => {
    refreshOpportunities()
  }

  // Filtered
  const filteredOpportunities = useMemo(() => opportunities.filter(opp => {
    const matchesSearch = opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All Categories' || opp.category === selectedCategory
    const matchesType = activeTab === 'all' || opp.type === activeTab
    let matchesLocation = true
    if (selectedLocation !== 'All Locations') {
      matchesLocation = selectedLocation === 'Remote' ? opp.isRemote : (!opp.isRemote && opp.location.toLowerCase().includes(selectedLocation.toLowerCase()))
    }
    const budgetRange = budgetRanges[selectedBudget]
    const matchesBudget = opp.budgetMin >= budgetRange.min && opp.budgetMin <= budgetRange.max
    return matchesSearch && matchesCategory && matchesType && matchesLocation && matchesBudget
  }), [opportunities, searchQuery, selectedCategory, activeTab, selectedLocation, selectedBudget])

  // Stats
  const totalCount = opportunities.length
  const gigCount = opportunities.filter(o => o.type === 'gig').length
  const jobCount = opportunities.filter(o => o.type === 'job').length
  const investCount = opportunities.filter(o => o.type === 'investment').length

  const animTotal = useCountUp(totalCount, 1200, heroInView)
  const animGig = useCountUp(gigCount, 1200, heroInView)
  const animJob = useCountUp(jobCount, 1200, heroInView)
  const animInvest = useCountUp(investCount, 1200, heroInView)

  const hasActiveFilters = selectedCategory !== 'All Categories' || selectedLocation !== 'All Locations' || selectedBudget !== 0 || searchQuery

  // Can the user post opportunities? Only authenticated non-creative users
  const canPost = isAuthenticated && role !== 'creative'

  return (
    <LandingAuthProvider>
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* ━━━ HERO ━━━ */}
      <motion.div
        ref={heroRef}
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 text-[10px] font-bold uppercase tracking-wider border">
                Marketplace
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
              Discover{' '}
              <span className="text-brand-dark dark:text-foreground">
                Opportunities
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">
              Find gigs, jobs, and investment opportunities tailored for creatives in Sierra Leone and beyond.
            </p>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15, ease }}
          >
            {[
              { label: 'Total Open', value: animTotal, color: 'text-brand-purple-600 dark:text-brand-400' },
              { label: 'Gigs', value: animGig, color: 'text-brand-purple-600 dark:text-brand-400' },
              { label: 'Jobs', value: animJob, color: 'text-brand-600 dark:text-brand-400' },
              { label: 'Investments', value: animInvest, color: 'text-brand-purple-600 dark:text-brand-400' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 text-center hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-colors"
              >
                <p className={cn('text-2xl sm:text-3xl font-bold', stat.color)} style={{ textShadow: '0 0 20px rgba(249,115,22,0.15)' }}>
                  {stat.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* CTA row */}
          <motion.div
            className="flex items-center gap-3 mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3, ease }}
          >
            {canPost && (
              <Button
                className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
                asChild
              >
                <Link href="/opportunities/create">
                  <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                  Post Opportunity
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={loadOpportunities}
              disabled={isLoading}
              className="rounded-full border border-border/50 bg-card/50 backdrop-blur-sm"
            >
              <HugeiconsIcon icon={Refresh01Icon} className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* ━━━ SEARCH + FILTERS ━━━ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-1">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
        >
          <SpotlightCard className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by title, skill, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-background border-border/60 text-base focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 rounded-full bg-background border-border/60 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-auto min-w-[130px] h-9 rounded-full bg-background border-border/60 text-xs">
                <HugeiconsIcon icon={Location01Icon} className="w-3 h-3 mr-1.5" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedBudget.toString()}
              onValueChange={(v) => setSelectedBudget(parseInt(v))}
            >
              <SelectTrigger className="w-auto min-w-[120px] h-9 rounded-full bg-background border-border/60 text-xs">
                <SelectValue placeholder="Budget" />
              </SelectTrigger>
              <SelectContent>
                {budgetRanges.map((range, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="h-9 px-3 rounded-full text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('All Categories')
                  setSelectedLocation('All Locations')
                  setSelectedBudget(0)
                }}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                Clear
              </motion.button>
            )}
          </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* ━━━ TYPE TABS ━━━ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {typeTabs.map((tab) => {
            const isActive = activeTab === tab.value
            const count = tab.value === 'all' ? totalCount : tab.value === 'gig' ? gigCount : tab.value === 'job' ? jobCount : investCount
            return (
              <motion.button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'text-white shadow-lg'
                    : 'text-muted-foreground bg-card/50 border border-border/50 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:text-foreground'
                )}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className={cn(
                      'absolute inset-0 rounded-full',
                      tab.color === 'orange' && 'bg-gradient-to-r from-brand-500 to-brand-purple-500',
                      tab.color === 'brandPurple' && 'bg-gradient-to-r from-brand-purple-500 to-brand-purple-400',
                      tab.color === 'brand' && 'bg-gradient-to-r from-brand-500 to-brand-400',
                    )}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {getTabIconEl(tab)}
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      isActive ? 'bg-white/20' : 'bg-muted'
                    )}>
                      {count}
                    </span>
                  )}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div ref={gridRef} className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Loading */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400 mb-3" />
            <p className="text-sm text-muted-foreground">Loading opportunities...</p>
          </div>
        ) : filteredOpportunities.length > 0 ? (
          <>
            {/* Results count */}
            <p className="text-xs text-muted-foreground mb-4 font-medium">
              Showing <span className="text-foreground font-bold">{filteredOpportunities.length}</span> opportunit{filteredOpportunities.length !== 1 ? 'ies' : 'y'}
              {hasActiveFilters && ' (filtered)'}
            </p>

            {/* Opportunity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredOpportunities.map((opp, i) => {
                  const accent = getTypeAccent(opp.type)
                  return (
                    <motion.div
                      key={opp.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={gridInView ? { opacity: 1, y: 0 } : {}}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.4), ease }}
                    >
                      <Link href={`/opportunities/${opp.id}`} className="block group">
                        <SpotlightCard className={cn(
                          'relative overflow-hidden',
                          'hover:shadow-xl hover:shadow-brand-500/5',
                          'transition-all duration-300',
                        )}>
                          <div className="p-5">
                            {/* Badges row */}
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className={cn(accent.bgLight, accent.text, accent.border, 'text-[10px] font-bold uppercase tracking-wider')}>
                                {getTypeIconEl(opp.type)}
                                {opp.type}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">{opp.category}</Badge>
                              {opp.experienceLevel && (
                                <Badge variant="outline" className="text-[10px] capitalize">{opp.experienceLevel}</Badge>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                              {opp.title}
                            </h3>

                            {/* Company */}
                            {opp.companyName && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <HugeiconsIcon icon={Building02Icon} className="w-3 h-3" />
                                {opp.companyName}
                              </p>
                            )}

                            {/* Description */}
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {opp.description}
                            </p>

                            {/* Skills */}
                            {opp.requiredSkills && opp.requiredSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {opp.requiredSkills.slice(0, 3).map((skill) => (
                                  <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground bg-muted/50">
                                    {skill}
                                  </span>
                                ))}
                                {opp.requiredSkills.length > 3 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground">
                                    +{opp.requiredSkills.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <HugeiconsIcon icon={Location01Icon} className="w-3 h-3" />
                                  {opp.isRemote ? 'Remote' : opp.location || 'N/A'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
                                  {formatDistanceToNow(opp.createdAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <HugeiconsIcon icon={UserGroupIcon} className="w-3 h-3" />
                                  {opp.applicationsCount}
                                </span>
                              </div>

                              {/* Budget badge */}
                              <span className="text-sm font-bold text-brand-purple-600 dark:text-brand-400">
                                ${opp.budgetMin.toLocaleString()}
                                {opp.budgetMax !== opp.budgetMin && (
                                  <span className="text-muted-foreground font-normal text-[10px]"> - ${opp.budgetMax.toLocaleString()}</span>
                                )}
                              </span>
                            </div>

                            {/* Hover arrow */}
                            <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                              <div className="w-8 h-8 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center">
                                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                              </div>
                            </div>
                          </div>
                        </SpotlightCard>
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* ━━━ EMPTY STATE ━━━ */
          <motion.div
            className="relative py-20 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-4 animate-float">
                <HugeiconsIcon icon={Briefcase01Icon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {hasActiveFilters ? 'No matches found' : 'No opportunities yet'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                {hasActiveFilters
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Be the first to post an opportunity for creatives!'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('All Categories')
                      setSelectedLocation('All Locations')
                      setSelectedBudget(0)
                      setActiveTab('all')
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
                {canPost && (
                  <Button className="bg-brand-500 hover:bg-brand-600 rounded-full shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                    <Link href="/opportunities/create">
                      <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                      Post Opportunity
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ━━━ CTA for unauthenticated users ━━━ */}
      {!isAuthenticated && (
        <div className="relative overflow-hidden mt-16">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 via-brand-purple-500/5 to-brand-600/10" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Ready to apply or post opportunities?
            </h3>
            <p className="text-muted-foreground mb-8 text-sm sm:text-base">
              Sign up to apply for gigs, jobs, and investments. Or post your own opportunities to find talented creatives.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" className="rounded-full px-6" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button size="lg" className="bg-brand-500 hover:bg-brand-600 rounded-full px-8 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                <Link href="/sign-up">
                  Get Started Free
                  <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Creatuno. Empowering Local Talent through Digital Visibility.</p>
        </div>
      </footer>
    </div>
    </LandingAuthProvider>
  )
}
