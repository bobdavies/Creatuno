'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon, CloudIcon, CloudLoadingIcon, Delete02Icon, Edit01Icon, FloppyDiskIcon, GlobeIcon, Image01Icon, Loading02Icon, LockIcon, PlayIcon, Share02Icon, SparklesIcon, Tick01Icon, Video01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  getPortfolioOffline, 
  savePortfolioOffline, 
  saveProjectOffline,
  getProjectsByPortfolio,
  deleteProjectOffline,
  syncPortfolioImmediately,
} from '@/lib/offline'
import { getOfflineImageUrl } from '@/lib/offline/image-compressor'
import { useNetworkStatus } from '@/hooks'
import { useSession } from '@/components/providers/user-session-provider'
import { formatDistanceToNow } from '@/lib/format-date'
import type { OfflinePortfolio, OfflineProject } from '@/types'

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditPortfolioPage() {
  const params = useParams()
  const router = useRouter()
  const portfolioId = params.id as string
  const { isOnline } = useNetworkStatus()
  const { userId } = useSession()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [portfolio, setPortfolio] = useState<OfflinePortfolio | null>(null)
  const [projects, setProjects] = useState<OfflineProject[]>([])
  const [isCopied, setIsCopied] = useState(false)

  // ─── Handlers (unchanged logic) ──────────────────────────────────────────

  const handleCopyShareLink = async () => {
    if (!portfolio) return
    const pData = portfolio.data as Record<string, unknown>
    const slug = (pData.slug as string) || portfolio.localId
    const shareUrl = `${window.location.origin}/portfolio/preview/${slug}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setIsCopied(true)
      toast.success('Share link copied to clipboard!')
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  useEffect(() => {
    async function loadData() {
      if (!userId) return
      try {
        let portfolioData = await getPortfolioOffline(portfolioId)
        if (!portfolioData && isOnline && !portfolioId.startsWith('local_')) {
          try {
            const response = await fetch('/api/portfolios')
            if (response.ok) {
              const data = await response.json()
              const serverPortfolio = (data.portfolios || []).find(
                (p: { id: string }) => p.id === portfolioId
              )
              if (serverPortfolio) {
                portfolioData = {
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
                await savePortfolioOffline(portfolioData)
              }
            }
          } catch { /* ignore */ }
          }
        if (portfolioData) {
          if (portfolioData.userId && portfolioData.userId !== userId) {
            toast.error('You do not have access to this portfolio')
            router.push('/dashboard/portfolios')
            return
          }
          setPortfolio(portfolioData)
          let projectsData = await getProjectsByPortfolio(portfolioId)
          if (projectsData.length === 0 && isOnline && portfolioData.id) {
            try {
              const projectsResponse = await fetch(`/api/projects?portfolio_id=${portfolioData.id}`)
              if (projectsResponse.ok) {
                const projectsResult = await projectsResponse.json()
                for (const serverProject of projectsResult.projects || []) {
                  await saveProjectOffline({
                    id: serverProject.id,
                    localId: serverProject.id,
                    portfolioId: portfolioData.id,
                    data: {
                      title: serverProject.title,
                      description: serverProject.description,
                      client_name: serverProject.client_name,
                      project_date: serverProject.project_date,
                      external_link: serverProject.external_link,
                      video_url: serverProject.video_url || '',
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
                    syncStatus: 'synced' as const,
                    lastModified: new Date(serverProject.updated_at).getTime(),
                  })
                }
                projectsData = await getProjectsByPortfolio(portfolioData.id)
              }
            } catch { /* ignore */ }
            }
          setProjects(projectsData)
        } else {
          toast.error('Portfolio not found')
          router.push('/dashboard/portfolios')
        }
      } catch {
        toast.error('Failed to load portfolio')
      } finally {
        setIsLoading(false)
      }
    }
    if (userId) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, router, userId, isOnline])

  const handleSavePortfolio = async () => {
    if (!portfolio) return
    setIsSaving(true)
    try {
      await savePortfolioOffline({ ...portfolio, lastModified: Date.now(), syncStatus: 'pending' })
      if (isOnline) {
        const syncResult = await syncPortfolioImmediately(portfolio.localId)
        if (syncResult.success) {
          if (syncResult.serverId && syncResult.serverId !== portfolio.id) {
            setPortfolio({ ...portfolio, id: syncResult.serverId, syncStatus: 'synced' })
          }
          toast.success('Portfolio saved to cloud!')
        } else {
          toast.success('Portfolio saved! It will sync to cloud shortly.')
        }
      } else {
        toast.success('Portfolio saved offline!')
      }
    } catch {
      toast.error('Failed to save portfolio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const projectToDelete = projects.find(p => p.localId === projectId)
      if (isOnline && projectToDelete?.id && !projectToDelete.id.startsWith('local_')) {
        try { await fetch(`/api/projects?id=${projectToDelete.id}`, { method: 'DELETE' }) } catch { /* ignore */ }
      }
      await deleteProjectOffline(projectId)
      setProjects(prev => prev.filter(p => p.localId !== projectId))
      toast.success('Project removed')
    } catch {
      toast.error('Failed to delete project')
    }
  }

  const handleMoveProject = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    if (swapIdx < 0 || swapIdx >= projects.length) return
    const newProjects = [...projects]
    const temp = newProjects[index]
    newProjects[index] = newProjects[swapIdx]
    newProjects[swapIdx] = temp
    const updated = newProjects.map((p, i) => ({
      ...p,
      data: { ...p.data as Record<string, unknown>, display_order: i },
      syncStatus: 'pending' as const,
      lastModified: Date.now(),
    }))
    setProjects(updated)
    for (const project of updated) await saveProjectOffline(project)
    toast.success('Project order updated')
  }

  // ─── Loading State ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
          <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 text-brand-purple-600 dark:text-brand-400" />
        </motion.div>
      </div>
    )
  }

  if (!portfolio) return null

  const portfolioData = portfolio.data as Record<string, unknown>
  const isPublic = (portfolioData.is_public as boolean) ?? true
  const updatedAt = (portfolioData.updated_at as string) || new Date(portfolio.lastModified).toISOString()

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-32">

      {/* ━━━ HERO HEADER ━━━ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10 sm:pb-12">
          {/* Back link */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <Link
              href="/dashboard/portfolios"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-purple-600 dark:hover:text-brand-400 transition-colors duration-200 mb-6"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" />
              Back to Portfolios
            </Link>
          </motion.div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease }}
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight truncate">
              {portfolioData.title as string}
            </h1>
              </motion.div>
              <motion.p
                className="text-muted-foreground mt-3 text-sm sm:text-base"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease, delay: 0.15 }}
              >
              {projects.length} project{projects.length !== 1 ? 's' : ''}
                {typeof portfolioData.tagline === 'string' && portfolioData.tagline && (
                  <span className="text-muted-foreground/50"> &middot; {portfolioData.tagline}</span>
                )}
              </motion.p>
              <motion.div
                className="flex items-center gap-2 mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease, delay: 0.3 }}
              >
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <span className="text-xs font-medium uppercase tracking-widest text-brand-purple-500 dark:text-brand-400/70">Editing Portfolio</span>
              </motion.div>
          </div>

            {/* Action buttons */}
            <motion.div
              className="flex items-center gap-2.5 flex-shrink-0"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.35 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            onClick={handleCopyShareLink}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border transition-all duration-200 ${
                  isCopied
                    ? 'bg-green-500/10 border-green-500/30 text-green-500'
                    : 'bg-card/60 border-border/50 text-foreground hover:border-brand-purple-500/50 dark:border-brand-500/50'
                }`}
              >
                {isCopied ? <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5" /> : <HugeiconsIcon icon={Share02Icon} className="w-3.5 h-3.5" />}
                {isCopied ? 'Copied' : 'Share'}
              </motion.button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={`/portfolio/preview/${portfolio.localId}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 backdrop-blur-sm border border-border/50 hover:border-brand-purple-500/50 dark:border-brand-500/50 text-sm font-medium text-foreground transition-all duration-200"
                >
                  <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5" /> Preview
            </Link>
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            onClick={handleSavePortfolio}
            disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark text-sm font-medium shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 transition-all duration-200 disabled:opacity-60"
              >
                {isSaving ? <HugeiconsIcon icon={Loading02Icon} className="w-3.5 h-3.5 animate-spin" /> : <HugeiconsIcon icon={FloppyDiskIcon} className="w-3.5 h-3.5" />}
                Save
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">

        {/* ━━━ INFO STRIP ━━━ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease }}
          className="relative mb-14"
        >
          <SpotlightCard className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/50">
            <div className="p-4 sm:p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {isPublic ? <HugeiconsIcon icon={GlobeIcon} className="w-3 h-3 text-green-500" /> : <HugeiconsIcon icon={LockIcon} className="w-3 h-3 text-muted-foreground" />}
                <span className={`text-xs font-semibold ${isPublic ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Visibility</p>
            </div>
            <div className="p-4 sm:p-5 text-center">
              <p className="text-lg font-bold text-foreground">{projects.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Projects</p>
            </div>
            <div className="p-4 sm:p-5 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {portfolio.syncStatus === 'synced' ? (
                  <HugeiconsIcon icon={CloudIcon} className="w-3 h-3 text-green-500" />
                ) : (
                  <HugeiconsIcon icon={CloudLoadingIcon} className="w-3 h-3 text-yellow-500" />
                )}
                <span className={`text-xs font-semibold ${portfolio.syncStatus === 'synced' ? 'text-green-500' : 'text-yellow-500'}`}>
                  {portfolio.syncStatus === 'synced' ? 'Synced' : 'Pending'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sync Status</p>
            </div>
            <div className="p-4 sm:p-5 text-center">
              <p className="text-xs font-medium text-foreground truncate">{formatDistanceToNow(updatedAt)} ago</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Last Updated</p>
            </div>
          </div>
          {/* Offline banner inside strip */}
      {!isOnline && (
            <div className="px-4 py-2.5 bg-brand-purple-500/10 dark:bg-brand-500/10 border-t border-brand-purple-500/20 dark:border-brand-500/20 text-xs text-brand-purple-600 dark:text-brand-400 text-center">
          You&apos;re offline. Changes are saved locally and will sync when you&apos;re back online.
        </div>
      )}
          </SpotlightCard>
        </motion.div>

        {/* ━━━ PROJECTS SECTION ━━━ */}
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
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Projects</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {projects.length > 0 ? 'Click to edit, use arrows to reorder' : 'Add your first project to get started'}
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button className="bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" size="sm" asChild>
                <Link href={`/dashboard/portfolios/${portfolioId}/add-project`}>
                <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                Add Project
                </Link>
              </Button>
            </motion.div>
          </motion.div>

        {projects.length > 0 ? (
            <>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 gap-5"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                layout
              >
                <AnimatePresence mode="popLayout">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.localId}
                project={project}
                index={index}
                totalCount={projects.length}
                      portfolioId={portfolioId}
                onDelete={() => handleDeleteProject(project.localId)}
                      onEdit={() => router.push(`/dashboard/portfolios/${portfolioId}/edit-project/${project.localId}`)}
                      onMoveUp={() => handleMoveProject(index, 'up')}
                      onMoveDown={() => handleMoveProject(index, 'down')}
              />
            ))}
                </AnimatePresence>
              </motion.div>

              {/* Add Project CTA */}
              <motion.div
                className="mt-6"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <Link
                  href={`/dashboard/portfolios/${portfolioId}/add-project`}
                  className="block w-full p-5 rounded-2xl border-2 border-dashed border-brand-purple-500/30 dark:border-brand-500/30 hover:border-brand-500/60 hover:bg-brand-purple-500/5 dark:bg-brand-500/5 hover:shadow-lg hover:shadow-brand-purple-500/10 dark:shadow-brand-500/10 transition-all duration-300 text-center group"
                >
                  <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400 mx-auto mb-1.5 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-medium text-brand-purple-600 dark:text-brand-400">Add Another Project</span>
                </Link>
              </motion.div>
            </>
          ) : (
            /* ━━━ EMPTY STATE ━━━ */
            <motion.div
              className="relative text-center py-20 rounded-2xl border-2 border-dashed border-border/50 overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-purple-500/5 pointer-events-none" />
              <div className="relative">
                <div className="animate-float inline-block mb-6">
                  <HugeiconsIcon icon={SparklesIcon} className="w-14 h-14 text-brand-purple-500/50 dark:text-brand-400/50" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">Add your first project</h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                  Upload your creative work with images, descriptions, and tags to build an impressive portfolio.
                </p>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
                  <Button className="bg-brand-500 hover:bg-brand-600 px-8 py-3 text-sm shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                    <Link href={`/dashboard/portfolios/${portfolioId}/add-project`}>
                <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                Add Project
                    </Link>
              </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </section>

        {/* ━━━ FOOTER CTA ━━━ */}
        {projects.length > 0 && (
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
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground">Looking good!</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">Preview how your portfolio looks to the world.</p>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/portfolio/preview/${portfolio.localId}`}>
                    Preview Portfolio <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5 ml-1.5" />
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

// ─── Project Card Component ───────────────────────────────────────────────────

function ProjectCard({ 
  project, 
  index,
  totalCount,
  portfolioId,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
}: { 
  project: OfflineProject
  index: number
  totalCount: number
  portfolioId: string
  onDelete: () => void
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const projectData = project.data as Record<string, unknown>
  const firstImage = project.images[0]
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const hasVideo = !!(projectData.video_url as string)
  const tags = (projectData.tags as string[]) || []

  useEffect(() => {
    if (firstImage) {
      setImageUrl(getOfflineImageUrl(firstImage))
    }
  }, [firstImage])

  return (
    <motion.div
      variants={fadeUp}
      layout
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="group relative"
    >
      <div className="rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:shadow-xl hover:shadow-brand-500/5 transition-all duration-300">
          {/* Thumbnail */}
        <div className={`h-40 sm:h-44 relative ${imageUrl ? '' : 'bg-muted'}`} onClick={onEdit} role="button" tabIndex={0}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={projectData.title as string}
                className="w-full h-full object-cover"
              />
            ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-6xl font-black text-foreground/[0.04] select-none">
                  {(projectData.title as string || 'P').charAt(0).toUpperCase()}
                </span>
              </div>
            </>
            )}
          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-medium text-white/90">
              <HugeiconsIcon icon={Image01Icon} className="w-2.5 h-2.5" /> {project.images.length}
            </span>
            {hasVideo && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-medium text-white/90">
                <HugeiconsIcon icon={PlayIcon} className="w-2.5 h-2.5" /> Video
              </span>
            )}
          </div>
          <div className="absolute top-3 right-3">
            {project.syncStatus === 'synced' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 backdrop-blur-sm text-[10px] font-medium text-green-400">
                <HugeiconsIcon icon={CloudIcon} className="w-2.5 h-2.5" /> Synced
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/20 backdrop-blur-sm text-[10px] font-medium text-brand-600 dark:text-brand-400">
                <HugeiconsIcon icon={CloudLoadingIcon} className="w-2.5 h-2.5" /> Pending
              </span>
                )}
              </div>
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center cursor-pointer">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-dark text-sm font-medium bg-brand-500/80 backdrop-blur-sm px-4 py-2 rounded-full">
              Edit Project
            </span>
              </div>
            </div>
            
        {/* Info */}
        <div className="p-5">
          <h3 className="font-semibold text-foreground truncate text-sm">{projectData.title as string}</h3>
          {typeof projectData.client_name === 'string' && projectData.client_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5">Client: {projectData.client_name}</p>
          )}
            {typeof projectData.description === 'string' && projectData.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{projectData.description}</p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {tags.slice(0, 4).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-muted/50 text-[10px] font-medium text-muted-foreground">
                  #{tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span className="px-2 py-0.5 rounded-full bg-muted/50 text-[10px] font-medium text-muted-foreground">
                  +{tags.length - 4}
                </span>
              )}
            </div>
              )}
            </div>

        {/* Action bar - slides up on hover */}
        <div className="px-5 pb-4 -mt-1">
          <div className="flex items-center gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 hover:bg-brand-500/20 text-[10px] font-medium text-brand-purple-600 dark:text-brand-400 transition-colors"
              >
              <HugeiconsIcon icon={Edit01Icon} className="w-3 h-3" /> Edit
              </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp() }}
              disabled={index === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <HugeiconsIcon icon={ArrowUp01Icon} className="w-3 h-3" />
            </button>
                <button
              onClick={(e) => { e.stopPropagation(); onMoveDown() }}
              disabled={index === totalCount - 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-3 h-3" />
                </button>
              <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors ml-auto"
              >
              <HugeiconsIcon icon={Delete02Icon} className="w-3 h-3" /> Delete
              </button>
            </div>
        </div>
      </div>
    </motion.div>
  )
}
