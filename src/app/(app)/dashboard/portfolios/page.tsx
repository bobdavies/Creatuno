'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon, CloudIcon, CloudLoadingIcon, Delete02Icon, Edit01Icon, GlobeIcon, Image01Icon, Loading02Icon, LockIcon, Share02Icon, SparklesIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MdBolt } from 'react-icons/md'
import { motion, useInView, AnimatePresence } from 'motion/react'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { offlineDB } from '@/lib/offline/indexed-db'
import { savePortfolioOffline, saveProjectOffline } from '@/lib/offline'
import { getOfflineImageUrl } from '@/lib/offline/image-compressor'
import { formatDistanceToNow } from '@/lib/format-date'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { useNetworkStatus } from '@/hooks'
import type { OfflinePortfolio } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayPortfolio {
  localId: string
  serverId?: string
  title: string
  tagline?: string
  description?: string
  isPublic: boolean
  updatedAt: string
  syncStatus: string
  thumbnailUrl?: string
}

// ─── Animation Config ─────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

// ─── Count-Up Hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, isActive = true) {
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
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [target, duration, isActive])

  return value
}

// ─── Transform Helper ─────────────────────────────────────────────────────────

function transformPortfolio(p: OfflinePortfolio): DisplayPortfolio {
  const data = p.data as Record<string, unknown>
  return {
    localId: p.localId,
    serverId: p.id || undefined,
    title: (data.title as string) || 'Untitled Portfolio',
    tagline: data.tagline as string | undefined,
    description: data.description as string | undefined,
    isPublic: (data.is_public as boolean) ?? true,
    updatedAt: (data.updated_at as string) || new Date(p.lastModified).toISOString(),
    syncStatus: p.syncStatus,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfoliosPage() {
  const router = useRouter()
  const { userId } = useSession()
  const { isOnline } = useNetworkStatus()
  const [portfolios, setPortfolios] = useState<DisplayPortfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({})

  // Stats refs
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-50px' })

  const totalProjects = Object.values(projectCounts).reduce((a, b) => a + b, 0)
  const publicCount = portfolios.filter(p => p.isPublic).length
  const syncedCount = portfolios.filter(p => p.syncStatus === 'synced').length

  const portfolioCountUp = useCountUp(portfolios.length, 1000, statsInView && !isLoading)
  const projectCountUp = useCountUp(totalProjects, 1200, statsInView && !isLoading)
  const publicCountUp = useCountUp(publicCount, 1000, statsInView && !isLoading)
  const syncedCountUp = useCountUp(syncedCount, 1000, statsInView && !isLoading)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (userId) {
      loadPortfolios()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadPortfolios() {
    if (!userId) return
    
    try {
      if (isOnline) {
        try {
          const response = await fetch('/api/portfolios')
          if (response.ok) {
            const data = await response.json()
            for (const serverPortfolio of data.portfolios || []) {
              const offlinePortfolio: OfflinePortfolio = {
                id: serverPortfolio.id,
                localId: serverPortfolio.id,
                userId: userId,
                data: {
                  title: serverPortfolio.title,
                  description: serverPortfolio.description,
                  tagline: serverPortfolio.tagline,
                  slug: serverPortfolio.slug,
                  is_public: serverPortfolio.is_public,
                  view_count: serverPortfolio.view_count || 0,
                  created_at: serverPortfolio.created_at,
                  updated_at: serverPortfolio.updated_at,
                },
                projects: [],
                syncStatus: 'synced',
                lastModified: new Date(serverPortfolio.updated_at).getTime(),
              }
              await savePortfolioOffline(offlinePortfolio)
              try {
                const projectsResponse = await fetch(`/api/projects?portfolio_id=${serverPortfolio.id}`)
                if (projectsResponse.ok) {
                  const projectsData = await projectsResponse.json()
                  for (const serverProject of projectsData.projects || []) {
                    await saveProjectOffline({
                      id: serverProject.id,
                      localId: serverProject.id,
                      portfolioId: serverPortfolio.id,
                      data: {
                        title: serverProject.title,
                        description: serverProject.description,
                        client_name: serverProject.client_name,
                        project_date: serverProject.project_date,
                        external_link: serverProject.external_link,
                        tags: serverProject.tags || [],
                        display_order: serverProject.display_order || 0,
                        created_at: serverProject.created_at,
                        updated_at: serverProject.updated_at,
                      },
                      images: (serverProject.images || []).map((url: string, idx: number) => ({
                        localId: `server_${serverProject.id}_${idx}`,
                        remoteUrl: url,
                        uploadStatus: 'uploaded' as const,
                      })),
                      syncStatus: 'synced',
                      lastModified: new Date(serverProject.updated_at).getTime(),
                    })
                  }
                }
              } catch {
                /* ignore project fetch errors */
              }
            }
          }
        } catch {
          /* ignore server errors, fall back to local */
        }
      }

      const userPortfolios = await offlineDB.getPortfoliosByUser(userId)

      const counts: Record<string, number> = {}
      const thumbs: Record<string, string> = {}
      for (const portfolio of userPortfolios) {
        const projectsLocal = await offlineDB.getProjectsByPortfolio(portfolio.localId)
        const projectsById = portfolio.id ? await offlineDB.getProjectsByPortfolio(portfolio.id) : []
        const allProjects = projectsLocal.length >= projectsById.length ? projectsLocal : projectsById
        counts[portfolio.localId] = allProjects.length

        // Find first project image for thumbnail
        for (const proj of allProjects) {
          if (proj.images?.length > 0) {
            try {
              thumbs[portfolio.localId] = getOfflineImageUrl(proj.images[0])
            } catch {
              // ignore if image blob is unavailable
            }
            break
          }
        }
      }

      const sorted = userPortfolios
        .map(p => ({ ...transformPortfolio(p), thumbnailUrl: thumbs[p.localId] }))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      setPortfolios(sorted)
      setProjectCounts(counts)
    } catch (error) {
      console.error('Error loading portfolios:', error)
      toast.error('Failed to load portfolios')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(localId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return
    }
    try {
      const portfolioToDelete = portfolios.find(p => p.localId === localId)
      if (isOnline && portfolioToDelete?.serverId) {
        try {
          await fetch(`/api/portfolios?id=${portfolioToDelete.serverId}`, { method: 'DELETE' })
        } catch { /* ignore */ }
      }
      await offlineDB.deletePortfolio(localId)
      setPortfolios(prev => prev.filter(p => p.localId !== localId))
      toast.success('Portfolio deleted')
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      toast.error('Failed to delete portfolio')
    }
  }

  // ─── Loading State ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 md:pb-8">
        <div className="flex items-center justify-center py-32">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          >
            <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 text-brand-purple-600 dark:text-brand-400" />
          </motion.div>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">

      {/* ━━━ HERO HEADER ━━━ */}
      <div className="relative overflow-hidden">
        {/* Gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Your{' '}
              <span className="text-brand-dark dark:text-foreground">
                Portfolios
              </span>
            </h1>
          </motion.div>
          <motion.p
            className="text-muted-foreground mt-4 text-sm sm:text-base max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.15 }}
          >
            {portfolios.length > 0 
              ? 'Showcase your creative work to the world. Each portfolio tells your story.'
              : 'Create your first portfolio and start showcasing your talent.'}
          </motion.p>
          {/* Role badge subline */}
          <motion.div
            className="flex items-center gap-2 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.3 }}
          >
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-widest text-brand-purple-500 dark:text-brand-400/70">Creative Studio</span>
            <span className="text-xs text-muted-foreground/50">&#183;</span>
            <span className="text-xs text-muted-foreground/70 italic">
              {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}
            </span>
          </motion.div>
          {/* CTA inside hero */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Button className="bg-brand-500 hover:bg-brand-600 px-6 py-2.5 text-sm shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
          <Link href="/dashboard/portfolios/new">
            <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
            New Portfolio
          </Link>
        </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {/* ━━━ STATS STRIP ━━━ */}
        {portfolios.length > 0 && (
          <motion.div
            ref={statsRef}
            className="relative mb-14 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease }}
          >
            <SpotlightCard className="overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/50">
              {[
                { micro: 'TOTAL', value: portfolioCountUp, label: 'Portfolios', icon: Image01Icon },
                { micro: 'COMBINED', value: projectCountUp, label: 'Projects', icon: MdBolt },
                { micro: 'VISIBLE', value: publicCountUp, label: 'Public', icon: GlobeIcon },
                { micro: 'CLOUD', value: syncedCountUp, label: 'Synced', icon: CloudIcon },
              ].map((stat) => (
                <div key={stat.label} className="p-4 sm:p-5 text-center group hover:bg-muted/20 transition-colors duration-200">
                  <p className="text-[9px] uppercase tracking-widest text-brand-purple-400 dark:text-brand-400/60 font-semibold mb-1.5">{stat.micro}</p>
                  <p
                    className="text-2xl sm:text-3xl font-bold text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors duration-200"
                    style={{ textShadow: '0 0 20px rgba(249,115,22,0.15)' }}
                  >
                    {stat.value}
                  </p>
                  <hr className="mx-auto w-10 border-0 h-px bg-gradient-to-r from-transparent via-brand-500/20 to-transparent mt-2 mb-1.5" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </SpotlightCard>
          </motion.div>
        )}

        {/* ━━━ PORTFOLIO GRID ━━━ */}
        {portfolios.length > 0 ? (
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
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Portfolios</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Your creative showcase collection</p>
              </div>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              layout
            >
              <AnimatePresence mode="popLayout">
                {portfolios.map((portfolio) => {
                  const count = projectCounts[portfolio.localId] || 0
                  return (
                    <motion.div
                      key={portfolio.localId}
                      variants={fadeUp}
                      layout
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      whileHover={{ y: -6, transition: { duration: 0.25 } }}
                      className="group relative"
                    >
                        <div
                        className="block cursor-pointer"
                        onClick={() => router.push(`/dashboard/portfolios/${portfolio.localId}/edit`)}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/dashboard/portfolios/${portfolio.localId}/edit`) }}
                      >
                        <SpotlightCard className="overflow-hidden hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
                          {/* Thumbnail */}
                          <div className="h-48 sm:h-52 relative bg-muted overflow-hidden">
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
                            {/* Badges */}
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
                  {portfolio.syncStatus === 'synced' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 backdrop-blur-sm text-[10px] font-medium text-green-400">
                                  <HugeiconsIcon icon={CloudIcon} className="w-2.5 h-2.5" /> Synced
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 backdrop-blur-sm text-[10px] font-medium text-brand-600 dark:text-brand-400">
                                  <HugeiconsIcon icon={CloudLoadingIcon} className="w-2.5 h-2.5" /> Local
                                </span>
                              )}
                            </div>
                            {/* Project count overlay */}
                            <div className="absolute bottom-3 left-3">
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-medium text-white/90">
                                <HugeiconsIcon icon={Image01Icon} className="w-2.5 h-2.5" /> {count} project{count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                              <motion.span
                                className="opacity-0 group-hover:opacity-100 text-brand-dark text-sm font-medium bg-brand-500/80 backdrop-blur-sm px-4 py-2 rounded-full"
                                initial={false}
                                style={{ transition: 'opacity 0.3s, transform 0.3s' }}
                              >
                                Open
                              </motion.span>
                            </div>
              </div>
                          {/* Info */}
                          <div className="p-5">
                            <h3 className="font-semibold text-foreground truncate text-sm">{portfolio.title}</h3>
                    {portfolio.tagline && (
                              <p className="text-xs text-muted-foreground truncate mt-1">{portfolio.tagline}</p>
                            )}
                            {portfolio.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{portfolio.description}</p>
                            )}
                            <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
                              <span>Updated {formatDistanceToNow(portfolio.updatedAt)}</span>
                            </div>
                  </div>
                          {/* Action bar - slides up on hover */}
                          <div className="px-5 pb-4 -mt-1">
                            <div className="flex items-center gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                              <Link
                                href={`/dashboard/portfolios/${portfolio.localId}/edit`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 hover:bg-brand-500/20 text-[10px] font-medium text-brand-purple-600 dark:text-brand-400 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <HugeiconsIcon icon={Edit01Icon} className="w-3 h-3" /> Edit
                              </Link>
                              <Link
                                href={`/portfolio/preview/${portfolio.localId}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" /> Preview
                        </Link>
                              <button
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors ml-auto"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDelete(portfolio.localId, portfolio.title)
                                }}
                              >
                                <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </SpotlightCard>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
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
                className="block w-full p-5 rounded-2xl border-2 border-dashed border-brand-purple-500/30 dark:border-brand-500/30 hover:border-brand-500/60 hover:bg-brand-500/5 hover:shadow-lg hover:shadow-brand-purple-500/10 dark:shadow-brand-500/10 transition-all duration-300 text-center group"
              >
                <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm font-medium text-brand-purple-600 dark:text-brand-400">Create New Portfolio</span>
                        </Link>
            </motion.div>
          </section>
        ) : (
          /* ━━━ EMPTY STATE ━━━ */
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="relative text-center py-20 rounded-2xl border-2 border-dashed border-border/50 overflow-hidden">
              {/* Decorative gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-purple-500/5 pointer-events-none" />
              <div className="relative">
                <div className="animate-float inline-block mb-6">
                  <HugeiconsIcon icon={SparklesIcon} className="w-14 h-14 text-brand-purple-500/50 dark:text-brand-400/50" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">Start your creative journey</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                  Create your first portfolio to showcase your work to employers, clients, and the creative community. It works offline too.
                </p>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="bg-brand-500 hover:bg-brand-600 px-8 py-3 text-sm shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                <Link href="/dashboard/portfolios/new">
                  <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                  Create Portfolio
                </Link>
              </Button>
                </motion.div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ━━━ PRO TIPS ━━━ */}
        <section className="mb-8">
          <motion.div
            className="mb-6"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="w-6 h-0.5 bg-brand-500 mb-3 rounded-full" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Pro Tips</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Get the most out of your portfolios</p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { icon: CloudLoadingIcon, title: 'Works Offline', desc: 'Create and edit even without internet. Changes sync automatically.' },
              { icon: Image01Icon, title: 'Smart Images', desc: 'Images are auto-compressed to save data while keeping quality.' },
              { icon: GlobeIcon, title: 'Go Public', desc: 'Public portfolios appear in search results and get more views.' },
              { icon: Share02Icon, title: 'Share Widely', desc: 'Share your portfolio link on social media to grow your audience.' },
            ].map((tip) => (
              <motion.div
                key={tip.title}
                variants={fadeUp}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <SpotlightCard className="p-4 hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all duration-200">
                <HugeiconsIcon icon={tip.icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400 mb-2.5" />
                <h4 className="text-sm font-semibold text-foreground mb-1">{tip.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.desc}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ━━━ FOOTER CTA ━━━ */}
        {portfolios.length > 0 && (
          <motion.div
            className="relative overflow-hidden rounded-2xl mb-8"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-brand-600/15 via-brand-purple-500/10 to-brand-400/5 pointer-events-none" />
            <div className="relative p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <HugeiconsIcon icon={SparklesIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground">Keep building.</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">Every project you add strengthens your portfolio.</p>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button className="bg-brand-500 hover:bg-brand-600" size="sm" asChild>
                  <Link href="/dashboard/portfolios/new">
                    Create Portfolio <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
