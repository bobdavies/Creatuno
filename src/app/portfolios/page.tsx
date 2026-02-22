'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Cancel01Icon, FolderOpenIcon, Loading02Icon, Search01Icon, SlidersHorizontalIcon, StarIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LandingHeader } from '@/components/landing/landing-header'
import { LandingAuthProvider } from '@/components/landing/landing-auth-context'
import TiltedCard from '@/components/TiltedCard'
import { cn } from '@/lib/utils'
import { useCachedFetch } from '@/hooks/use-cached-fetch'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PublicPortfolio {
  id: string
  title: string
  tagline: string | null
  description: string | null
  slug: string
  viewCount: number
  isFeatured: boolean
  createdAt: string
  user: {
    fullName: string
    username: string
    avatarUrl: string | null
    skills: string[]
  }
  firstImage: string | null
  projectCount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'graphic-design', label: 'Graphic Design' },
  { key: 'web-development', label: 'Web Dev' },
  { key: 'photography', label: 'Photography' },
  { key: 'illustration', label: 'Illustration' },
  { key: 'ui-ux', label: 'UI/UX' },
  { key: 'video', label: 'Video' },
  { key: 'animation', label: 'Animation' },
  { key: 'writing', label: 'Writing' },
  { key: 'music', label: 'Music' },
] as const

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PortfolioDiscoveryPage() {
  const { data: portfolioData, isLoading } = useCachedFetch<{ portfolios: PublicPortfolio[] }>(
    '/api/portfolios/public',
    { ttlMs: 5 * 60 * 1000 }
  )
  const portfolios = portfolioData?.portfolios ?? []
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortBy, setSortBy] = useState('recent')

  // Filter and sort
  const filteredPortfolios = (() => {
    let results = [...portfolios]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      results = results.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.user.fullName.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tagline?.toLowerCase().includes(q) ||
        p.user.skills.some(s => s.toLowerCase().includes(q))
      )
    }

    if (activeCategory !== 'all') {
      const cat = CATEGORIES.find(c => c.key === activeCategory)
      if (cat) {
        results = results.filter(p =>
          p.user.skills.some(s => s.toLowerCase().includes(cat.label.toLowerCase()))
        )
      }
    }

    switch (sortBy) {
      case 'popular': results.sort((a, b) => b.viewCount - a.viewCount); break
      case 'featured': results.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)); break
      default: results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    return results
  })()

  return (
    <LandingAuthProvider>
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* ━━━ HERO ━━━ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-500/80 dark:text-brand-400/80">Explore</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              <span className="text-brand-dark dark:text-foreground">
                Discover Creative Portfolios
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-sm sm:text-base">
              Browse portfolios from talented creatives across Sierra Leone. Find inspiration, discover talent, and connect with creators.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                placeholder="Search by name, skill, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-13 pl-12 pr-10 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40 focus:ring-2 focus:ring-brand-purple-500/10 dark:ring-brand-500/10 text-sm transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Category Tabs + Sort */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key
              return (
                <motion.button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    'relative px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                    isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="portfolioCat"
                      className="absolute inset-0 bg-brand-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat.label}</span>
                </motion.button>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{filteredPortfolios.length} found</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs rounded-full border-border/50">
                <HugeiconsIcon icon={SlidersHorizontalIcon} className="w-3 h-3 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Portfolio Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted/40" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-muted/60" /><div className="space-y-1.5 flex-1"><div className="h-3.5 w-28 bg-muted/60 rounded" /><div className="h-3 w-20 bg-muted/40 rounded" /></div></div>
                  <div className="h-3 w-full bg-muted/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPortfolios.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPortfolios.map((portfolio, index) => (
              <motion.div
                key={portfolio.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.05, ease }}
              >
                <Link href={`/portfolio/${portfolio.user.username}/${portfolio.slug}`} className="block group">
                  <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 h-full">
                    {/* Thumbnail */}
                    <div className="aspect-video relative overflow-hidden">
                      {portfolio.firstImage ? (
                        <div className="w-full h-full">
                          <TiltedCard
                            imageSrc={portfolio.firstImage}
                            altText={portfolio.title}
                            captionText="View Portfolio"
                            containerHeight="100%"
                            containerWidth="100%"
                            imageHeight="100%"
                            imageWidth="100%"
                            scaleOnHover={1.05}
                            rotateAmplitude={10}
                            showMobileWarning={false}
                            showTooltip={false}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-500/20 via-brand-purple-500/10 to-transparent flex items-center justify-center">
                          <span className="text-5xl font-bold text-brand-purple-400/30 dark:text-brand-400/30">{portfolio.title.charAt(0)}</span>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center pointer-events-none">
                        <span className="text-white font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5">
                          <HugeiconsIcon icon={ViewIcon} className="w-4 h-4" />
                          View Portfolio
                        </span>
                      </div>
                      {portfolio.isFeatured && (
                        <Badge className="absolute top-3 left-3 bg-brand-500/90 backdrop-blur-sm text-[10px] font-bold">
                          <HugeiconsIcon icon={StarIcon} className="w-3 h-3 mr-1 fill-current" />
                          Featured
                        </Badge>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="w-9 h-9 ring-2 ring-border/50">
                          <AvatarImage src={portfolio.user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                            {portfolio.user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
                            {portfolio.title}
                          </h3>
                          <p className="text-[11px] text-muted-foreground truncate">{portfolio.user.fullName}</p>
                        </div>
                      </div>

                      {portfolio.tagline && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{portfolio.tagline}</p>
                      )}

                      {/* Skills */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {portfolio.user.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-[9px] px-1.5 py-0 border-border/50 text-muted-foreground">{skill}</Badge>
                        ))}
                        {portfolio.user.skills.length > 3 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border/50 text-muted-foreground">+{portfolio.user.skills.length - 3}</Badge>
                        )}
                      </div>

                      {/* Footer Stats */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />{portfolio.viewCount} views</span>
                        <span>{portfolio.projectCount} project{portfolio.projectCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="text-center py-16 rounded-2xl border-2 border-dashed border-border/50"
          >
            <div className="animate-float inline-block mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={FolderOpenIcon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">No portfolios found</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Try adjusting your search or filters to find what you are looking for.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => { setSearchQuery(''); setActiveCategory('all'); setSortBy('recent') }}>
              Clear All Filters
            </Button>
          </motion.div>
        )}
      </div>

      {/* ━━━ CTA ━━━ */}
      <div className="relative overflow-hidden mt-12">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 via-brand-purple-500/5 to-brand-600/10" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Ready to showcase your work?</h3>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base">
            Create your portfolio in minutes and reach thousands of potential clients and employers.
          </p>
          <Button size="lg" className="bg-brand-500 hover:bg-brand-600 rounded-full px-8 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
            <Link href="/sign-up">
              Create Your Portfolio
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Creatuno. Empowering Local Talent through Digital Visibility.</p>
        </div>
      </footer>
    </div>
    </LandingAuthProvider>
  )
}
