'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Briefcase01Icon, Cancel01Icon, Clock01Icon, Folder01Icon, LayoutGridIcon, LinkSquare01Icon, Menu01Icon, Loading02Icon, Message01Icon, Search01Icon, UserGroupIcon, UserIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { cn } from '@/lib/utils'
import SpotlightCard from '@/components/SpotlightCard'
import { OfflineBanner } from '@/components/shared/offline-banner'

// ─── Types ──────────────────────────────────────────────────────────────────

type SearchCategory = 'all' | 'portfolios' | 'people' | 'opportunities' | 'posts'

interface SearchResult {
  id: string
  type: 'portfolio' | 'user' | 'opportunity' | 'post'
  title: string
  subtitle?: string
  description?: string
  imageUrl?: string
  link: string
  tags?: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

const TABS: { key: SearchCategory; label: string }[] = [
  { key: 'all', label: 'All Results' },
  { key: 'people', label: 'People' },
  { key: 'portfolios', label: 'Portfolios' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'posts', label: 'Community Posts' },
]

const QUICK_LINKS = [
  { label: 'Portfolios', href: '/dashboard/portfolios', icon: Folder01Icon, color: 'from-brand-purple-600/20 via-brand-purple-500/10 to-transparent', text: 'text-brand-purple-600 dark:text-brand-400' },
  { label: 'Mentors', href: '/mentorship', icon: UserGroupIcon, color: 'from-brand-600/20 via-brand-500/10 to-transparent', text: 'text-brand-600 dark:text-brand-400' },
  { label: 'Opportunities', href: '/opportunities', icon: Briefcase01Icon, color: 'from-brand-purple-600/20 via-brand-purple-500/10 to-transparent', text: 'text-brand-purple-600 dark:text-brand-400' },
  { label: 'Village Square', href: '/feed', icon: Message01Icon, color: 'from-brand-600/20 via-brand-500/10 to-transparent', text: 'text-brand-purple-600 dark:text-brand-400' },
]

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
const fadeUp = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeAccent(type: SearchResult['type']) {
  switch (type) {
    case 'portfolio': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/10 to-transparent' }
    case 'user': return { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', bgLight: 'bg-brand-500/10', border: 'border-brand-500/30', gradient: 'from-brand-600/30 via-brand-500/10 to-transparent' }
    case 'opportunity': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/10 to-transparent' }
    case 'post': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-500', bgLight: 'bg-brand-purple-500/10 dark:bg-brand-500/10', border: 'border-brand-purple-500/30 dark:border-brand-500/30', gradient: 'from-brand-600/30 via-brand-500/10 to-transparent' }
  }
}

function getTypeIconEl(type: SearchResult['type'], className?: string) {
  const cn = className ?? 'w-5 h-5'
  switch (type) {
    case 'portfolio': return <HugeiconsIcon icon={Folder01Icon} className={cn} />
    case 'user': return <HugeiconsIcon icon={UserIcon} className={cn} />
    case 'opportunity': return <HugeiconsIcon icon={Briefcase01Icon} className={cn} />
    case 'post': return <HugeiconsIcon icon={Message01Icon} className={cn} />
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isOnline, isHydrated } = useNetworkStatus()
  const inputRef = useRef<HTMLInputElement>(null)
  const initialQuery = searchParams.get('q') || ''
  
  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchCategory>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('creatuno_recent_searches')
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Perform search (with offline cache per query)
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); return }
    setIsSearching(true)

    const cacheKey = `search:${searchQuery.trim().toLowerCase()}`

    try {
      // Try cache first when offline
      if (!navigator.onLine) {
        try {
          const { getCachedData } = await import('@/lib/offline/indexed-db')
          const cached = await getCachedData('api', cacheKey)
          if (cached?.payload) {
            setResults(cached.payload as SearchResult[])
            setIsSearching(false)
            return
          }
        } catch {}
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])

        // Cache results for offline
        try {
          const { cacheData } = await import('@/lib/offline/indexed-db')
          await cacheData('api', cacheKey, { payload: data.results || [] }, 5 * 60 * 1000)
        } catch {}
      } else { setResults([]) }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally { setIsSearching(false) }
  }, [])

  // Search on initial load if query param exists
  useEffect(() => {
    if (initialQuery) performSearch(initialQuery)
  }, [initialQuery, performSearch])

  // Live search: debounce as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Save recent search
  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('creatuno_recent_searches', JSON.stringify(updated))
  }

  // Remove a single recent search
  const removeRecentSearch = (term: string) => {
    const updated = recentSearches.filter(s => s !== term)
    setRecentSearches(updated)
    localStorage.setItem('creatuno_recent_searches', JSON.stringify(updated))
  }

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
      performSearch(query)
      saveRecentSearch(query.trim())
    }
  }

  // Trigger search from recent pill
  const searchFromPill = (term: string) => {
    setQuery(term)
    performSearch(term)
    router.push(`/search?q=${encodeURIComponent(term)}`)
    saveRecentSearch(term)
  }

  // ─── Filtered / Categorized Results ─────────────────────────────────────

  const filteredResults = activeTab === 'all' 
    ? results 
    : results.filter(r => {
        switch (activeTab) {
          case 'portfolios': return r.type === 'portfolio'
          case 'people': return r.type === 'user'
          case 'opportunities': return r.type === 'opportunity'
          case 'posts': return r.type === 'post'
          default: return true
        }
      })

  const counts: Record<SearchCategory, number> = {
    all: results.length,
    portfolios: results.filter(r => r.type === 'portfolio').length,
    people: results.filter(r => r.type === 'user').length,
    opportunities: results.filter(r => r.type === 'opportunity').length,
    posts: results.filter(r => r.type === 'post').length,
  }

  // Separate results by type for two-column layout (used in "all" tab)
  const userResults = results.filter(r => r.type === 'user')
  const portfolioResults = results.filter(r => r.type === 'portfolio')
  const postResults = results.filter(r => r.type === 'post')
  const opportunityResults = results.filter(r => r.type === 'opportunity')

  const hasQuery = !!query.trim()

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <OfflineBanner message="You're offline — showing cached results" />

      {/* ━━━ HERO HEADER ━━━ */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          {/* Title */}
          <motion.h1
            className="text-center text-3xl sm:text-4xl md:text-5xl font-bold leading-tight"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            <span className="text-brand-dark dark:text-foreground">
              Search Creatuno
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-center text-muted-foreground mt-3 text-sm sm:text-base max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
          >
            Search creators, portfolios, opportunities, community posts, mentors, employers, and investors from across the region.
          </motion.p>

          {/* ── Search Bar ── */}
          <motion.div
            className="mt-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
          >
        <form onSubmit={handleSearch}>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500/20 to-brand-purple-500/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
                <div className="relative flex items-center bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden group-focus-within:border-brand-500/40 transition-colors">
                  <HugeiconsIcon icon={Search01Icon} className="w-5 h-5 text-muted-foreground ml-5 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for creators, projects, or inspiration..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-4 sm:py-5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
                  <AnimatePresence>
            {query && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                        onClick={() => { setQuery(''); setResults([]) }}
                        className="p-1.5 mr-2 rounded-full hover:bg-muted transition-colors"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 text-muted-foreground" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 mr-4 text-[10px] font-mono text-muted-foreground bg-muted/60 rounded-md border border-border/50">
                    Ctrl K
                  </kbd>
                </div>
          </div>
        </form>

            {/* Offline indicator */}
            <motion.div
              className="flex items-center justify-center gap-2 mt-3 text-[11px] text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <span className={cn(
                'w-2 h-2 rounded-full',
                !isHydrated ? 'bg-muted-foreground/40' : isOnline ? 'bg-green-500' : 'bg-brand-500'
              )} />
              {!isHydrated ? 'Checking connection...' : isOnline ? 'Online: Live results' : 'Offline-ready: Cached results available'}
            </motion.div>
          </motion.div>
      </div>
      </motion.div>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {hasQuery ? (
          <>
            {/* ── Filter Tabs ── */}
            <motion.div
              className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="searchTab"
                        className="absolute inset-0 bg-brand-500 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {tab.label}
                      {counts[tab.key] > 0 && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none',
                          isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                        )}>
                          {counts[tab.key]}
                        </span>
                      )}
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>

            {/* ── Results ── */}
          {isSearching ? (
              /* Loading Skeletons */
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                <div className="hidden lg:block space-y-4">
                  {[1, 2, 3].map(i => (
                    <SpotlightCard key={i} className="p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted/60" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-24 bg-muted/60 rounded" />
                          <div className="h-3 w-32 bg-muted/40 rounded" />
                        </div>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <SpotlightCard key={i} className="overflow-hidden animate-pulse">
                      <div className="h-40 bg-muted/40" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 w-3/4 bg-muted/60 rounded" />
                        <div className="h-3 w-1/2 bg-muted/40 rounded" />
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
            </div>
          ) : filteredResults.length > 0 ? (
              activeTab === 'all' ? (
                /* ── Two-Column "All" Layout ── */
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

                  {/* Left Sidebar */}
                  <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">

                    {/* Top Creators */}
                    {userResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-foreground">Top Creators</h3>
                          {userResults.length > 3 && (
                            <button
                              onClick={() => setActiveTab('people')}
                              className="text-[11px] font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors"
                            >
                              View all
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {userResults.slice(0, 4).map((u, i) => (
                            <motion.div
                              key={u.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: i * 0.05, ease }}
                            >
                              <Link
                                href={u.link}
                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
                              >
                                <Avatar className="w-10 h-10 ring-2 ring-border/50">
                                  <AvatarImage src={u.imageUrl} />
                                  <AvatarFallback className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 text-green-600 text-xs font-bold">
                                    {u.title.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{u.title}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{u.subtitle}</p>
                                </div>
                                <HugeiconsIcon icon={LinkSquare01Icon} className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Latest Posts */}
                    {postResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15, ease }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-foreground">Latest Posts</h3>
                          {postResults.length > 3 && (
                            <button
                              onClick={() => setActiveTab('posts')}
                              className="text-[11px] font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors"
                            >
                              View all
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {postResults.slice(0, 3).map((p, i) => (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: 0.1 + i * 0.05, ease }}
                            >
                              <Link
                                href={p.link}
                                className="block p-3 rounded-xl border border-border/40 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:bg-muted/30 transition-all"
                              >
                                <p className="text-[11px] font-medium text-brand-purple-600 dark:text-brand-400 mb-1">{p.subtitle} posted</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{p.title}</p>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Main Content Area */}
                  <div className="space-y-8">
                    {/* Portfolios & Projects */}
                    {portfolioResults.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-foreground">Portfolios &amp; Projects</h3>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewMode('grid')}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                viewMode === 'grid' ? 'bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              )}
                            >
                              <HugeiconsIcon icon={LayoutGridIcon} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setViewMode('list')}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                viewMode === 'list' ? 'bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              )}
                            >
                              <HugeiconsIcon icon={Menu01Icon} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {viewMode === 'grid' ? (
                            <motion.div
                              key="grid"
                              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                              variants={stagger}
                              initial="hidden"
                              animate="visible"
                              exit={{ opacity: 0 }}
                            >
                              {portfolioResults.map((p) => (
                                  <motion.div key={p.id} variants={fadeUp}>
                                    <Link href={p.link} className="group block">
                                      <SpotlightCard className="overflow-hidden hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                                        {/* Thumbnail */}
                                        <div className="h-40 sm:h-44 bg-muted relative">
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-4xl sm:text-5xl font-black text-white/5">{p.title[0]?.toUpperCase()}</span>
                                          </div>
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </div>
                                        {/* Info */}
                                        <div className="p-4">
                                          <h4 className="font-semibold text-foreground text-sm truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
                                            {p.title}
                                          </h4>
                                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                            {p.subtitle}
                                          </p>
                                          {p.tags && p.tags.length > 0 && (
                                            <div className="flex items-center gap-2 mt-2">
                                              {p.tags.slice(0, 2).map(tag => (
                                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </SpotlightCard>
                                    </Link>
                                  </motion.div>
                              ))}
                            </motion.div>
                          ) : (
                            <motion.div
                              key="list"
                              className="space-y-2"
                              variants={stagger}
                              initial="hidden"
                              animate="visible"
                              exit={{ opacity: 0 }}
                            >
                              {portfolioResults.map((p) => (
                                <motion.div key={p.id} variants={fadeUp}>
                                  <Link href={p.link} className="group block">
                                    <div className="flex items-center gap-4 p-3 rounded-xl border border-border/40 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:bg-muted/30 transition-all">
                                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-purple-500/20 to-brand-purple-400/5 flex items-center justify-center flex-shrink-0">
                                        <HugeiconsIcon icon={Folder01Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{p.title}</h4>
                                        <p className="text-[11px] text-muted-foreground truncate">{p.subtitle}</p>
                                      </div>
                                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                                    </div>
                                  </Link>
                                </motion.div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Opportunities */}
                    {opportunityResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
                        transition={{ duration: 0.5, ease }}
                      >
                        <h3 className="text-sm font-bold text-foreground mb-4">Opportunities</h3>
                        <div className="space-y-2">
                          {opportunityResults.map((o, i) => {
                            const accent = getTypeAccent(o.type)
                            return (
                              <motion.div
                                key={o.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: i * 0.05, ease }}
                              >
                                <Link href={o.link} className="group block">
                                  <div className="relative flex items-center gap-4 p-3.5 rounded-xl border border-border/40 hover:border-purple-500/30 hover:bg-muted/30 transition-all overflow-hidden">
                                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', accent.bgLight)}>
                                      <HugeiconsIcon icon={Briefcase01Icon} className={cn('w-4 h-4', accent.text)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{o.title}</h4>
                                      <p className="text-[11px] text-muted-foreground truncate">{o.subtitle}</p>
                                    </div>
                                    {o.tags && o.tags.length > 0 && (
                                      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                                        {o.tags.map(tag => (
                                          <Badge key={tag} variant="outline" className={cn('text-[10px] capitalize', accent.bgLight, accent.text, accent.border)}>{tag}</Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              </motion.div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Single Category View ── */
                <motion.div
                  className="space-y-3"
                  variants={stagger}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredResults.map((result) => {
                    const accent = getTypeAccent(result.type)
                    return (
                      <motion.div key={`${result.type}-${result.id}`} variants={fadeUp} whileHover={{ y: -2 }}>
                        <Link href={result.link} className="group block">
                          <SpotlightCard className={cn(
                            'relative flex items-start gap-4 p-4 overflow-hidden transition-all duration-300',
                            'hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5'
                          )}>
                            {result.type === 'user' ? (
                              <Avatar className="w-12 h-12 ring-2 ring-border/50 flex-shrink-0">
                                <AvatarImage src={result.imageUrl} />
                                <AvatarFallback className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 text-green-600 text-xs font-bold">
                                  {result.title.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', accent.bgLight)}>
                                {getTypeIconEl(result.type, cn('w-5 h-5', accent.text))}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wider', accent.bgLight, accent.text, accent.border)}>
                              {result.type}
                            </Badge>
                          </div>
                              <h4 className="font-semibold text-foreground truncate text-sm group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{result.title}</h4>
                              {result.subtitle && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{result.subtitle}</p>}
                              {result.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{result.description}</p>}
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                  {result.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </SpotlightCard>
                </Link>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )
            ) : (
              /* ── No Results ── */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="text-center py-16 rounded-2xl border-2 border-dashed border-border/50"
              >
                <div className="animate-float inline-block mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center">
                    <HugeiconsIcon icon={Search01Icon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
                  </div>
            </div>
                <h3 className="text-lg font-bold text-foreground mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Try different keywords, check your spelling, or browse categories below
                </p>
                <Button className="bg-brand-500 hover:bg-brand-600 rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                  <Link href="/opportunities">
                    Browse Opportunities
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </motion.div>
          )}
        </>
      ) : (
          /* ━━━ PRE-SEARCH STATE ━━━ */
          <div className="max-w-3xl mx-auto">

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4, ease }}
              >
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Recent Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                {recentSearches.map((search) => (
                      <motion.div
                    key={search}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => searchFromPill(search)}
                          className="group flex items-center gap-2 px-3.5 py-2 rounded-full bg-card/50 border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all"
                        >
                          <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
                    {search}
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); removeRecentSearch(search) }}
                            className="ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="w-2.5 h-2.5" />
                          </span>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
              </div>
              </motion.div>
          )}

          {/* Quick Links */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {QUICK_LINKS.map((link) => (
                  <motion.div key={link.label} variants={fadeUp}>
                    <Link href={link.href} className="group block">
                      <SpotlightCard className="overflow-hidden hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300">
                        <div className={cn('h-24 bg-gradient-to-br flex items-center justify-center relative', link.color)}>
                          <HugeiconsIcon icon={link.icon} className={cn('w-8 h-8 transition-transform duration-300 group-hover:scale-110', link.text)} />
                        </div>
                        <div className="p-4 text-center">
                          <p className="text-sm font-medium text-foreground">{link.label}</p>
                        </div>
                      </SpotlightCard>
            </Link>
                  </motion.div>
              ))}
            </motion.div>
          </div>
      )}
      </div>
    </div>
  )
}
