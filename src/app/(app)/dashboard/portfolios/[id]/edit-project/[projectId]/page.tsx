'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, Cancel01Icon, CheckmarkCircle01Icon, Delete02Icon, Edit01Icon, Film01Icon, GlobeIcon, Image01Icon, Link02Icon, LinkSquare01Icon, Loading02Icon, PlayIcon, Upload01Icon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import SpotlightCard from '@/components/SpotlightCard'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  getPortfolioOffline,
  getProjectsByPortfolio,
  saveProjectOffline,
  deleteProjectOffline,
} from '@/lib/offline'
import { processAndSaveImage, getOfflineImageUrl } from '@/lib/offline/image-compressor'
import { useNetworkStatus } from '@/hooks'
import { useSession } from '@/components/providers/user-session-provider'
import type { OfflinePortfolio, OfflineProject, OfflineImage } from '@/types'
import { cn } from '@/lib/utils'

// ─── Video URL Parser ───────────────────────────────────────────────────────

function parseVideoUrl(url: string) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { platform: 'youtube' as const, id: ytMatch[1], thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { platform: 'vimeo' as const, id: vimeoMatch[1], thumbnail: null }
  if (url.match(/^https?:\/\/.+/)) return { platform: 'other' as const, id: null, thumbnail: null }
  return null
}

function getPlatformLabel(platform: string) {
  switch (platform) {
    case 'youtube': return 'YouTube'
    case 'vimeo': return 'Vimeo'
    default: return 'Video Link'
  }
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function EditProjectPage() {
  const params = useParams()
  const router = useRouter()
  const portfolioId = params.id as string
  const projectId = params.projectId as string
  const { isOnline } = useNetworkStatus()
  const { userId } = useSession()

  // Data
  const [portfolio, setPortfolio] = useState<OfflinePortfolio | null>(null)
  const [project, setProject] = useState<OfflineProject | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    video_url: '',
  })

  // Images
  const [existingImages, setExistingImages] = useState<OfflineImage[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Video
  const [showVideoInput, setShowVideoInput] = useState(false)
  const parsedVideo = useMemo(() => parseVideoUrl(formData.video_url), [formData.video_url])

  // UI
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // ─── Load Data ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!userId) return
      try {
        // Load portfolio
        let p = await getPortfolioOffline(portfolioId)
        if (!p && isOnline && !portfolioId.startsWith('local_')) {
          const res = await fetch(`/api/portfolios?id=${portfolioId}`)
          if (res.ok) {
            const data = await res.json()
            if (data.portfolio) {
              p = {
                id: data.portfolio.id,
                localId: data.portfolio.id,
                userId,
                data: data.portfolio,
                projects: [],
                syncStatus: 'synced' as const,
                lastModified: Date.now(),
              }
            }
          }
        }

        if (!p) {
          toast.error('Portfolio not found')
          router.push('/dashboard/portfolios')
          return
        }
        setPortfolio(p)

        // Load projects and find the target
        const projects = await getProjectsByPortfolio(p.localId)
        const serverProjects = await getProjectsByPortfolio(p.id)
        const allProjects = [...projects, ...serverProjects.filter(sp => !projects.find(lp => lp.localId === sp.localId))]

        const target = allProjects.find(proj => proj.localId === projectId || proj.id === projectId)
        if (!target) {
          toast.error('Project not found')
          router.push(`/dashboard/portfolios/${portfolioId}/edit`)
          return
        }
        setProject(target)

        // Populate form
        const pd = target.data as Record<string, unknown>
        const videoUrl = (pd.video_url as string) || ''
        setFormData({
          title: (pd.title as string) || '',
          description: (pd.description as string) || '',
          tags: Array.isArray(pd.tags) ? (pd.tags as string[]).join(', ') : '',
          video_url: videoUrl,
        })
        setIsPublic((pd.is_public as boolean) ?? true)
        if (videoUrl) setShowVideoInput(true)

        // Load existing images
        setExistingImages(target.images)
        const urls = target.images.map(img => getOfflineImageUrl(img))
        setExistingImageUrls(urls)

        setLastSaved('Local cache updated')
      } catch (err) {
        console.error('Failed to load project:', err)
        toast.error('Failed to load project')
        router.push(`/dashboard/portfolios/${portfolioId}/edit`)
      } finally {
        setIsLoading(false)
      }
    }
    if (userId) load()
  }, [portfolioId, projectId, userId, isOnline, router])

  // ─── Image Handling ─────────────────────────────────────────────────────

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const total = existingImages.length + newImages.length + files.length
    if (total > 10) {
      toast.error('Maximum 10 images per project')
      return
    }
    setNewImages(prev => [...prev, ...files])
    const previews = files.map(file => URL.createObjectURL(file))
    setNewImagePreviews(prev => [...prev, ...previews])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [existingImages.length, newImages.length])

  const removeExistingImage = useCallback((index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index))
    setExistingImageUrls(prev => prev.filter((_, i) => i !== index))
  }, [])

  const removeNewImage = useCallback((index: number) => {
    URL.revokeObjectURL(newImagePreviews[index])
    setNewImages(prev => prev.filter((_, i) => i !== index))
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index))
  }, [newImagePreviews])

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!project || !portfolio) return
    if (!formData.title.trim()) {
      toast.error('Please enter a project title')
      return
    }

    setIsSaving(true)
    try {
      // Process new images
      const processedNewImages: OfflineImage[] = []
      for (const file of newImages) {
        const image = await processAndSaveImage(file)
        processedNewImages.push(image)

        if (isOnline) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('bucket', 'portfolio-images')
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
            if (uploadRes.ok) {
              const result = await uploadRes.json()
              if (result.url) image.remoteUrl = result.url
            }
          } catch {
            // Will sync later
          }
        }
      }

      const updatedProject: OfflineProject = {
        ...project,
        data: {
          ...(project.data as Record<string, unknown>),
          title: formData.title || 'Untitled Project',
          description: formData.description || '',
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          video_url: formData.video_url || '',
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        },
        images: [...existingImages, ...processedNewImages],
        syncStatus: 'pending',
        lastModified: Date.now(),
      }

      await saveProjectOffline(updatedProject)
      setProject(updatedProject)

      // Update images state with newly processed ones
      setExistingImages([...existingImages, ...processedNewImages])
      const newUrls = processedNewImages.map(img => getOfflineImageUrl(img))
      setExistingImageUrls(prev => [...prev, ...newUrls])
      setNewImages([])
      newImagePreviews.forEach(url => URL.revokeObjectURL(url))
      setNewImagePreviews([])

      setLastSaved('Local cache updated')
      toast.success('Project updated!')

      // Background sync
      if (isOnline) {
        import('@/lib/offline').then(({ performSync }) => {
          performSync().catch(err => console.warn('Background sync failed:', err))
        })
      }
    } catch (error) {
      console.error('Error saving project:', error)
      toast.error('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!project) return
    setIsDeleting(true)
    try {
      if (isOnline && project.id && !project.id.startsWith('local_')) {
        try {
          await fetch(`/api/projects?id=${project.id}`, { method: 'DELETE' })
        } catch {
          console.warn('Server delete failed')
        }
      }
      await deleteProjectOffline(project.localId)
      toast.success('Project deleted')
      router.push(`/dashboard/portfolios/${portfolioId}/edit`)
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      newImagePreviews.forEach(url => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Derived ────────────────────────────────────────────────────────────

  const allImageUrls = [...existingImageUrls, ...newImagePreviews]
  const heroUrl = allImageUrls[0] || null
  const thumbnailUrls = allImageUrls.slice(1)
  const totalImages = existingImages.length + newImages.length
  const pendingSyncCount = existingImages.filter(img => img.uploadStatus !== 'uploaded').length + newImages.length
  const parsedTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">

        {/* ━━━ HEADER ━━━ */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <HugeiconsIcon icon={Edit01Icon} className="w-4 h-4 text-green-500" />
            <p className="text-xs font-bold uppercase tracking-wider text-brand-purple-600 dark:text-brand-400">Editing Project</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Project Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Changes are automatically saved to your local database
          </p>
        </div>

        {/* ━━━ TWO-COLUMN: DETAILS + LIVE PREVIEW ━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

          {/* ── Left: Project Details ── */}
          <div className="lg:col-span-3">
            <SpotlightCard>
              <div className="pt-5 pb-5 px-6 space-y-5">
                {/* Section header */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Project Details</h2>
                    <p className="text-xs text-muted-foreground">Title, description, and categories</p>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="h-11"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs text-muted-foreground">Project Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <Label htmlFor="tags" className="text-xs text-muted-foreground">Tags (Comma separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="e.g. Sustainable, Weaving, Freetown, Heritage"
                    className="h-11"
                  />
                </div>

                {/* ─── Video Link Section ───────────────────────────── */}
                <div className="space-y-3">
                  {!showVideoInput && !formData.video_url ? (
                    <button
                      type="button"
                      onClick={() => setShowVideoInput(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-brand-purple-500/30 dark:border-brand-500/30 text-brand-purple-600 dark:text-brand-400 hover:border-brand-500/60 hover:bg-brand-purple-500/5 dark:bg-brand-500/5 transition-all group"
                    >
                      <HugeiconsIcon icon={PlayIcon} className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Add Video Link</span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HugeiconsIcon icon={Film01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                          <Label className="text-sm font-semibold text-foreground">Video Link</Label>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, video_url: '' }))
                            setShowVideoInput(false)
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="relative">
                        <HugeiconsIcon icon={Link02Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Paste YouTube, Vimeo, or video URL..."
                          value={formData.video_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                          className="pl-9 bg-background focus:ring-brand-purple-500/30 dark:ring-brand-500/30"
                        />
                      </div>

                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500/60" />
                        Supported: YouTube, Vimeo, or any public video URL
                      </p>

                      {/* Live Preview */}
                      {parsedVideo && formData.video_url && (
                        <div className="rounded-lg border border-border overflow-hidden bg-background">
                          {parsedVideo.platform === 'youtube' && parsedVideo.thumbnail ? (
                            <div className="relative">
                              <img
                                src={parsedVideo.thumbnail}
                                alt="Video thumbnail"
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                  <HugeiconsIcon icon={PlayIcon} className="w-4 h-4 text-white ml-0.5" />
                                </div>
                              </div>
                              <div className="absolute bottom-2 left-2">
                                <Badge className="bg-red-600 text-white text-[10px] border-0">
                                  <HugeiconsIcon icon={PlayIcon} className="w-2.5 h-2.5 mr-1" />
                                  YouTube
                                </Badge>
                              </div>
                            </div>
                          ) : parsedVideo.platform === 'vimeo' ? (
                            <div className="relative h-24 bg-gradient-to-br from-[#1ab7ea]/20 to-[#1ab7ea]/5 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-[#1ab7ea] flex items-center justify-center shadow-lg">
                                <HugeiconsIcon icon={PlayIcon} className="w-4 h-4 text-white ml-0.5" />
                              </div>
                              <div className="absolute bottom-2 left-2">
                                <Badge className="bg-[#1ab7ea] text-white text-[10px] border-0">
                                  <HugeiconsIcon icon={PlayIcon} className="w-2.5 h-2.5 mr-1" />
                                  Vimeo
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="relative h-16 bg-gradient-to-br from-brand-500/10 to-brand-purple-500/5 flex items-center justify-center gap-2">
                              <HugeiconsIcon icon={Film01Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                              <span className="text-sm text-muted-foreground font-medium">Video linked</span>
                            </div>
                          )}
                          <div className="px-3 py-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{formData.video_url}</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, video_url: '' }))}
                              className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SpotlightCard>
          </div>

          {/* ── Right: Live Preview ── */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Preview</p>
              </div>
              <Badge className="bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 text-[10px] font-bold uppercase tracking-wider border">
                Instant Sync
              </Badge>
            </div>
            <SpotlightCard className="overflow-hidden">
              {/* Hero image */}
              <div className="h-44 sm:h-52 bg-gradient-to-br from-brand-600/30 via-brand-purple-500/20 to-brand-400/10 relative">
                {heroUrl ? (
                  <img src={heroUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <HugeiconsIcon icon={Image01Icon} className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="pt-4 pb-4 px-6">
                <h3 className="font-bold text-foreground text-lg truncate">
                  {formData.title || 'Project Title'}
                </h3>
                {/* Tags */}
                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parsedTags.slice(0, 4).map(tag => (
                      <Badge key={tag} className="bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 text-[10px] border">
                        {tag}
                      </Badge>
                    ))}
                    {parsedTags.length > 4 && (
                      <Badge variant="secondary" className="text-[10px]">+{parsedTags.length - 4}</Badge>
                    )}
                  </div>
                )}
                {/* Description */}
                {formData.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-4 leading-relaxed">
                    {formData.description}
                  </p>
                )}
                {/* Video indicator */}
                {formData.video_url && parsedVideo && (
                  <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                      parsedVideo.platform === 'youtube' ? 'bg-red-600' :
                      parsedVideo.platform === 'vimeo' ? 'bg-[#1ab7ea]' :
                      'bg-brand-500'
                    )}>
                      <HugeiconsIcon icon={PlayIcon} className="w-3.5 h-3.5 text-white ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-foreground">{getPlatformLabel(parsedVideo.platform)}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{formData.video_url}</p>
                    </div>
                  </div>
                )}
                {/* Additional thumbnails */}
                {thumbnailUrls.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {thumbnailUrls.slice(0, 3).map((url, i) => (
                      <div key={i} className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <img src={url} alt={`Thumbnail ${i + 2}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {thumbnailUrls.length > 3 && (
                      <div className="w-20 h-14 rounded-lg flex-shrink-0 bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">+{thumbnailUrls.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* ━━━ MEDIA ASSETS ━━━ */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={Image01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Media Assets</h2>
              <p className="text-xs text-muted-foreground">
                {totalImages} image{totalImages !== 1 ? 's' : ''} uploaded
                {pendingSyncCount > 0 && ` \u2022 ${pendingSyncCount} pending sync`}
              </p>
            </div>
          </div>

          {/* Upload zone */}
          <label className={cn(
            'block border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 mb-4',
            'border-brand-500/40 hover:border-brand-500 hover:bg-brand-purple-500/5 dark:bg-brand-500/5'
          )}>
            <HugeiconsIcon icon={Upload01Icon} className="w-10 h-10 text-brand-purple-600 dark:text-brand-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">Add more files</p>
            <p className="text-xs text-muted-foreground mt-0.5">Drag and drop or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Image grid */}
          {allImageUrls.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* Existing images */}
              {existingImageUrls.map((url, i) => (
                <div key={`ex-${i}`} className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 group">
                  <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeExistingImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {/* New images */}
              {newImagePreviews.map((url, i) => (
                <div key={`new-${i}`} className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-brand-500 group">
                  <img src={url} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeNewImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5">
                    <Badge className="bg-brand-500/90 text-brand-dark text-[9px] border-0">New</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ━━━ PUBLISHING SETTINGS (collapsible) ━━━ */}
        <div className="mb-8">
          <button
            onClick={() => setIsPublishOpen(!isPublishOpen)}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <HugeiconsIcon icon={GlobeIcon} className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold text-foreground">Publishing Settings</h2>
                <p className="text-xs text-muted-foreground">Visibility, tags, and privacy</p>
              </div>
            </div>
            {isPublishOpen ? (
              <HugeiconsIcon icon={ArrowUp01Icon} className="w-5 h-5 text-muted-foreground" />
            ) : (
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {isPublishOpen && (
            <SpotlightCard className="mt-3 p-4 space-y-4">
              {/* Visibility */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center">
                    {isPublic ? <HugeiconsIcon icon={ViewIcon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" /> : <HugeiconsIcon icon={ViewOffIcon} className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Visibility</p>
                    <p className="text-xs text-muted-foreground">Decide if your project is visible to everyone</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  <span className={cn('text-sm font-medium', isPublic ? 'text-green-500' : 'text-muted-foreground')}>
                    {isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
            </SpotlightCard>
          )}
        </div>

        {/* ━━━ DANGER ZONE ━━━ */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-red-500 italic mb-2">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deleting this project will permanently remove it from your portfolio and all shared networks. This cannot be undone.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4 mr-2" />
                Delete Project
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ━━━ STICKY FOOTER ━━━ */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t border-border z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Left: Cancel */}
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/portfolios/${portfolioId}/edit`}>
              Cancel
            </Link>
          </Button>

          {/* Center: Status */}
          {lastSaved && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-500 font-medium uppercase tracking-wider">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5" />
              {lastSaved}
            </div>
          )}

          {/* Right: Preview + Save */}
          <div className="flex items-center gap-2">
            {portfolio && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={`/portfolio/preview/${portfolio.localId}`}>
                  View Full Preview
                  <HugeiconsIcon icon={LinkSquare01Icon} className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
            )}
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-brand-dark"
              onClick={handleSave}
              disabled={isSaving || !formData.title.trim()}
            >
              {isSaving ? (
                <>
                  <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Project'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
