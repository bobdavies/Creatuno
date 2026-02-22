'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, AnalyticsUpIcon, ArrowRight01Icon, Briefcase01Icon, Clock01Icon, CloudIcon, CloudLoadingIcon, Edit01Icon, GlobeIcon, LinkSquare01Icon, Loading02Icon, Location01Icon, LockIcon, SparklesIcon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { MdBolt } from 'react-icons/md'
import { motion, useInView } from 'motion/react'
import AnimatedContent from '@/components/AnimatedContent'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { offlineDB } from '@/lib/offline/indexed-db'
import { getOfflineImageUrl } from '@/lib/offline/image-compressor'
import { formatDistanceToNow } from '@/lib/format-date'
import { useSession } from '@/components/providers/user-session-provider'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import type { OfflinePortfolio } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  portfolioViews: number
  activeApplications: number
  totalEarnings: number
}

interface DisplayPortfolio {
  localId: string
  serverId?: string
  title: string
  tagline?: string
  isPublic: boolean
  updatedAt: string
  isSynced: boolean
  viewCount: number
  thumbnailUrl?: string
}

interface Opportunity {
  id: string
  title: string
  type: string
  category: string
  budgetMin: number
  budgetMax: number
  currency: string
  deadline: string
  isRemote: boolean
  location: string
  applicationsCount: number
  author: { fullName: string; avatarUrl: string | null }
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

interface MentorshipRequest {
  id: string
  status: string
  skills_to_develop: string[]
  mentor?: { full_name: string; avatar_url: string; skills: string[] }
}

// ─── Animation Config ─────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

// ─── Count-Up Hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, isActive = true) {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || target === 0) {
      setValue(target)
      return
    }
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (progress < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [target, duration, isActive])

  return value
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser()
  const { userId } = useSession()

  // Cached data fetching
  const { data: statsData, isLoading: isLoadingStats } = useCachedFetch<UserStats>(
    '/api/stats/user', { ttlMs: 5 * 60 * 1000 }
  )
  const stats = statsData ?? { portfolioViews: 0, activeApplications: 0, totalEarnings: 0 }

  const { data: oppsData, isLoading: isLoadingOpps } = useCachedFetch<{ opportunities: Opportunity[] }>(
    '/api/opportunities', { ttlMs: 3 * 60 * 1000 }
  )
  const opportunities = (oppsData?.opportunities ?? []).slice(0, 5)

  const { data: notifsData, isLoading: isLoadingNotifs } = useCachedFetch<{ notifications: Notification[] }>(
    '/api/notifications', { ttlMs: 2 * 60 * 1000 }
  )
  const notifications = (notifsData?.notifications ?? []).slice(0, 5)

  const { data: mentorshipData, isLoading: isLoadingMentorship } = useCachedFetch<{ requests: MentorshipRequest[] }>(
    '/api/mentorship', { ttlMs: 5 * 60 * 1000 }
  )
  const mentorship = (mentorshipData?.requests ?? []).find(r => r.status === 'accepted') ?? null

  const [portfolios, setPortfolios] = useState<DisplayPortfolio[]>([])
  const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(true)

  // Stats refs for count-up
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-50px' })

  const viewsCount = useCountUp(stats.portfolioViews, 1500, statsInView && !isLoadingStats)
  const appsCount = useCountUp(stats.activeApplications, 1200, statsInView && !isLoadingStats)
  const earningsCount = useCountUp(stats.totalEarnings, 1800, statsInView && !isLoadingStats)

  // Portfolios (offline-first merge)
  useEffect(() => {
    async function loadPortfolios() {
      if (!userId) { setIsLoadingPortfolios(false); return }
      try {
        const [offlineData, serverRes] = await Promise.all([
          offlineDB.getPortfoliosByUser(userId).catch(() => [] as OfflinePortfolio[]),
          fetch('/api/portfolios').then(r => r.ok ? r.json() : { portfolios: [] }).catch(() => ({ portfolios: [] })),
        ])
        const serverPortfolios = serverRes.portfolios || []
        const mergedMap = new Map<string, DisplayPortfolio>()

        for (const p of offlineData) {
          const d = p.data as Record<string, unknown>
          mergedMap.set(p.id || p.localId, {
            localId: p.localId,
            serverId: p.id && !p.id.startsWith('local_') ? p.id : undefined,
            title: (d.title as string) || 'Untitled',
            tagline: d.tagline as string | undefined,
            isPublic: (d.is_public as boolean) ?? true,
            updatedAt: (d.updated_at as string) || new Date(p.lastModified).toISOString(),
            isSynced: p.syncStatus === 'synced',
            viewCount: (d.view_count as number) || 0,
          })
        }
        for (const p of serverPortfolios) {
          mergedMap.set(p.id, {
            localId: mergedMap.get(p.id)?.localId || p.slug || p.id,
            serverId: p.id,
            title: p.title || 'Untitled',
            tagline: p.tagline,
            isPublic: p.is_public ?? true,
            updatedAt: p.updated_at,
            isSynced: true,
            viewCount: p.view_count || 0,
          })
        }

        // Build thumbnail map from offline project images
        const thumbs: Record<string, string> = {}
        for (const p of offlineData) {
          const key = p.id || p.localId
          const projectsLocal = await offlineDB.getProjectsByPortfolio(p.localId).catch(() => [])
          const projectsById = p.id ? await offlineDB.getProjectsByPortfolio(p.id).catch(() => []) : []
          const allProjects = projectsLocal.length >= projectsById.length ? projectsLocal : projectsById
          for (const proj of allProjects) {
            if (proj.images?.length > 0) {
              try {
                thumbs[key] = getOfflineImageUrl(proj.images[0])
              } catch {
                // ignore if image blob is unavailable
              }
              break
            }
          }
        }

        const sorted = Array.from(mergedMap.values())
          .map(p => ({ ...p, thumbnailUrl: thumbs[p.serverId || p.localId] }))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 6)
        setPortfolios(sorted)
      } catch { /* ignore */ }
      finally { setIsLoadingPortfolios(false) }
    }
    if (userId) loadPortfolios()
  }, [userId])

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      portfolios.forEach(p => {
        if (p.thumbnailUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(p.thumbnailUrl)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const deadlineCountdown = useCallback((deadline: string) => {
    const d = new Date(deadline)
    const now = new Date()
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Closed'
    if (days === 0) return 'Today'
    if (days === 1) return '1 day left'
    return `${days} days left`
  }, [])

  const notifDotColor = (type: string) => {
    if (type.includes('accept')) return 'bg-green-500'
    if (type.includes('reject') || type.includes('decline')) return 'bg-red-500'
    if (type.includes('mentor')) return 'bg-brand-purple-500'
    return 'bg-brand-500'
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">

      {/* ━━━ HERO GREETING ━━━ */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <p className="text-xs sm:text-sm text-brand-purple-600 dark:text-brand-400 font-medium tracking-wider uppercase mb-3">
              {currentDate}
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Welcome back,{' '}
              <span className="text-brand-dark dark:text-foreground">
                {user?.firstName || 'Creative'}
              </span>
        </h1>
          </motion.div>
          <motion.p
            className="text-muted-foreground mt-4 text-sm sm:text-base max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
          >
          Here&apos;s what&apos;s new
          </motion.p>
          {/* Role badge subline */}
          <motion.div
            className="flex items-center gap-2 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.4 }}
          >
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-widest text-brand-purple-500 dark:text-brand-400/70">Creative</span>
            <span className="text-xs text-muted-foreground/50">&#183;</span>
            <span className="text-xs text-muted-foreground/70 italic">Your workspace</span>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {/* ━━━ ANIMATED STATS STRIP ━━━ */}
        <motion.div
          ref={statsRef}
          className="relative mb-14 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease }}
        >
          <SpotlightCard className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
            {[
              { label: 'Portfolio Views', micro: 'TOTAL', value: viewsCount, format: (v: number) => v.toLocaleString() },
              { label: 'Active Applications', micro: 'ACTIVE', value: appsCount, format: (v: number) => String(v) },
              { label: 'Total Earnings', micro: 'LIFETIME', value: earningsCount, format: (v: number) => `$${v.toLocaleString()}` },
            ].map((stat) => (
              <div key={stat.label} className="p-4 sm:p-6 text-center">
                {isLoadingStats ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-brand-purple-600 dark:text-brand-400 mx-auto" />
                ) : (
                  <>
                    <p className="text-[9px] uppercase tracking-widest text-brand-purple-400 dark:text-brand-400/60 font-semibold mb-2">{stat.micro}</p>
                    <p
                      className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground"
                      style={{ textShadow: '0 0 25px rgba(249,115,22,0.2)' }}
                    >
                      {stat.format(stat.value)}
                    </p>
                    <hr className="mx-auto w-12 border-0 h-px bg-gradient-to-r from-transparent via-brand-500/20 to-transparent mt-3 mb-2" />
                  </>
                )}
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          </SpotlightCard>
        </motion.div>

        {/* ━━━ QUICK ACTIONS ━━━ */}
        <motion.div
          className="flex gap-3.5 mb-16 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease, delay: 0.1 }}
        >
          {[
            { label: 'New Portfolio', href: '/dashboard/portfolios/new', icon: Add01Icon },
            { label: 'Find Work', href: '/opportunities', icon: Briefcase01Icon, count: opportunities.length > 0 ? opportunities.length : undefined },
            { label: 'Find Mentor', href: '/mentorship', icon: UserGroupIcon },
            { label: 'Village Square', href: '/feed', icon: AnalyticsUpIcon },
          ].map((action) => (
            <motion.div key={action.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="snap-start">
              <Link
                href={action.href}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-card/60 backdrop-blur-sm border border-border/50 hover:border-brand-purple-500/50 dark:border-brand-500/50 hover:bg-gradient-to-r hover:from-brand-500/5 hover:to-brand-purple-500/5 hover:shadow-lg hover:shadow-brand-purple-500/10 dark:shadow-brand-500/10 transition-all duration-300 whitespace-nowrap"
              >
                <HugeiconsIcon icon={action.icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400 flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                {'count' in action && action.count && (
                  <span className="ml-1 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-brand-500/15 text-[10px] font-bold text-brand-purple-600 dark:text-brand-400 px-1.5">{action.count}</span>
                )}
          </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* ━━━ PORTFOLIO SHOWCASE ━━━ */}
        <AnimatedContent distance={60} direction="vertical" duration={0.7}>
          <section className="mb-16">
            <motion.div
              className="flex items-center justify-between mb-4 sm:mb-6"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
            <div>
              <div className="w-6 h-0.5 bg-brand-500 mb-3 rounded-full" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Creative Work</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Portfolios that showcase your talent</p>
            </div>
            <Link
              href="/dashboard/portfolios"
              className="text-sm text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 font-medium flex items-center gap-1 transition-colors"
            >
              View All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
          </Link>
          </motion.div>

          {isLoadingPortfolios ? (
            <div className="flex items-center justify-center py-16">
              <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-brand-purple-600 dark:text-brand-400" />
            </div>
          ) : portfolios.length === 0 ? (
            <motion.div
              className="text-center py-16 rounded-2xl border-2 border-dashed border-border/50"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <HugeiconsIcon icon={SparklesIcon} className="w-12 h-12 text-brand-purple-500/50 dark:text-brand-400/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Create portfolio</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                Create your first portfolio to share your work with the world
              </p>
              <Button className="bg-brand-500 hover:bg-brand-600" asChild>
                <Link href="/dashboard/portfolios/new">
                  <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                  Create Portfolio
          </Link>
        </Button>
            </motion.div>
          ) : (
            <>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
              >
                {portfolios.map((portfolio) => (
                    <motion.div
                      key={portfolio.serverId || portfolio.localId}
                      variants={fadeUp}
                      whileHover={{ y: -6, transition: { duration: 0.25 } }}
                      className="group relative"
                    >
                      <Link href={`/dashboard/portfolios/${portfolio.localId}/edit`} className="block">
                        <SpotlightCard className="overflow-hidden hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                          {/* Thumbnail area */}
                          <div className="h-44 sm:h-48 relative bg-muted overflow-hidden">
                            {portfolio.thumbnailUrl ? (
                              <Image
                                src={portfolio.thumbnailUrl}
                                alt={portfolio.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                unoptimized={portfolio.thumbnailUrl.startsWith('blob:')}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-7xl sm:text-8xl font-black text-foreground/[0.04] select-none">
                                  {portfolio.title.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {/* Status badges */}
                            <div className="absolute top-3 left-3 flex gap-1.5">
                              {portfolio.isPublic ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 backdrop-blur-sm text-[10px] font-medium text-green-400">
                                  <HugeiconsIcon icon={GlobeIcon} className="w-2.5 h-2.5" /> Public
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 backdrop-blur-sm text-[10px] font-medium text-muted-foreground">
                                  <HugeiconsIcon icon={LockIcon} className="w-2.5 h-2.5" /> Draft
                                </span>
                              )}
      </div>
                            <div className="absolute top-3 right-3">
                              {portfolio.isSynced ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 backdrop-blur-sm text-[10px] font-medium text-green-400">
                                  <HugeiconsIcon icon={CloudIcon} className="w-2.5 h-2.5" /> Synced
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 backdrop-blur-sm text-[10px] font-medium text-brand-600 dark:text-brand-400">
                                  <HugeiconsIcon icon={CloudLoadingIcon} className="w-2.5 h-2.5" /> Local
                                </span>
                              )}
                            </div>
                            {/* View count overlay */}
                            <div className="absolute bottom-3 left-3">
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-medium text-white/90">
                                <HugeiconsIcon icon={ViewIcon} className="w-2.5 h-2.5" /> {portfolio.viewCount} views
                              </span>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-dark text-sm font-medium bg-brand-500/80 backdrop-blur-sm px-4 py-2 rounded-full">
                                Open
                              </span>
                            </div>
                          </div>
                          {/* Info */}
                          <div className="p-4 sm:p-5">
                            <h3 className="font-semibold text-foreground truncate text-sm">{portfolio.title}</h3>
                            {portfolio.tagline && (
                              <p className="text-xs text-muted-foreground truncate mt-1">{portfolio.tagline}</p>
                            )}
                            <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <HugeiconsIcon icon={Edit01Icon} className="w-3 h-3" /> Edit portfolio
                              </span>
                              <span>Updated {formatDistanceToNow(portfolio.updatedAt)}</span>
                            </div>
                          </div>
                        </SpotlightCard>
                      </Link>
                    </motion.div>
                ))}
              </motion.div>

              {/* Create New CTA */}
              <motion.div
                className="mt-6"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <Link
                  href="/dashboard/portfolios/new"
                  className="block w-full p-4 rounded-2xl border-2 border-dashed border-brand-purple-500/30 dark:border-brand-500/30 hover:border-brand-500/60 hover:bg-brand-purple-500/5 dark:bg-brand-500/5 transition-all duration-300 text-center group"
                >
                  <HugeiconsIcon icon={Add01Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-brand-purple-600 dark:text-brand-400">Create New Portfolio</span>
                </Link>
              </motion.div>
            </>
          )}
          </section>
        </AnimatedContent>

        {/* ━━━ OPPORTUNITY FEED ━━━ */}
        <AnimatedContent distance={40} direction="vertical" reverse={true} duration={0.6}>
          <section className="mb-16">
            <motion.div
              className="flex items-center justify-between mb-4 sm:mb-6"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
            <div>
              <div className="w-6 h-0.5 bg-brand-500 mb-3 rounded-full" />
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Fresh Opportunities</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Latest gigs, jobs, and investment calls</p>
            </div>
            <Link
              href="/opportunities"
              className="text-sm text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 font-medium flex items-center gap-1 transition-colors"
            >
              Browse All <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          {isLoadingOpps ? (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-brand-purple-600 dark:text-brand-400" />
            </div>
          ) : opportunities.length === 0 ? (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <SpotlightCard className="text-center py-16">
              <HugeiconsIcon icon={Briefcase01Icon} className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No opportunities available right now. Check back soon!</p>
              </SpotlightCard>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
            >
              {opportunities.map((opp) => {
                const typeLC = opp.type?.toLowerCase() || ''
                const hoverTint = typeLC.includes('gig') ? 'hover:bg-brand-500/[0.03]'
                  : typeLC.includes('job') ? 'hover:bg-brand-purple-500/[0.03]'
                  : typeLC.includes('invest') || typeLC.includes('fund') ? 'hover:bg-green-500/[0.03]'
                  : 'hover:bg-brand-500/[0.03]'
                return (
                  <motion.div key={opp.id} variants={fadeUp}>
                    <Link
                      href={`/opportunities/${opp.id}`}
                      className="block group"
                    >
                      <SpotlightCard className={`p-5 hover:shadow-sm transition-all duration-300 ${hoverTint}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge className="text-[10px] bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 border uppercase font-bold tracking-wider">
                              {opp.type}
                            </Badge>
                            {opp.category && (
                              <Badge variant="secondary" className="text-[10px]">{opp.category}</Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-foreground text-sm group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors truncate">
                            {opp.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground flex-wrap">
                            {opp.author?.fullName && (
                              <span>by {opp.author.fullName}</span>
                            )}
                            {opp.budgetMin > 0 && (
                              <span className="font-medium text-foreground">
                                {opp.currency}{opp.budgetMin.toLocaleString()}{opp.budgetMax > opp.budgetMin ? ` - ${opp.currency}${opp.budgetMax.toLocaleString()}` : ''}
                              </span>
                            )}
                            {opp.isRemote && (
                              <span className="flex items-center gap-0.5"><HugeiconsIcon icon={Location01Icon} className="w-3 h-3" /> Remote</span>
                            )}
                            {opp.deadline && (
                              <span className="flex items-center gap-0.5">
                                <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" /> {deadlineCountdown(opp.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-muted-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                      </div>
                      </SpotlightCard>
                    </Link>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
          </section>
        </AnimatedContent>

        {/* ━━━ TWO-COLUMN: ACTIVITY + MENTORSHIP ━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 mb-16">

          {/* ── Activity Timeline ── */}
          <section className="lg:col-span-3">
            <motion.div
              className="mb-4 sm:mb-6"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="w-6 h-0.5 bg-brand-500 mb-3 rounded-full" />
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Recent Activity</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Your latest interactions and updates</p>
            </motion.div>

            {isLoadingNotifs ? (
              <div className="flex items-center justify-center py-12">
                <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-brand-purple-600 dark:text-brand-400" />
              </div>
            ) : notifications.length === 0 ? (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <SpotlightCard className="text-center py-16">
                  <MdBolt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity yet. Start applying for opportunities!</p>
                </SpotlightCard>
              </motion.div>
            ) : (
              <motion.div
                className="relative"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />

                <div className="space-y-4">
                  {notifications.map((notif) => {
                    const dotColor = notifDotColor(notif.type)
                    const ringColor = dotColor.replace('bg-', 'ring-').replace('500', '500/15')
                    return (
                      <motion.div
                        key={notif.id}
                        variants={fadeUp}
                        className="flex gap-4 pl-0"
                      >
                        {/* Dot with glow ring */}
                        <div className="relative flex-shrink-0 mt-1.5">
                          <div className={`w-[15px] h-[15px] rounded-full border-2 border-background ${dotColor} ring-4 ${ringColor}`} />
            </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-sm text-foreground leading-relaxed">{notif.message || notif.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {formatDistanceToNow(notif.created_at)} ago
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </section>

          {/* ── Mentorship Spotlight ── */}
          <section className="lg:col-span-2">
            <motion.div
              className="mb-4 sm:mb-6"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="w-6 h-0.5 bg-brand-500 mb-3 rounded-full" />
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Mentorship</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Guided growth from experts</p>
            </motion.div>

            {isLoadingMentorship ? (
              <div className="flex items-center justify-center py-12">
                <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-brand-purple-600 dark:text-brand-400" />
              </div>
            ) : mentorship && mentorship.mentor ? (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <SpotlightCard className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  {mentorship.mentor.avatar_url ? (
                    <img
                      src={mentorship.mentor.avatar_url}
                      alt={mentorship.mentor.full_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-brand-purple-500/30 dark:border-brand-500/30"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center border-2 border-brand-purple-500/30 dark:border-brand-500/30">
                      <HugeiconsIcon icon={UserGroupIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{mentorship.mentor.full_name}</p>
                    <p className="text-[10px] text-green-500 font-medium uppercase tracking-wider">Active Mentor</p>
                  </div>
                </div>
                {mentorship.skills_to_develop?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {mentorship.skills_to_develop.map(skill => (
                      <Badge key={skill} className="text-[10px] bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 border">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                  <Link href="/dashboard/mentor">
                    View Mentorship
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3 ml-1.5" />
                  </Link>
                </Button>
                </SpotlightCard>
              </motion.div>
            ) : (
              <motion.div
                className="rounded-2xl border-2 border-dashed border-border/40 p-6 text-center"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <HugeiconsIcon icon={UserGroupIcon} className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Find a Mentor</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Accelerate your growth with guidance from experienced creatives.
                </p>
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <Link href="/mentorship">
                    Browse Mentors <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3 ml-1.5" />
                  </Link>
                </Button>
              </motion.div>
            )}
          </section>
        </div>

        {/* ━━━ FOOTER CTA ━━━ */}
        <AnimatedContent
          distance={50}
          direction="horizontal"
          duration={0.8}
          className="relative overflow-hidden rounded-2xl mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/15 via-brand-purple-500/10 to-brand-400/5 pointer-events-none" />
          <div className="relative p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HugeiconsIcon icon={SparklesIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">Keep creating.</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">Your next opportunity is waiting. Stay inspired.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/feed">
                  Village Square <HugeiconsIcon icon={LinkSquare01Icon} className="w-3 h-3 ml-1.5" />
                </Link>
              </Button>
              <Button className="bg-brand-500 hover:bg-brand-600" size="sm" asChild>
                <Link href="/opportunities">
                  Find Work <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  )
}
