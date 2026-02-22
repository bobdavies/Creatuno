'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, AnalyticsUpIcon, ArrowRight01Icon, BarChartIcon, Bookmark01Icon, BookmarkCheck01Icon, Camera01Icon, Cancel01Icon, Delete02Icon, FireIcon, Image01Icon, Link01Icon, LinkSquare01Icon, Loading02Icon, Message01Icon, MoreHorizontalIcon, PlayIcon, Refresh01Icon, SentIcon, Share02Icon, SparklesIcon, UserAdd01Icon, UserGroupIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useCachedFetch } from '@/hooks/use-cached-fetch'
import { MdFavoriteBorder, MdBolt } from 'react-icons/md'
import SpotlightCard from '@/components/SpotlightCard'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from '@/lib/format-date'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { PendingSyncBadge } from '@/components/shared/pending-sync-badge'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PollData {
  question: string
  options: string[]
}

interface Post {
  id: string
  content: string
  images: string[]
  videoUrl: string | null
  author: {
    id: string
    fullName: string
    avatarUrl: string | null
    role: string
  }
  likesCount: number
  commentsCount: number
  hasLiked: boolean
  createdAt: string
  poll?: PollData
}

interface Comment {
  id: string
  content: string
  authorName: string
  authorAvatar: string | null
  createdAt: string
}

interface FeaturedOpp {
  id: string
  title: string
  description: string
  type: string
  budget_min: number
  budget_max: number
  currency: string
}

interface SuggestedUser {
  id: string
  name: string
  avatarUrl: string | null
  role: string
}

// ─── Constants & Helpers ────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

const FEED_TABS = [
  { key: 'all', label: 'All Feed' },
  { key: 'inspiration', label: 'Inspiration' },
  { key: 'questions', label: 'Questions' },
  { key: 'showcase', label: 'Showcase' },
  { key: 'gigs', label: 'Gigs' },
] as const

const QUICK_FILTERS = [
  { key: 'all', label: 'All Sparks', icon: SparklesIcon },
  { key: 'trending', label: 'Trending', icon: FireIcon },
  { key: 'saved', label: 'Saved', icon: Bookmark01Icon },
] as const

function getRoleLabel(role: string) {
  switch (role) {
    case 'employer': return 'Employer'
    case 'investor': return 'Investor'
    case 'mentor': return 'Mentor'
    default: return 'Creative'
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

function isEmbeddableVideoUrl(url: string): boolean {
  return !!extractYouTubeId(url) || !!extractVimeoId(url)
}

function detectUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,;:!?"')}\]])/gi
  return text.match(urlRegex) || []
}

function parsePollFromContent(content: string): { cleanContent: string; poll: PollData | null } {
  if (content.startsWith('[POLL]')) {
    try {
      const jsonStr = content.slice(6, content.indexOf('\n') > -1 ? content.indexOf('\n') : undefined)
      const poll = JSON.parse(jsonStr) as PollData
      const cleanContent = content.indexOf('\n') > -1 ? content.slice(content.indexOf('\n') + 1) : ''
      return { cleanContent, poll }
    } catch { return { cleanContent: content, poll: null } }
  }
  return { cleanContent: content, poll: null }
}

const SAVED_KEY = 'creatuno_saved_posts'
function getSavedPostIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const saved = localStorage.getItem(SAVED_KEY)
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch { return new Set() }
}
function saveSavedPostIds(ids: Set<string>) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]))
}

function getPollVote(postId: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(`poll_vote_${postId}`)
    return v !== null ? parseInt(v) : null
  } catch { return null }
}
function savePollVote(postId: string, optionIndex: number) {
  localStorage.setItem(`poll_vote_${postId}`, String(optionIndex))
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useUser()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newPostContent, setNewPostContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [showComposer, setShowComposer] = useState(false)

  // Media state
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [videoLinkUrl, setVideoLinkUrl] = useState('')
  const [showVideoLinkInput, setShowVideoLinkInput] = useState(false)

  // Camera state
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Filters and sidebar
  const [activeTab, setActiveTab] = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')
  const [featuredOpp, setFeaturedOpp] = useState<FeaturedOpp | null>(null)
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set())
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ─── Data Fetching (with offline caching) ────────────────────────────

  // Cached fetch for featured opportunity
  const { data: oppData } = useCachedFetch<{ opportunities?: any[] }>('/api/opportunities?limit=1', {
    cacheKey: 'feed:featured-opp',
    ttlMs: 60 * 60 * 1000, // 1 hour
  })

  useEffect(() => {
    if (oppData?.opportunities?.[0]) {
      const o = oppData.opportunities[0]
      setFeaturedOpp({
        id: o.id,
        title: o.title,
        description: o.description?.slice(0, 120) || '',
        type: o.type,
        budget_min: o.budgetMin || o.budget_min || 0,
        budget_max: o.budgetMax || o.budget_max || 0,
        currency: o.currency || 'USD',
      })
    }
  }, [oppData])

  // Cached fetch for suggested users
  const { data: suggestData } = useCachedFetch<{ results?: any[] }>('/api/search?q=&type=users', {
    cacheKey: 'feed:suggested',
    ttlMs: 60 * 60 * 1000, // 1 hour
  })

  useEffect(() => {
    if (suggestData?.results) {
      const users = suggestData.results.slice(0, 3).map((u: any) => ({
        id: u.id,
        name: u.title || u.name || 'User',
        avatarUrl: u.avatar || u.image || null,
        role: u.role || 'creative',
      }))
      setSuggestedUsers(users)
    }
  }, [suggestData])

  useEffect(() => { loadPosts() }, [])

  useEffect(() => { setSavedPostIds(getSavedPostIds()) }, [])

  const loadPosts = async () => {
    setIsLoading(true)
    try {
      // Try IndexedDB cache first when offline
      let cached: any = null
      try {
        const { getCachedData } = await import('@/lib/offline/indexed-db')
        cached = await getCachedData('api', 'feed:posts')
      } catch {}

      if (!navigator.onLine && cached?.payload) {
        setPosts(cached.payload)
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/posts')
      if (response.ok) {
        const data = await response.json()
        if (data.posts) {
          const realPosts = data.posts.map((p: any) => {
            const raw = p.content || ''
            const { cleanContent, poll } = parsePollFromContent(raw)
            return {
              id: p.id,
              content: poll ? cleanContent : raw,
              images: p.images || [],
              videoUrl: p.video_url || null,
              author: {
                id: p.user_id,
                fullName: p.profiles?.full_name || 'Unknown User',
                avatarUrl: p.profiles?.avatar_url || null,
                role: p.profiles?.role || 'creative',
              },
              likesCount: p.likes_count || 0,
              commentsCount: p.comments_count || 0,
              hasLiked: p.hasLiked || false,
              createdAt: p.created_at,
              poll: poll || undefined,
            }
          })
          setPosts(realPosts)
          // Cache posts for offline
          try {
            const { cacheData } = await import('@/lib/offline/indexed-db')
            await cacheData('api', 'feed:posts', { payload: realPosts }, 15 * 60 * 1000)
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Media Handling ───────────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + selectedImages.length > 4) {
      toast.error('Maximum 4 images per post')
      return
    }
    setSelectedImages(prev => [...prev, ...files])
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { toast.error('Video must be under 50MB'); return }
    if (selectedVideo) URL.revokeObjectURL(videoPreview!)
    setSelectedVideo(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  const handleRemoveVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setSelectedVideo(null)
    setVideoPreview(null)
  }

  // Camera
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setCameraStream(stream)
      setShowCamera(true)
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.play()
        }
      }, 100)
    } catch (err) {
      toast.error('Unable to access camera. Please check permissions.')
    }
  }

  const capturePhoto = () => {
    if (!cameraVideoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = cameraVideoRef.current.videoWidth
    canvas.height = cameraVideoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(cameraVideoRef.current, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
      setSelectedImages(prev => [...prev, file])
      setImagePreviews(prev => [...prev, URL.createObjectURL(file)])
      closeCamera()
      toast.success('Photo captured!')
    }, 'image/jpeg', 0.9)
  }

  const startVideoRecording = () => {
    if (!cameraStream) return
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm' })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'video/webm' })
      if (selectedVideo) URL.revokeObjectURL(videoPreview!)
      setSelectedVideo(file)
      setVideoPreview(URL.createObjectURL(file))
      closeCamera()
      toast.success('Video recorded!')
    }
    mediaRecorderRef.current = recorder
    setRecordedChunks([])
    recorder.start()
    setIsRecording(true)
  }

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    }
    setShowCamera(false)
    setIsRecording(false)
  }

  const uploadMedia = async (files: File[]): Promise<string[]> => {
    const urls: string[] = []
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'posts')
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        if (response.ok) {
          const data = await response.json()
          if (data.url) urls.push(data.url)
        }
      } catch (error) { console.error('Error uploading:', error) }
    }
    return urls
  }

  // ─── Post Actions ─────────────────────────────────────────────────────

  const resetComposer = () => {
    setNewPostContent('')
    setSelectedImages([])
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImagePreviews([])
    handleRemoveVideo()
    setVideoLinkUrl('')
    setShowVideoLinkInput(false)
    setShowPollCreator(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setShowComposer(false)
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !showPollCreator) { toast.error('Please write something to post'); return }
    if (newPostContent.length > 1000) { toast.error('Post must be under 1000 characters'); return }

    // Validate poll
    if (showPollCreator) {
      const validOptions = pollOptions.filter(o => o.trim())
      if (validOptions.length < 2) { toast.error('Poll needs at least 2 options'); return }
    }

    setIsPosting(true)
    try {
      let imageUrls: string[] = []
      let videoUrl: string | null = null

      // Upload images
      if (selectedImages.length > 0) {
        toast.info('Uploading images...')
        imageUrls = await uploadMedia(selectedImages)
      }

      // Upload or set video
      if (selectedVideo) {
        toast.info('Uploading video...')
        const videoUrls = await uploadMedia([selectedVideo])
        if (videoUrls[0]) videoUrl = videoUrls[0]
      } else if (videoLinkUrl.trim()) {
        videoUrl = videoLinkUrl.trim()
      }

      // Build content with poll prefix if needed
      let finalContent = newPostContent.trim()
      let pollData: PollData | undefined
      if (showPollCreator) {
        const validOptions = pollOptions.filter(o => o.trim())
        pollData = { question: pollQuestion.trim() || finalContent, options: validOptions }
        finalContent = `[POLL]${JSON.stringify(pollData)}\n${finalContent}`
      }

      // If offline, queue the post for later sync
      if (!navigator.onLine) {
        const localId = `offline_${Date.now()}`
        const offlinePost: Post = {
          id: localId,
          content: showPollCreator ? (newPostContent.trim() || '') : newPostContent.trim(),
          images: imageUrls,
          videoUrl,
          author: { id: user?.id || 'anonymous', fullName: user?.fullName || 'You', avatarUrl: user?.imageUrl || null, role: 'creative' },
          likesCount: 0, commentsCount: 0, hasLiked: false, createdAt: new Date().toISOString(),
          poll: pollData,
        }
        setPosts(prev => [offlinePost, ...prev])
        resetComposer()
        toast.success('Spark saved offline — will sync when you reconnect')
        // Queue for sync
        try {
          const { addToSyncQueue } = await import('@/lib/offline/indexed-db')
          await addToSyncQueue({
            id: localId,
            action: 'create',
            table: 'posts',
            data: { content: finalContent, images: imageUrls, video_url: videoUrl },
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
          })
        } catch {}
        setIsPosting(false)
        return
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: finalContent, images: imageUrls, video_url: videoUrl }),
      })

      if (response.ok) {
        const data = await response.json()
        const newPost: Post = {
          id: data.post?.id || `local_${Date.now()}`,
          content: showPollCreator ? (newPostContent.trim() || '') : newPostContent.trim(),
          images: imageUrls,
          videoUrl,
          author: { id: user?.id || 'anonymous', fullName: user?.fullName || 'You', avatarUrl: user?.imageUrl || null, role: 'creative' },
          likesCount: 0, commentsCount: 0, hasLiked: false, createdAt: new Date().toISOString(),
          poll: pollData,
        }
        setPosts(prev => [newPost, ...prev])
        resetComposer()
        toast.success('Spark shared!')
      } else { toast.error('Failed to create post') }
    } catch (error) { console.error('Error creating post:', error); toast.error('Failed to create post') }
    finally { setIsPosting(false) }
  }

  const handleLike = async (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const newLiked = !post.hasLiked
        fetch('/api/posts/like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: postId, action: newLiked ? 'like' : 'unlike' }),
        }).catch(console.error)
        return { ...post, hasLiked: newLiked, likesCount: newLiked ? post.likesCount + 1 : post.likesCount - 1 }
      }
      return post
    }))
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this spark?')) return
    try {
      const response = await fetch(`/api/posts?id=${postId}`, { method: 'DELETE' })
      if (response.ok) {
        setPosts(posts.filter(p => p.id !== postId))
        toast.success('Spark deleted')
      }
    } catch (error) { console.error('Error deleting post:', error) }
  }

  const handleBookmark = useCallback((postId: string) => {
    setSavedPostIds(prev => {
      const next = new Set(prev)
      if (next.has(postId)) { next.delete(postId) } else { next.add(postId) }
      saveSavedPostIds(next)
      return next
    })
  }, [])

  // ─── Filtering ────────────────────────────────────────────────────────

  const filteredPosts = posts.filter(post => {
    if (quickFilter === 'trending') return post.likesCount > 0 || post.commentsCount > 0
    if (quickFilter === 'saved') return savedPostIds.has(post.id)
    switch (activeTab) {
      case 'inspiration': return post.images.length > 0 || post.videoUrl
      case 'questions': return post.content.includes('?')
      case 'showcase': return post.images.length > 0
      case 'gigs': return /gig|job|hire|opportunit|work|freelance/i.test(post.content)
      default: return true
    }
  })

  // ─── Stats & Derived ─────────────────────────────────────────────────

  const sparksToday = posts.filter(p => {
    const d = new Date(p.createdAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  const trendingPosts = [...posts]
    .sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
    .slice(0, 3)

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <OfflineBanner message="You're offline — showing cached posts" />

      {/* ━━━ HERO HEADER ━━━ */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8 sm:pb-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-500/80 dark:text-brand-400/80">Community</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  <span className="text-brand-dark dark:text-foreground">
                    Village Square
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">The Village Square</p>
              </div>
              <button
                onClick={loadPosts}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all disabled:opacity-50"
              >
                <HugeiconsIcon icon={Refresh01Icon} className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━━ THREE-COLUMN LAYOUT ━━━ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-3">Quick Filters</p>
              {QUICK_FILTERS.map((f) => {
                const active = quickFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setQuickFilter(f.key)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                      active
                        ? 'bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 ring-1 ring-brand-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <HugeiconsIcon icon={f.icon} className="w-4 h-4" />
                    {f.label}
                    {f.key === 'saved' && savedPostIds.size > 0 && (
                      <span className="ml-auto text-[10px] bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 rounded-full px-1.5">{savedPostIds.size}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── CENTER FEED ── */}
          <div className="min-w-0">

            {/* Mobile Quick Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 lg:hidden scrollbar-hide">
              {QUICK_FILTERS.map((f) => {
                const active = quickFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => setQuickFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'bg-brand-500 text-brand-dark'
                        : 'bg-card/50 border border-border/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <HugeiconsIcon icon={f.icon} className="w-3 h-3" />
                    {f.label}
                  </button>
                )
              })}
            </div>

            {/* Post Composer */}
            <motion.div
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden mb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease }}
            >
              <AnimatePresence mode="wait">
                {showComposer ? (
                  <motion.div
                    key="expanded"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="p-4"
                  >
                    <div className="flex gap-3">
                      <Avatar className="w-10 h-10 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 flex-shrink-0">
                        <AvatarImage src={user?.imageUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                          {user?.firstName?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <Textarea
                          placeholder="Share work, ask questions, celebrate wins..."
                          value={newPostContent}
                          onChange={(e) => setNewPostContent(e.target.value)}
                          rows={4}
                          className="resize-none bg-transparent border-border/50 focus:border-brand-500/40 focus:ring-2 focus:ring-brand-purple-500/10 dark:ring-brand-500/10 rounded-xl"
                          maxLength={1000}
                          autoFocus
                        />

                        {/* Camera Modal */}
                        <AnimatePresence>
                          {showCamera && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="rounded-xl overflow-hidden border border-border/50">
                              <div className="relative bg-black rounded-xl">
                                <video ref={cameraVideoRef} className="w-full h-48 object-cover rounded-xl" muted playsInline />
                                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                                  <button onClick={capturePhoto} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors" title="Take Photo">
                                    <HugeiconsIcon icon={Camera01Icon} className="w-5 h-5" />
                                  </button>
                                  {!isRecording ? (
                                    <button onClick={startVideoRecording} className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors" title="Record Video">
                                      <div className="w-3 h-3 rounded-full bg-white" />
                                    </button>
                                  ) : (
                                    <button onClick={stopVideoRecording} className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors animate-pulse" title="Stop Recording">
                                      <div className="w-3 h-3 rounded-sm bg-white" />
                                    </button>
                                  )}
                                  <button onClick={closeCamera} className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                                    <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
                                  </button>
                                </div>
                                {isRecording && (
                                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    REC
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Video Link Input */}
                        <AnimatePresence>
                          {showVideoLinkInput && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                              <div className="flex gap-2">
                                <input
                                  placeholder="Paste YouTube or Vimeo URL..."
                                  value={videoLinkUrl}
                                  onChange={(e) => setVideoLinkUrl(e.target.value)}
                                  className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40"
                                />
                                <button onClick={() => { setShowVideoLinkInput(false); setVideoLinkUrl('') }} className="p-2 text-muted-foreground hover:text-foreground">
                                  <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
                                </button>
                              </div>
                              {videoLinkUrl && isEmbeddableVideoUrl(videoLinkUrl) && (
                                <p className="text-[10px] text-green-500 mt-1">Video link detected and will be embedded</p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Poll Creator */}
                        <AnimatePresence>
                          {showPollCreator && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                              <div className="space-y-2 p-3 rounded-xl border border-border/50 bg-muted/20">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-foreground">Create a Poll</p>
                                  <button onClick={() => setShowPollCreator(false)} className="text-muted-foreground hover:text-foreground"><HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" /></button>
                                </div>
                                <input
                                  placeholder="Poll question (optional, uses post text if empty)"
                                  value={pollQuestion}
                                  onChange={(e) => setPollQuestion(e.target.value)}
                                  className="w-full bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40"
                                />
                                {pollOptions.map((opt, i) => (
                                  <div key={i} className="flex gap-2">
                                    <input
                                      placeholder={`Option ${i + 1}`}
                                      value={opt}
                                      onChange={(e) => {
                                        const next = [...pollOptions]
                                        next[i] = e.target.value
                                        setPollOptions(next)
                                      }}
                                      className="flex-1 bg-transparent border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40"
                                    />
                                    {pollOptions.length > 2 && (
                                      <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500">
                                        <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {pollOptions.length < 4 && (
                                  <button
                                    onClick={() => setPollOptions([...pollOptions, ''])}
                                    className="flex items-center gap-1 text-[10px] text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 font-medium"
                                  >
                                    <HugeiconsIcon icon={Add01Icon} className="w-3 h-3" />
                                    Add Option
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Image Previews */}
                        <AnimatePresence>
                          {imagePreviews.length > 0 && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 flex-wrap">
                              {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden">
                                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors">
                                    <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Video Preview */}
                        <AnimatePresence>
                          {videoPreview && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                              <div className="relative rounded-xl overflow-hidden">
                                <video src={videoPreview} controls className="w-full max-h-48 rounded-xl" />
                                <button onClick={handleRemoveVideo} className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors">
                                  <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Media Toolbar */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={selectedImages.length >= 4}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all disabled:opacity-40"
                          >
                            <HugeiconsIcon icon={Image01Icon} className="w-3.5 h-3.5" />
                            Photo
                          </button>
                          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />

                          <button
                            onClick={() => videoInputRef.current?.click()}
                            disabled={!!selectedVideo}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all disabled:opacity-40"
                          >
                            <HugeiconsIcon icon={Video01Icon} className="w-3.5 h-3.5" />
                            Video
                          </button>
                          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoSelect} className="hidden" />

                          <button
                            onClick={openCamera}
                            disabled={showCamera}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/50 transition-all disabled:opacity-40"
                          >
                            <HugeiconsIcon icon={Camera01Icon} className="w-3.5 h-3.5" />
                            Camera
                          </button>

                          <button
                            onClick={() => setShowVideoLinkInput(!showVideoLinkInput)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 transition-all',
                              showVideoLinkInput ? 'text-brand-purple-600 dark:text-brand-400 bg-brand-purple-500/10 dark:bg-brand-500/10 border-brand-purple-500/30 dark:border-brand-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            <HugeiconsIcon icon={Link01Icon} className="w-3.5 h-3.5" />
                            Link
                          </button>

                          <button
                            onClick={() => setShowPollCreator(!showPollCreator)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 transition-all',
                              showPollCreator ? 'text-brand-purple-600 dark:text-brand-400 bg-brand-purple-500/10 dark:bg-brand-500/10 border-brand-purple-500/30 dark:border-brand-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            <HugeiconsIcon icon={BarChartIcon} className="w-3.5 h-3.5" />
                            Poll
                          </button>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <span className={cn('text-[10px] font-medium', newPostContent.length > 900 ? 'text-red-500' : 'text-muted-foreground')}>
                            {newPostContent.length}/1000
                          </span>
                          <div className="flex items-center gap-2">
                            <button onClick={resetComposer} className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                              Cancel
                            </button>
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                              <Button
                                size="sm"
                                className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
                                onClick={handleCreatePost}
                                disabled={isPosting || (!newPostContent.trim() && !showPollCreator)}
                              >
                                {isPosting ? <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 animate-spin" /> : <><HugeiconsIcon icon={SentIcon} className="w-3.5 h-3.5 mr-1.5" />Post Spark</>}
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="collapsed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 flex items-center gap-3 cursor-pointer"
                    onClick={() => setShowComposer(true)}
                  >
                    <Avatar className="w-10 h-10 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 flex-shrink-0">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                        {user?.firstName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 px-4 py-3 rounded-full bg-muted/50 border border-border/50 text-sm text-muted-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-colors">
                      Share a Spark...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Category Filter Tabs */}
            <motion.div
              className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease }}
            >
              {FEED_TABS.map((tab) => {
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
                        layoutId="feedTab"
                        className="absolute inset-0 bg-brand-500 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </motion.button>
                )
              })}
            </motion.div>

            {/* Posts Feed -- FIX: direct initial/animate, no variant inheritance through AnimatePresence */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <SpotlightCard key={i} className="p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-muted/60" />
                      <div className="space-y-1.5"><div className="h-3.5 w-28 bg-muted/60 rounded" /><div className="h-3 w-20 bg-muted/40 rounded" /></div>
                    </div>
                    <div className="space-y-2"><div className="h-3 w-full bg-muted/40 rounded" /><div className="h-3 w-3/4 bg-muted/40 rounded" /></div>
                    <div className="h-48 bg-muted/30 rounded-xl mt-4" />
                  </SpotlightCard>
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, transition: { duration: 0.3 } }}
                      transition={{ duration: 0.45, delay: index * 0.06, ease }}
                      layout
                    >
                      <PostCard
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onDelete={() => handleDeletePost(post.id)}
                        onBookmark={() => handleBookmark(post.id)}
                        isOwner={post.author.id === user?.id}
                        isBookmarked={savedPostIds.has(post.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                    <HugeiconsIcon icon={Message01Icon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {quickFilter === 'saved' ? 'No saved sparks' : 'No sparks yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  {quickFilter === 'saved' ? 'Bookmark sparks to find them here later.' : 'Nothing here yet. Be the first to post.'}
                </p>
                {quickFilter !== 'saved' && (
                  <Button className="bg-brand-500 hover:bg-brand-600 rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" onClick={() => setShowComposer(true)}>
                    <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-2" />
                    Share a Spark
                  </Button>
                )}
              </motion.div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-5">

              {/* Village Stats */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease }}
              >
                <SpotlightCard className="p-4 sm:p-5 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Village Stats</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Creatives Online</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{Math.max(posts.length * 3, 12)}</span>
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">New Sparks Today</span>
                      <span className="text-sm font-bold text-foreground">{sparksToday}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Sparks</span>
                      <span className="text-sm font-bold text-foreground">{posts.length}</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4 rounded-xl text-xs border-border/50" asChild>
                    <Link href="/search">View Full Census</Link>
                  </Button>
                </SpotlightCard>
              </motion.div>

              {/* Trending Sparks */}
              {trendingPosts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35, ease }}
                >
                  <SpotlightCard className="p-4 sm:p-5 overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <HugeiconsIcon icon={AnalyticsUpIcon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trending Sparks</p>
                    </div>
                    <div className="space-y-3">
                      {trendingPosts.map((p, i) => (
                        <div key={p.id} className="flex gap-2.5">
                          <span className="text-lg font-bold text-brand-purple-400/40 dark:text-brand-400/40 leading-none mt-0.5">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-foreground line-clamp-2">{p.content.replace(/^\[POLL\].*?\n?/, '').slice(0, 80)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{p.author.fullName} &middot; {p.likesCount + p.commentsCount} interactions</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SpotlightCard>
                </motion.div>
              )}

              {/* Mentor Spotlights */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4, ease }}
              >
                <SpotlightCard className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mentor Spotlights</p>
                    <Link href="/mentorship" className="text-[10px] font-bold text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 uppercase tracking-wider transition-colors">
                      See All
                    </Link>
                  </div>
                  <div className="space-y-3">
                    <Link href="/mentorship" className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-purple-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <HugeiconsIcon icon={UserGroupIcon} className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">Find a Mentor</p>
                        <p className="text-[11px] text-muted-foreground truncate">Connect with experienced creatives</p>
                      </div>
                    </Link>
                    <Link href="/mentorship" className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-purple-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">Become a Mentor</p>
                        <p className="text-[11px] text-muted-foreground truncate">Share your expertise</p>
                      </div>
                    </Link>
                  </div>
                </div>
                </SpotlightCard>
              </motion.div>

              {/* Suggested Creatives */}
              {suggestedUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.45, ease }}
                >
                  <SpotlightCard className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <HugeiconsIcon icon={UserAdd01Icon} className="w-3.5 h-3.5 text-brand-purple-600 dark:text-brand-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suggested Creatives</p>
                    </div>
                    <div className="space-y-3">
                      {suggestedUsers.map((u) => (
                        <Link key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={u.avatarUrl || undefined} />
                            <AvatarFallback className="text-[9px] bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">{u.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground">{getRoleLabel(u.role)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  </SpotlightCard>
                </motion.div>
              )}

              {/* Featured Opportunity */}
              {featuredOpp && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5, ease }}
                >
                  <SpotlightCard className="bg-gradient-to-br from-brand-500/5 to-brand-purple-500/5 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MdBolt className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400">Featured {featuredOpp.type === 'job' ? 'Job' : featuredOpp.type === 'gig' ? 'Gig' : 'Opportunity'}</p>
                    </div>
                    <h4 className="text-sm font-bold text-foreground mb-1 line-clamp-2">{featuredOpp.title}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{featuredOpp.description}</p>
                    {featuredOpp.budget_min > 0 && (
                      <p className="text-sm font-bold text-brand-purple-600 dark:text-brand-400 mb-3">
                        {featuredOpp.currency} {featuredOpp.budget_min.toLocaleString()}+
                      </p>
                    )}
                    <Button size="sm" className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl text-xs shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                      <Link href={`/opportunities/${featuredOpp.id}`}>
                        Apply Now
                        <HugeiconsIcon icon={ArrowRight01Icon} className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  </SpotlightCard>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Video Embed Component ──────────────────────────────────────────────────

function VideoEmbed({ url }: { url: string }) {
  const ytId = extractYouTubeId(url)
  const vimeoId = extractVimeoId(url)

  if (ytId) {
    return (
      <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden mt-2">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}`}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (vimeoId) {
    return (
      <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden mt-2">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // Native video
  return (
    <div className="mt-2 rounded-xl overflow-hidden">
      <video src={url} controls className="w-full max-h-[400px] rounded-xl" />
    </div>
  )
}

// ─── Link Preview Component ─────────────────────────────────────────────────

function LinkPreview({ url }: { url: string }) {
  const hostname = new URL(url).hostname.replace('www.', '')
  if (isEmbeddableVideoUrl(url)) return null // handled by VideoEmbed
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 mt-2 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all group">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-purple-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0">
        <HugeiconsIcon icon={LinkSquare01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors truncate">{hostname}</p>
        <p className="text-[10px] text-muted-foreground truncate">{url}</p>
      </div>
    </a>
  )
}

// ─── Poll Display Component ─────────────────────────────────────────────────

function PollDisplay({ postId, poll }: { postId: string; poll: PollData }) {
  const [voted, setVoted] = useState<number | null>(() => getPollVote(postId))
  const [votes, setVotes] = useState<number[]>(() => {
    // Initialize with 0 votes or restore from localStorage
    try {
      const stored = localStorage.getItem(`poll_results_${postId}`)
      return stored ? JSON.parse(stored) : poll.options.map(() => 0)
    } catch { return poll.options.map(() => 0) }
  })

  const totalVotes = votes.reduce((a, b) => a + b, 0)

  const handleVote = (index: number) => {
    if (voted !== null) return
    const newVotes = [...votes]
    newVotes[index] += 1
    setVotes(newVotes)
    setVoted(index)
    savePollVote(postId, index)
    localStorage.setItem(`poll_results_${postId}`, JSON.stringify(newVotes))
  }

  return (
    <div className="mt-3 space-y-2">
      {poll.question && <p className="text-sm font-medium text-foreground">{poll.question}</p>}
      {poll.options.map((option, i) => {
        const count = votes[i]
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
        const isSelected = voted === i
        return (
          <button
            key={i}
            onClick={() => handleVote(i)}
            disabled={voted !== null}
            className={cn(
              'relative w-full text-left rounded-xl overflow-hidden border transition-all',
              voted !== null ? 'cursor-default' : 'cursor-pointer hover:border-brand-500/40',
              isSelected ? 'border-brand-purple-500/50 dark:border-brand-500/50' : 'border-border/50'
            )}
          >
            {voted !== null && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease }}
                className={cn('absolute inset-y-0 left-0 rounded-xl', isSelected ? 'bg-brand-500/15' : 'bg-muted/40')}
              />
            )}
            <div className="relative flex items-center justify-between px-3 py-2.5">
              <span className="text-xs font-medium text-foreground">{option}</span>
              {voted !== null && <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>}
            </div>
          </button>
        )
      })}
      <p className="text-[10px] text-muted-foreground">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ─── Post Card Component ────────────────────────────────────────────────────

function PostCard({ post, onLike, onDelete, onBookmark, isOwner, isBookmarked }: {
  post: Post
  onLike: () => void
  onDelete: () => void
  onBookmark: () => void
  isOwner: boolean
  isBookmarked: boolean
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isCommenting, setIsCommenting] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const { user } = useUser()

  useEffect(() => {
    if (showComments && !commentsLoaded) loadComments()
  }, [showComments, commentsLoaded])

  const loadComments = async () => {
    setIsLoadingComments(true)
    try {
      const response = await fetch(`/api/posts/comment?post_id=${post.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.comments) {
          setComments(data.comments.map((c: any) => ({
            id: c.id, content: c.content, authorName: c.profiles?.full_name || 'Unknown User', authorAvatar: c.profiles?.avatar_url || null, createdAt: c.created_at,
          })))
          setCommentsLoaded(true)
        }
      }
    } catch (error) { console.error('Error loading comments:', error) }
    finally { setIsLoadingComments(false) }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setIsCommenting(true)
    try {
      const response = await fetch('/api/posts/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, content: newComment.trim() }),
      })
      if (response.ok) {
        setComments([...comments, {
          id: `comment_${Date.now()}`, content: newComment.trim(), authorName: user?.fullName || 'You', authorAvatar: user?.imageUrl || null, createdAt: new Date().toISOString(),
        }])
        setNewComment('')
      }
    } catch (error) { console.error('Error adding comment:', error) }
    finally { setIsCommenting(false) }
  }

  const isShort = post.content.length < 120 && post.images.length === 0 && !post.videoUrl && !post.poll
  const urls = detectUrls(post.content)
  const embeddableUrl = urls.find(isEmbeddableVideoUrl)
  const linkUrls = urls.filter(u => !isEmbeddableVideoUrl(u))

  return (
    <SpotlightCard className={cn(
      'overflow-hidden transition-all duration-300',
      'hover:border-brand-purple-500/20 dark:border-brand-500/20 hover:shadow-lg hover:shadow-brand-500/5'
    )}>
      {/* Author Header */}
      <div className="flex items-start justify-between p-4 pb-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-border/50">
            <AvatarImage src={post.author.avatarUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
              {post.author.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{post.author.fullName}</p>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium text-muted-foreground border-border/50 hidden sm:inline-flex">
                {getRoleLabel(post.author.role)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(post.createdAt)}</p>
              {post.id.startsWith('offline_') && <PendingSyncBadge />}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <HugeiconsIcon icon={MoreHorizontalIcon} className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {isOwner && (
              <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
                <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>Report</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-2">
        {post.content && (
          <p className={cn(
            'text-foreground whitespace-pre-wrap',
            isShort ? 'text-lg font-medium' : 'text-sm leading-relaxed'
          )}>
            {post.content}
          </p>
        )}

        {/* Poll */}
        {post.poll && <PollDisplay postId={post.id} poll={post.poll} />}

        {/* Link Previews */}
        {linkUrls.map((url, i) => <LinkPreview key={i} url={url} />)}

        {/* Embedded video from URL in content */}
        {embeddableUrl && <VideoEmbed url={embeddableUrl} />}
      </div>

      {/* Images */}
      {post.images.length > 0 && (
        <div className="px-4 pb-2">
          <div className={cn(
            'grid gap-1.5 rounded-xl overflow-hidden mt-2',
            post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {post.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Post image ${idx + 1}`}
                className={cn(
                  'w-full object-cover rounded-xl',
                  post.images.length === 1 ? 'max-h-[400px]' : 'h-48'
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Video */}
      {post.videoUrl && (
        <div className="px-4 pb-2">
          <VideoEmbed url={post.videoUrl} />
        </div>
      )}

      {/* Footer: Actions */}
      <div className="px-4 py-3 border-t border-border/30 mt-1">
        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={onLike}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              post.hasLiked
                ? 'text-red-500 bg-red-500/10'
                : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/5'
            )}
          >
            <MdFavoriteBorder className={cn('w-4 h-4', post.hasLiked && 'fill-current')} />
            {post.likesCount > 0 && <span>{post.likesCount}</span>}
          </motion.button>

          <button
            onClick={() => setShowComments(!showComments)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              showComments
                ? 'text-brand-purple-600 dark:text-brand-400 bg-brand-purple-500/10'
                : 'text-muted-foreground hover:text-brand-purple-600 dark:hover:text-brand-400 hover:bg-brand-purple-500/5'
            )}
          >
            <HugeiconsIcon icon={Message01Icon} className="w-4 h-4" />
            {(post.commentsCount > 0 || comments.length > 0) && <span>{Math.max(post.commentsCount, comments.length)}</span>}
          </button>

          <motion.button
            whileTap={{ scale: 1.2 }}
            onClick={onBookmark}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              isBookmarked
                ? 'text-brand-purple-500 bg-brand-purple-500/10'
                : 'text-muted-foreground hover:text-brand-purple-500 hover:bg-brand-purple-500/5'
            )}
          >
            {isBookmarked ? <HugeiconsIcon icon={BookmarkCheck01Icon} className="w-4 h-4 fill-current" /> : <HugeiconsIcon icon={Bookmark01Icon} className="w-4 h-4" />}
          </motion.button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-auto">
            <HugeiconsIcon icon={Share02Icon} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
              {isLoadingComments ? (
                <div className="flex justify-center py-3"><HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-brand-purple-600 dark:text-brand-400" /></div>
              ) : comments.length > 0 ? (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {comments.map((comment, i) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="flex gap-2"
                    >
                      <Avatar className="w-7 h-7 flex-shrink-0">
                        <AvatarImage src={comment.authorAvatar || undefined} />
                        <AvatarFallback className="text-[9px] bg-muted font-bold">{comment.authorName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold text-foreground">{comment.authorName}</p>
                          <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(comment.createdAt)}</span>
                        </div>
                        <p className="text-xs text-foreground mt-0.5">{comment.content}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
              )}

              {/* Add Comment */}
              <div className="flex gap-2">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="text-[9px] bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">{user?.firstName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-1.5">
                  <input
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 bg-muted/50 border border-border/50 rounded-full px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-purple-500/10 dark:ring-brand-500/10"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleAddComment}
                    disabled={isCommenting || !newComment.trim()}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark disabled:opacity-40 transition-colors"
                  >
                    {isCommenting ? <HugeiconsIcon icon={Loading02Icon} className="w-3.5 h-3.5 animate-spin" /> : <HugeiconsIcon icon={SentIcon} className="w-3.5 h-3.5" />}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SpotlightCard>
  )
}
