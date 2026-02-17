'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, BulbIcon, Cancel01Icon, CheckmarkCircle01Icon, Delete02Icon, Edit01Icon, Film01Icon, Image01Icon, Link02Icon, Loading02Icon, PlayIcon, SentIcon, StarIcon, Tick01Icon, Upload01Icon, ViewIcon, ViewOffIcon, Wifi01Icon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import SpotlightCard from '@/components/SpotlightCard'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getPortfolioOffline,
  generateLocalId,
  saveProjectOffline,
  getProjectsByPortfolio,
} from '@/lib/offline'
import { processAndSaveImage, getOfflineImageUrl } from '@/lib/offline/image-compressor'
import { useNetworkStatus } from '@/hooks'
import { useSession } from '@/components/providers/user-session-provider'
import type { OfflinePortfolio, OfflineProject, OfflineImage } from '@/types'
import { cn } from '@/lib/utils'

// ─── Constants ─────────────────────────────────────────────────────────────

const categories = [
  'Graphic Design', 'Web Development', 'Photography',
  'Video Production', 'UI/UX Design', 'Branding',
  'Illustration', 'Motion Graphics', 'Social Media',
  'Content Strategy', 'Other',
]

const tagSuggestions: Record<string, string[]> = {
  'Graphic Design': ['Branding', 'Logo', 'Print', 'Typography', 'Packaging', 'Layout'],
  'Photography': ['Portrait', 'Landscape', 'Studio', 'Street', 'Editorial', 'Product'],
  'Web Development': ['React', 'NextJS', 'Frontend', 'Backend', 'Fullstack', 'API'],
  'UI/UX Design': ['Wireframe', 'Prototype', 'UserResearch', 'DesignSystem', 'Mobile', 'Web'],
  'Video Production': ['Commercial', 'Documentary', 'MusicVideo', 'Animation', 'Editing'],
  'Branding': ['Identity', 'Strategy', 'Guidelines', 'Naming', 'Positioning'],
  'Illustration': ['Digital', 'Traditional', 'Character', 'Editorial', 'Concept'],
  'Motion Graphics': ['2D', '3D', 'Explainer', 'TitleSequence', 'SocialMedia'],
  'Social Media': ['Instagram', 'TikTok', 'Campaign', 'Content', 'Strategy'],
  'Content Strategy': ['SEO', 'Copywriting', 'Blog', 'Newsletter', 'Editorial'],
  'Other': ['Creative', 'Project', 'Design', 'Art'],
}

const descriptionTips: Record<string, string> = {
  'Graphic Design': 'Tip: Mention the design tools, techniques, and the creative brief you worked from.',
  'Photography': 'Tip: Mention the camera, lens, lighting setup, and the story behind the shoot.',
  'Web Development': 'Tip: Describe the tech stack, challenges solved, and your specific role.',
  'UI/UX Design': 'Tip: Explain the user research, wireframing process, and key design decisions.',
  'Video Production': 'Tip: Describe the concept, production process, and editing techniques used.',
  'Branding': 'Tip: Explain the brand strategy, target audience, and how your design embodies it.',
  'Illustration': 'Tip: Share the inspiration, medium used, and the narrative behind the artwork.',
  'Motion Graphics': 'Tip: Describe the animation techniques, software used, and the project goals.',
  'Social Media': 'Tip: Explain the campaign strategy, target metrics, and creative approach.',
  'Content Strategy': 'Tip: Describe the content plan, audience analysis, and measurable outcomes.',
  'Other': 'Tip: Describe the inspiration, process, and the story behind this work.',
}

// ─── Video URL Parser ───────────────────────────────────────────────────────

function parseVideoUrl(url: string) {
  if (!url) return null
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { platform: 'youtube' as const, id: ytMatch[1], thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { platform: 'vimeo' as const, id: vimeoMatch[1], thumbnail: null }
  // Generic video link (Dailymotion, Facebook, etc.)
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

// ─── Types ─────────────────────────────────────────────────────────────────

interface QueuedImage {
  id: string
  file: File
  preview: string
  status: 'queued' | 'optimizing' | 'compressed' | 'uploading' | 'synced'
  progress: number
  compressedSize: number
  processedImage: OfflineImage | null
  isHero: boolean
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 10
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve('rgb(249, 115, 22)'); return }
        ctx.drawImage(img, 0, 0, 10, 10)
        const data = ctx.getImageData(0, 0, 10, 10).data
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        resolve(`rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`)
      } catch {
        resolve('rgb(249, 115, 22)')
      }
    }
    img.onerror = () => resolve('rgb(249, 115, 22)')
    img.src = imageUrl
  })
}

// ─── Confetti ──────────────────────────────────────────────────────────────

function ConfettiCelebration() {
  const colors = ['#FEC714', '#7E5DA7', '#A17FC4', '#3b82f6', '#22c55e', '#ec4899', '#ef4444']
  const pieces = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 1.5 + Math.random() * 1.5,
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 8,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.3); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.size > 10 ? '50%' : '2px',
            animation: `confettiFall ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Live Preview Card ─────────────────────────────────────────────────────

function LivePreviewCard({
  title,
  description,
  category,
  tags,
  heroPreview,
}: {
  title: string
  description: string
  category: string
  tags: string[]
  heroPreview: string | null
}) {
  const hasContent = title.length > 0

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        hasContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
        Live Preview
      </p>
      <SpotlightCard className="overflow-hidden">
        {/* Thumbnail area */}
        <div className="h-32 sm:h-36 bg-gradient-to-br from-brand-600/30 via-brand-purple-500/20 to-brand-400/10 relative flex items-center justify-center">
          {heroPreview ? (
            <img src={heroPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <HugeiconsIcon icon={Image01Icon} className="w-10 h-10 text-muted-foreground/40" />
          )}
        </div>
        <div className="pt-3 pb-3 px-3">
          <h4 className="font-semibold text-foreground text-sm truncate">
            {title || 'Project Title'}
          </h4>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {category && (
              <Badge variant="outline" className="text-[10px] bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30">
                {category}
              </Badge>
            )}
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                #{tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px]">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </SpotlightCard>
    </div>
  )
}

// ─── Main Wizard ───────────────────────────────────────────────────────────

export default function AddProjectWizard() {
  const params = useParams()
  const router = useRouter()
  const portfolioId = params.id as string
  const { isOnline } = useNetworkStatus()
  const { userId } = useSession()

  // Portfolio
  const [portfolio, setPortfolio] = useState<OfflinePortfolio | null>(null)
  const [existingProjectCount, setExistingProjectCount] = useState(0)
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true)

  // Wizard
  const [step, setStep] = useState(1)
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right')
  const [isAnimating, setIsAnimating] = useState(false)

  // Form
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    tags: [] as string[],
    tagInput: '',
    client_name: '',
    project_date: '',
    external_link: '',
    video_url: '',
  })

  // Images
  const [imageQueue, setImageQueue] = useState<QueuedImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3
  const [isPublic, setIsPublic] = useState(true)
  const [dominantColor, setDominantColor] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  // Video
  const [showVideoInput, setShowVideoInput] = useState(false)
  const parsedVideo = useMemo(() => parseVideoUrl(formData.video_url), [formData.video_url])

  // Drag & Drop
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  // ─── Load Portfolio ────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!userId) return
      try {
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

        if (p) {
          setPortfolio(p)
          const projects = await getProjectsByPortfolio(p.localId)
          const serverProjects = await getProjectsByPortfolio(p.id)
          setExistingProjectCount(Math.max(projects.length, serverProjects.length))
        } else {
          toast.error('Portfolio not found')
          router.push('/dashboard/portfolios')
        }
      } catch (err) {
        console.error('Failed to load portfolio:', err)
        toast.error('Failed to load portfolio')
        router.push('/dashboard/portfolios')
      } finally {
        setIsLoadingPortfolio(false)
      }
    }
    if (userId) load()
  }, [portfolioId, userId, isOnline, router])

  // ─── Step Navigation ───────────────────────────────────────────────────

  const goToStep = useCallback((target: number) => {
    if (isAnimating || target === step) return
    setSlideDirection(target > step ? 'right' : 'left')
    setIsAnimating(true)
    setTimeout(() => {
      setStep(target)
      setTimeout(() => setIsAnimating(false), 50)
    }, 150)
  }, [step, isAnimating])

  const nextStep = useCallback(() => {
    if (step === 1 && !formData.title.trim()) {
      toast.error('Please enter a project title')
      return
    }
    if (step < 3) goToStep(step + 1)
  }, [step, formData.title, goToStep])

  const prevStep = useCallback(() => {
    if (step > 1) goToStep(step - 1)
  }, [step, goToStep])

  // ─── Color extraction on entering step 3 ──────────────────────────────

  useEffect(() => {
    if (step === 3) {
      const hero = imageQueue.find(img => img.isHero) || imageQueue[0]
      if (hero?.preview) {
        extractDominantColor(hero.preview).then(setDominantColor)
      }
    }
  }, [step, imageQueue])

  // ─── Tag helpers ───────────────────────────────────────────────────────

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !formData.tags.includes(trimmed)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, trimmed] }))
    }
  }, [formData.tags])

  const removeTag = useCallback((tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }, [])

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && formData.tagInput.trim()) {
      e.preventDefault()
      addTag(formData.tagInput)
      setFormData(prev => ({ ...prev, tagInput: '' }))
    }
  }, [formData.tagInput, addTag])

  // ─── Image handling ────────────────────────────────────────────────────

  const processImage = useCallback(async (queueId: string, file: File) => {
    // Mark as optimizing
    setImageQueue(prev => prev.map(img =>
      img.id === queueId ? { ...img, status: 'optimizing' as const, progress: 30 } : img
    ))

    try {
      const processed = await processAndSaveImage(file)

      setImageQueue(prev => prev.map(img =>
        img.id === queueId ? {
          ...img,
          status: 'compressed' as const,
          progress: 100,
          compressedSize: processed.compressedSize,
          processedImage: processed,
        } : img
      ))

      // Upload if online
      if (isOnline) {
        setImageQueue(prev => prev.map(img =>
          img.id === queueId ? { ...img, status: 'uploading' as const } : img
        ))

        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('bucket', 'portfolio-images')
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
          if (uploadRes.ok) {
            const result = await uploadRes.json()
            if (result.url) {
              setImageQueue(prev => prev.map(img => {
                if (img.id === queueId && img.processedImage) {
                  img.processedImage.remoteUrl = result.url
                  return { ...img, status: 'synced' as const }
                }
                return img
              }))
            }
          }
        } catch {
          // Will sync later
        }
      }
    } catch (err) {
      console.error('Image processing failed:', err)
      setImageQueue(prev => prev.filter(img => img.id !== queueId))
      toast.error(`Failed to process ${file.name}`)
    }
  }, [isOnline])

  const addFiles = useCallback((files: File[]) => {
    const remaining = 10 - imageQueue.length
    if (remaining <= 0) {
      toast.error('Maximum 10 images per project')
      return
    }
    const toAdd = files.slice(0, remaining)
    if (files.length > remaining) {
      toast.info(`Only ${remaining} more image${remaining === 1 ? '' : 's'} can be added`)
    }

    const newQueued: QueuedImage[] = toAdd.map((file, i) => ({
      id: generateLocalId(),
      file,
      preview: URL.createObjectURL(file),
      status: 'queued' as const,
      progress: 0,
      compressedSize: 0,
      processedImage: null,
      isHero: imageQueue.length === 0 && i === 0,
    }))

    setImageQueue(prev => [...prev, ...newQueued])

    // Process each image
    newQueued.forEach(q => { processImage(q.id, q.file) })
  }, [imageQueue.length, processImage])

  const removeImage = useCallback((id: string) => {
    setImageQueue(prev => {
      const removed = prev.find(img => img.id === id)
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      const remaining = prev.filter(img => img.id !== id)
      // If removed was hero, make the first remaining the hero
      if (removed?.isHero && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isHero: true }
      }
      return remaining
    })
  }, [])

  const setHero = useCallback((id: string) => {
    setImageQueue(prev => prev.map(img => ({ ...img, isHero: img.id === id })))
  }, [])

  // ─── Drag & Drop ──────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer?.files || []).filter(f =>
      f.type.startsWith('image/')
    )
    if (files.length > 0) addFiles(files)
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) addFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [addFiles])

  // ─── Publish ──────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!portfolio) return
    setIsPublishing(true)

    try {
      const localId = generateLocalId()
      const processedImages = imageQueue
        .map(img => img.processedImage)
        .filter((img): img is OfflineImage => img !== null)

      // Sort so hero is first
      const heroIdx = imageQueue.findIndex(img => img.isHero)
      if (heroIdx > 0 && processedImages.length > heroIdx) {
        const [hero] = processedImages.splice(heroIdx, 1)
        processedImages.unshift(hero)
      }

      const isValidServerId = portfolio.id && portfolio.id.length > 0 && !portfolio.id.startsWith('local_')
      const effectivePortfolioId = isValidServerId ? portfolio.id : portfolio.localId

      const newProject: OfflineProject = {
        id: '',
        localId,
        portfolioId: effectivePortfolioId,
        data: {
          title: formData.title || 'Untitled Project',
          description: formData.description || '',
          client_name: formData.client_name || '',
          project_date: formData.project_date || null,
          external_link: formData.external_link || '',
          video_url: formData.video_url || '',
          tags: formData.tags,
          category: formData.category || '',
          is_public: isPublic,
          display_order: existingProjectCount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        images: processedImages,
        syncStatus: 'pending',
        lastModified: Date.now(),
      }

      await saveProjectOffline(newProject)

      // Background sync
      if (isOnline) {
        import('@/lib/offline').then(({ performSync }) => {
          performSync().catch(err => console.warn('Background sync failed:', err))
        })
      }

      setShowCelebration(true)

      setTimeout(() => {
        toast.success('Project published to portfolio!')
        router.push(`/dashboard/portfolios/${portfolioId}/edit`)
      }, 2800)
    } catch (error) {
      console.error('Error publishing project:', error)
      toast.error('Failed to publish project')
      setIsPublishing(false)
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      imageQueue.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Derived ──────────────────────────────────────────────────────────

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100
  const heroImage = imageQueue.find(img => img.isHero) || imageQueue[0] || null
  const suggestions = tagSuggestions[formData.category] || []
  const descCharCount = formData.description.length
  const descColorClass = descCharCount < 50 ? 'text-red-400' : descCharCount < 150 ? 'text-brand-600 dark:text-brand-400' : 'text-green-400'
  const descTip = descriptionTips[formData.category] || descriptionTips['Other']

  // ─── Loading ──────────────────────────────────────────────────────────

  if (isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-24 md:pb-6"
      onDragEnter={step === 2 ? handleDragEnter : undefined}
      onDragLeave={step === 2 ? handleDragLeave : undefined}
      onDragOver={step === 2 ? handleDragOver : undefined}
      onDrop={step === 2 ? handleDrop : undefined}
    >
      {/* Celebration overlay */}
      {showCelebration && <ConfettiCelebration />}

      {/* Full-page drag overlay (Step 2) */}
      {isDragOver && step === 2 && (
        <div className="fixed inset-0 z-40 bg-brand-purple-500/10 dark:bg-brand-500/10 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200">
          <div className="text-center">
            <HugeiconsIcon icon={Upload01Icon} className="w-16 h-16 text-brand-purple-600 dark:text-brand-400 mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-bold text-foreground">Drop your images here</p>
            <p className="text-muted-foreground text-sm mt-1">JPG, PNG, WEBP up to 10MB each</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-brand-purple-600 dark:text-brand-400 uppercase tracking-wider">
            Step {step} of 3
          </p>
          <p className="text-sm text-muted-foreground">
            {progressPercent}% Complete
          </p>
        </div>

        {/* ── Progress bar ── */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-purple-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ── Step Content ── */}
        <div className={cn(
          'transition-all duration-300 ease-in-out',
          isAnimating && slideDirection === 'right' && '-translate-x-4 opacity-0',
          isAnimating && slideDirection === 'left' && 'translate-x-4 opacity-0',
          !isAnimating && 'translate-x-0 opacity-100',
        )}>

          {/* ═══════════════ STEP 1: BASIC INFO ═══════════════ */}
          {step === 1 && (
            <div>
              {/* Step tabs -- only shown on Step 1 */}
              <div className="flex items-center gap-1 mb-8">
                {['Basic Info', 'Media Assets', 'Publish Project'].map((label, i) => {
                  const stepNum = i + 1
                  const isActive = step === stepNum
                  const isCompleted = step > stepNum
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        if (isCompleted || isActive) goToStep(stepNum)
                      }}
                      disabled={!isCompleted && !isActive}
                      className={cn(
                        'flex-1 text-center py-2 text-xs sm:text-sm font-medium uppercase tracking-wider transition-all border-b-2',
                        isActive
                          ? 'text-brand-purple-600 dark:text-brand-400 border-brand-500'
                          : isCompleted
                          ? 'text-muted-foreground border-brand-500/40 hover:text-foreground cursor-pointer'
                          : 'text-muted-foreground/50 border-transparent cursor-default'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div className="max-w-2xl mx-auto">
                <SpotlightCard className="pt-6 pb-6 space-y-5">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                        Add Project: Basic Info
                      </h2>
                      <p className="text-muted-foreground text-sm mt-1">
                        Tell us about your creative work to help others discover it.
                      </p>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title" className="uppercase text-xs font-semibold tracking-wider text-foreground">
                        Project Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        placeholder="e.g. Lagos Street Photography Series"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="h-11"
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <Label className="uppercase text-xs font-semibold tracking-wider text-foreground">
                        Category
                      </Label>
                      <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select a creative niche" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description" className="uppercase text-xs font-semibold tracking-wider text-foreground">
                        Project Description
                      </Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the inspiration, the process, and the story behind this work..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value.slice(0, 2000) }))}
                        rows={5}
                        className="resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground italic">{descTip}</p>
                        <p className={cn('text-xs font-medium tabular-nums', descColorClass)}>
                          {descCharCount}/2000 characters
                        </p>
                      </div>
                      {descCharCount >= 200 && (
                        <p className="text-xs text-green-500 flex items-center gap-1">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" />
                          Great description! This will help your work get discovered.
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label htmlFor="tags" className="uppercase text-xs font-semibold tracking-wider text-foreground">
                        Tags
                      </Label>
                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {formData.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-red-500/20 transition-colors group"
                              onClick={() => removeTag(tag)}
                            >
                              #{tag}
                              <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100" />
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Input
                        id="tags"
                        placeholder="Type a tag and press Enter..."
                        value={formData.tagInput}
                        onChange={(e) => setFormData(prev => ({ ...prev, tagInput: e.target.value }))}
                        onKeyDown={handleTagKeyDown}
                        className="h-11"
                      />
                      {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-xs text-muted-foreground mr-1 self-center">Suggested:</span>
                          {suggestions.map(s => {
                            const isAdded = formData.tags.includes(s)
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => isAdded ? removeTag(s) : addTag(s)}
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full border transition-all',
                                  isAdded
                                    ? 'bg-brand-500 text-brand-dark border-brand-500'
                                    : 'bg-transparent text-muted-foreground border-border hover:border-brand-purple-500/50 dark:border-brand-500/50 hover:text-brand-purple-600 dark:hover:text-brand-400'
                                )}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      )}
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
                                    className="w-full h-36 object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                                      <HugeiconsIcon icon={PlayIcon} className="w-5 h-5 text-white ml-0.5" />
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
                                <div className="relative h-28 bg-gradient-to-br from-[#1ab7ea]/20 to-[#1ab7ea]/5 flex items-center justify-center">
                                  <div className="w-12 h-12 rounded-full bg-[#1ab7ea] flex items-center justify-center shadow-lg">
                                    <HugeiconsIcon icon={PlayIcon} className="w-5 h-5 text-white ml-0.5" />
                                  </div>
                                  <div className="absolute bottom-2 left-2">
                                    <Badge className="bg-[#1ab7ea] text-white text-[10px] border-0">
                                      <HugeiconsIcon icon={PlayIcon} className="w-2.5 h-2.5 mr-1" />
                                      Vimeo
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative h-20 bg-gradient-to-br from-brand-500/10 to-brand-purple-500/5 flex items-center justify-center gap-2">
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

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <Button variant="ghost" asChild>
                        <Link href={`/dashboard/portfolios/${portfolioId}/edit`}>
                          Cancel
                        </Link>
                      </Button>
                      <Button
                        className="bg-brand-500 hover:bg-brand-600 text-brand-dark"
                        onClick={nextStep}
                        disabled={!formData.title.trim()}
                      >
                        Next Step
                        <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                </SpotlightCard>

                {/* Tip cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="w-8 h-8 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <HugeiconsIcon icon={BulbIcon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Be Descriptive</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Detailed descriptions help your project appear in specific search results.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="w-8 h-8 rounded-full bg-brand-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {isOnline ? <HugeiconsIcon icon={Wifi01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" /> : <HugeiconsIcon icon={WifiOff01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Offline Mode</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your progress is saved locally instantly. Finish anytime, even without internet.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <HugeiconsIcon icon={ViewIcon} className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Visibility</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You can choose to keep your project private or make it public in the last step.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Preview (below form) */}
                <div className="mt-6">
                  <LivePreviewCard
                    title={formData.title}
                    description={formData.description}
                    category={formData.category}
                    tags={formData.tags}
                    heroPreview={heroImage?.preview || null}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ STEP 2: MEDIA UPLOAD ═══════════════ */}
          {step === 2 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Media Upload</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Add high-quality images of your work. Our engine automatically compresses files to under 500KB to ensure your portfolio loads instantly, even on 3G networks across Sierra Leone.
              </p>

              {/* Drop zone */}
              <label
                className={cn(
                  'block border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200',
                  isDragOver
                    ? 'border-brand-500 bg-brand-purple-500/10 dark:bg-brand-500/10'
                    : 'border-brand-500/40 hover:border-brand-500 hover:bg-brand-purple-500/5 dark:bg-brand-500/5'
                )}
              >
                <HugeiconsIcon icon={Upload01Icon} className="w-12 h-12 text-brand-purple-600 dark:text-brand-400 mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">Upload Images</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Drag and drop your project photos here or click to browse files.
                </p>
                <p className="text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-wider mt-3">
                  JPG, PNG, WEBP (Max 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* Files in queue */}
              {imageQueue.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-semibold text-foreground mb-3">
                    Files in queue
                    <Badge variant="secondary" className="ml-2 text-xs">{imageQueue.length}</Badge>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {imageQueue.map((img) => (
                      <div
                        key={img.id}
                        className={cn(
                          'relative rounded-xl overflow-hidden border bg-card transition-all group',
                          img.isHero ? 'ring-2 ring-brand-500 border-brand-500' : 'border-border'
                        )}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-36 sm:h-40 bg-muted">
                          <img
                            src={img.preview}
                            alt={img.file.name}
                            className="w-full h-full object-cover"
                          />

                          {/* Optimizing overlay (centered on image) */}
                          {img.status === 'optimizing' && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="text-center">
                                <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 text-brand-purple-600 dark:text-brand-400 animate-spin mx-auto" />
                                <p className="text-white text-[10px] font-bold uppercase tracking-wider mt-1">Optimizing</p>
                              </div>
                            </div>
                          )}

                          {/* Status badge (top-left) */}
                          {img.status !== 'optimizing' && (
                            <div className="absolute top-2 left-2">
                              {(img.status === 'compressed' && !isOnline) && (
                                <Badge className="bg-brand-500/90 text-brand-dark text-[10px] border-0 gap-1 uppercase font-bold tracking-wider">
                                  <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3" />
                                  Sync Pending
                                </Badge>
                              )}
                              {img.status === 'uploading' && (
                                <Badge className="bg-brand-purple-500/90 text-white text-[10px] border-0 gap-1 uppercase font-bold tracking-wider">
                                  <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" />
                                  Uploading
                                </Badge>
                              )}
                              {img.status === 'synced' && (
                                <Badge className="bg-green-500/90 text-white text-[10px] border-0 gap-1 uppercase font-bold tracking-wider">
                                  <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3" />
                                  Synced
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Hero badge */}
                          {img.isHero && (
                            <div className="absolute bottom-2 left-2">
                              <Badge className="bg-brand-500 text-brand-dark text-[10px] border-0 gap-1">
                                <HugeiconsIcon icon={StarIcon} className="w-3 h-3" />
                                Cover
                              </Badge>
                            </div>
                          )}

                          {/* Remove button -- always visible */}
                          <button
                            onClick={() => removeImage(img.id)}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                          </button>

                          {/* Set as hero button */}
                          {!img.isHero && (
                            <button
                              onClick={() => setHero(img.id)}
                              className="absolute bottom-2 right-2 w-7 h-7 bg-black/60 hover:bg-brand-500 text-brand-dark rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                              title="Set as cover image"
                            >
                              <HugeiconsIcon icon={StarIcon} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Info -- two rows matching screenshot */}
                        <div className="px-3 py-2 space-y-0.5">
                          {/* Row 1: Status label + value */}
                          <div className="flex items-center justify-between">
                            {img.status === 'optimizing' ? (
                              <>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-purple-600 dark:text-brand-400">Local Compression</p>
                                <p className="text-[10px] font-bold text-brand-purple-600 dark:text-brand-400 tabular-nums">{img.progress}%</p>
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-500">Compressed</p>
                                <p className="text-[10px] font-bold text-muted-foreground tabular-nums">
                                  {img.compressedSize > 0
                                    ? `${Math.round(img.compressedSize / 1024)}KB`
                                    : `${Math.round(img.file.size / 1024)}KB`}
                                </p>
                              </>
                            )}
                          </div>
                          {/* Row 1.5: Progress bar for optimizing */}
                          {img.status === 'optimizing' && (
                            <Progress value={img.progress} className="h-1" />
                          )}
                          {/* Row 2: Filename */}
                          <p className="text-xs text-muted-foreground truncate">
                            {img.file.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
                <Button variant="ghost" onClick={prevStep}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                  Back to Details
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3.5 h-3.5 text-green-500" />
                    Draft saved locally
                  </span>
                  <Button
                    className="bg-brand-500 hover:bg-brand-600 text-brand-dark"
                    onClick={nextStep}
                  >
                    Next: Review
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ STEP 3: REVIEW & PUBLISH ═══════════════ */}
          {step === 3 && (
            <div>
              {/* Connected stepper */}
              <div className="flex items-center justify-center gap-0 mb-8">
                {['Details', 'Media', 'Review & Publish'].map((label, i) => (
                  <div key={label} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        i < 2 ? 'bg-green-600 text-white' :
                        'bg-green-600 text-white ring-2 ring-green-600/30'
                      )}>
                        {i + 1}
                      </div>
                      <p className={cn(
                        'text-[10px] sm:text-xs mt-1 font-medium whitespace-nowrap',
                        i === 2 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {label}
                      </p>
                    </div>
                    {i < 2 && (
                      <div className="w-12 sm:w-20 border-t-2 border-dashed border-muted-foreground/30 mx-1 sm:mx-2 mb-4" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Review & Publish</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">Step 3 of 3: Finalize your project settings</p>
                </div>
                <Button variant="outline" size="sm" onClick={prevStep}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
                  Back to Media
                </Button>
              </div>

              {/* Hero image preview */}
              <div
                className="rounded-2xl overflow-hidden mb-6 relative"
                style={dominantColor ? { boxShadow: `0 8px 40px ${dominantColor}33` } : undefined}
              >
                {heroImage?.preview ? (
                  <img
                    src={heroImage.preview}
                    alt={formData.title}
                    className="w-full h-48 sm:h-64 md:h-80 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 sm:h-64 md:h-80 bg-gradient-to-br from-brand-600/20 to-brand-purple-500/10 flex items-center justify-center">
                    <HugeiconsIcon icon={Image01Icon} className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
                {/* Gradient overlay at bottom */}
                {heroImage?.preview && (
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/80 to-transparent" />
                )}
              </div>

              {/* Video indicator */}
              {formData.video_url && parsedVideo && (
                <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    parsedVideo.platform === 'youtube' ? 'bg-red-600' :
                    parsedVideo.platform === 'vimeo' ? 'bg-[#1ab7ea]' :
                    'bg-brand-500'
                  )}>
                    <HugeiconsIcon icon={PlayIcon} className="w-5 h-5 text-white ml-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getPlatformLabel(parsedVideo.platform)} Video
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{formData.video_url}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500 flex-shrink-0">
                    <HugeiconsIcon icon={Film01Icon} className="w-3 h-3 mr-1" />
                    Will embed
                  </Badge>
                </div>
              )}

              {/* Title + Description + Tags */}
              <SpotlightCard className="mb-6">
                <div className="pt-5 pb-5 px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground">{formData.title}</h3>
                      {formData.description && (
                        <p className="text-muted-foreground text-sm mt-2 leading-relaxed whitespace-pre-line">
                          {formData.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={() => goToStep(1)}
                    >
                      <HugeiconsIcon icon={Edit01Icon} className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Tags */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {formData.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs"
                          style={dominantColor ? { borderColor: `${dominantColor}66` } : undefined}
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </SpotlightCard>

              {/* Privacy */}
              <div className="border-t border-border pt-5 mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Privacy Settings
                </p>
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
              </div>

              {/* Saved confirmation */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-6">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-500">Project saved to device!</p>
                  <p className="text-xs text-muted-foreground">Ready to sync as soon as you&apos;re online.</p>
                </div>
              </div>

              {/* Publish button */}
              {showCelebration ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <HugeiconsIcon icon={Tick01Icon} className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Your project is live!</h3>
                  <p className="text-muted-foreground text-sm mt-1">It&apos;s now part of your portfolio.</p>
                </div>
              ) : (
                <Button
                  className="w-full h-14 text-lg font-bold bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-xl transition-all"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  style={dominantColor ? {
                    background: `linear-gradient(135deg, ${dominantColor}, rgb(249, 115, 22))`,
                  } : undefined}
                >
                  {isPublishing ? (
                    <>
                      <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      Publish to Portfolio
                      <HugeiconsIcon icon={SentIcon} className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
