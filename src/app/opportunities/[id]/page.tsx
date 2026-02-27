'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon, ArrowLeft01Icon, ArrowRight01Icon, Briefcase01Icon, Building02Icon, Calendar01Icon, Cancel01Icon, CheckmarkCircle01Icon, Clock01Icon, FileAttachmentIcon, LinkSquare01Icon, Loading02Icon, Location01Icon, Login01Icon, PackageIcon, SentIcon, Shield01Icon, SparklesIcon, Upload01Icon, UserAdd01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { MdAttachMoney, MdBolt } from 'react-icons/md'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'
import SpotlightCard from '@/components/SpotlightCard'
import { useSession } from '@/components/providers/user-session-provider'

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

interface WorkSubmissionFile {
  url: string | null
  path?: string
  bucket?: string
  protected?: boolean
  name: string
  size: number
  type: string
}

interface WorkSubmissionItem {
  id: string
  message: string
  files: WorkSubmissionFile[]
  status: 'submitted' | 'revision_requested' | 'approved' | 'payment_pending' | 'superseded'
  feedback: string | null
  created_at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

function getTypeAccent(type: OpportunityType) {
  switch (type) {
    case 'gig': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/15 to-brand-500/10', glow: 'rgba(126,93,167,0.15)' }
    case 'job': return { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-500', bgLight: 'bg-brand-500/10', border: 'border-brand-500/30', gradient: 'from-brand-600/30 via-brand-500/15 to-brand-500/10', glow: 'rgba(254,199,20,0.15)' }
    case 'investment': return { text: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30', gradient: 'from-brand-purple-600/30 via-brand-purple-500/15 to-brand-500/10', glow: 'rgba(126,93,167,0.15)' }
  }
}

function getTypeIconEl(type: OpportunityType, className = 'w-3 h-3 mr-1') {
  switch (type) {
    case 'gig': return <MdBolt className={className} />
    case 'job': return <HugeiconsIcon icon={Briefcase01Icon} className={className} />
    case 'investment': return <HugeiconsIcon icon={AnalyticsUpIcon} className={className} />
  }
}

function getSubmissionStatusColor(status: string) {
  switch (status) {
    case 'submitted': return { dot: 'bg-brand-purple-500', ring: 'ring-brand-purple-500/30', text: 'text-brand-purple-600 dark:text-brand-400', bgLight: 'bg-brand-purple-500/10', border: 'border-brand-purple-500/30' }
    case 'revision_requested': return { dot: 'bg-brand-500', ring: 'ring-brand-500/30', text: 'text-brand-600 dark:text-brand-400', bgLight: 'bg-brand-500/10', border: 'border-brand-500/30' }
    case 'approved': return { dot: 'bg-green-500', ring: 'ring-green-500/30', text: 'text-green-500', bgLight: 'bg-green-500/10', border: 'border-green-500/30' }
    case 'payment_pending': return { dot: 'bg-orange-500', ring: 'ring-orange-500/30', text: 'text-orange-500', bgLight: 'bg-orange-500/10', border: 'border-orange-500/30' }
    case 'superseded': return { dot: 'bg-slate-400', ring: 'ring-slate-400/30', text: 'text-slate-400', bgLight: 'bg-slate-400/10', border: 'border-slate-400/30' }
    default: return { dot: 'bg-muted-foreground', ring: 'ring-muted-foreground/30', text: 'text-muted-foreground', bgLight: 'bg-muted', border: 'border-border' }
  }
}

function getAppStatusStep(status: string | null) {
  switch (status) {
    case 'accepted': return 3
    case 'reviewed': return 2
    default: return 1
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OpportunityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const { userId: sessionUserId, role } = useSession()
  const opportunityId = params.id as string

  const isAuthenticated = isLoaded && !!user

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasApplied, setHasApplied] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)

  // Auth-gate prompt
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

  // Work submission state
  const [isSubmitWorkOpen, setIsSubmitWorkOpen] = useState(false)
  const [workMessage, setWorkMessage] = useState('')
  const [workFiles, setWorkFiles] = useState<File[]>([])
  const [isSubmittingWork, setIsSubmittingWork] = useState(false)
  const [submissions, setSubmissions] = useState<WorkSubmissionItem[]>([])
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string; phase: 'uploading' | 'submitting' } | null>(null)


  useEffect(() => {
    loadOpportunity()
  }, [opportunityId])

  // Gate application check behind auth readiness
  useEffect(() => {
    if (sessionUserId) {
      checkExistingApplication()
    }
  }, [opportunityId, sessionUserId])

  const loadOpportunity = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/opportunities?id=${opportunityId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.opportunity) setOpportunity(data.opportunity)
      }
    } catch (error) {
      console.error('Error loading opportunity:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkExistingApplication = async () => {
    try {
      const response = await fetch(`/api/applications?opportunity_id=${opportunityId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.applications && data.applications.length > 0) {
          const app = data.applications[0]
          setHasApplied(true)
          setApplicationStatus(app.status)
          setApplicationId(app.id)
          if (app.status === 'accepted') loadWorkSubmissions(app.id)
        }
      }
    } catch { /* ignore */ }
  }

  const loadWorkSubmissions = async (appId: string) => {
    setIsLoadingSubmissions(true)
    try {
      const response = await fetch(`/api/work-submissions?application_id=${appId}`)
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data.submissions || [])
      }
    } catch (error) {
      console.error('Error loading work submissions:', error)
    } finally {
      setIsLoadingSubmissions(false)
    }
  }

  const handleSubmitWork = async () => {
    if (!workMessage.trim() && workFiles.length === 0) {
      toast.error('Please provide a message or upload files')
      return
    }
    setIsSubmittingWork(true)
    try {
      const uploadedFiles: WorkSubmissionFile[] = []
      for (let i = 0; i < workFiles.length; i++) {
        const file = workFiles[i]
        setUploadProgress({ current: i + 1, total: workFiles.length, fileName: file.name, phase: 'uploading' })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'deliverables')
        const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          uploadedFiles.push({
            url: uploadData.url,
            path: uploadData.path,
            bucket: uploadData.bucket,
            protected: uploadData.protected,
            name: file.name,
            size: file.size,
            type: file.type,
          })
        } else {
          const errData = await uploadResponse.json().catch(() => null)
          toast.error(errData?.error || `Failed to upload ${file.name}`)
          setIsSubmittingWork(false)
          setUploadProgress(null)
          return
        }
      }
      setUploadProgress({ current: workFiles.length, total: workFiles.length, fileName: '', phase: 'submitting' })
      const response = await fetch('/api/work-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId, message: workMessage.trim(), files: uploadedFiles }),
      })
      if (response.ok) {
        toast.success('Work submitted successfully!')
        setIsSubmitWorkOpen(false)
        setWorkMessage('')
        setWorkFiles([])
        if (applicationId) loadWorkSubmissions(applicationId)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to submit work')
      }
    } catch (error) {
      console.error('Error submitting work:', error)
      toast.error('Failed to submit work')
    } finally {
      setIsSubmittingWork(false)
      setUploadProgress(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter(f => f.size <= 50 * 1024 * 1024)
    if (validFiles.length < selectedFiles.length) toast.error('Some files exceeded 50MB limit and were excluded')
    setWorkFiles(prev => [...prev, ...validFiles].slice(0, 10))
  }

  const removeFile = (index: number) => {
    setWorkFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter(f => f.size <= 50 * 1024 * 1024)
    if (validFiles.length < droppedFiles.length) toast.error('Some files exceeded 50MB limit and were excluded')
    setWorkFiles(prev => [...prev, ...validFiles].slice(0, 10))
  }

  const getFileTypeBadge = (file: File) => {
    const t = file.type
    if (t.startsWith('image/')) return { label: 'Image', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' }
    if (t.startsWith('video/')) return { label: 'Video', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' }
    if (t.startsWith('audio/')) return { label: 'Audio', color: 'bg-pink-500/10 text-pink-500 border-pink-500/30' }
    if (t === 'application/pdf') return { label: 'PDF', color: 'bg-red-500/10 text-red-500 border-red-500/30' }
    if (t.includes('zip') || t.includes('rar') || t.includes('compressed')) return { label: 'Archive', color: 'bg-orange-500/10 text-orange-500 border-orange-500/30' }
    return { label: 'File', color: 'bg-muted text-muted-foreground border-border' }
  }

  const getFileThumbnail = (file: File): string | null => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      return URL.createObjectURL(file)
    }
    return null
  }

  // ─── Loading & Not Found ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 animate-spin text-brand-purple-600 dark:text-brand-400 mb-3" />
        <p className="text-sm text-muted-foreground">Loading opportunity...</p>
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-4 animate-float">
          <HugeiconsIcon icon={Briefcase01Icon} className="w-8 h-8 text-brand-purple-400 dark:text-brand-400/60" />
        </div>
        <h2 className="text-xl font-bold mb-2">Opportunity not found</h2>
        <p className="text-muted-foreground text-sm mb-4 max-w-sm">
          This opportunity may have been removed or doesn&apos;t exist.
        </p>
        <Button className="rounded-full bg-brand-500 hover:bg-brand-600" asChild>
          <Link href="/opportunities">Browse Opportunities</Link>
        </Button>
      </div>
    )
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const isOwner = !!sessionUserId && sessionUserId === opportunity.author.id
  const accent = getTypeAccent(opportunity.type)
  const appStep = getAppStatusStep(applicationStatus)
  const redirectUrl = encodeURIComponent(`/opportunities/${opportunityId}`)

  return (
    <div className="min-h-screen bg-background">

      {/* ━━━ TOP NAV ━━━ */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold bg-gradient-to-r from-brand-500 to-brand-purple-400 bg-clip-text text-transparent">
              Creatuno
            </Link>
            <span className="hidden sm:block w-px h-5 bg-border/60" />
            <Link
              href="/opportunities"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
              Back to Opportunities
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" className="text-xs rounded-full" asChild>
                  <Link href={`/sign-in?redirect_url=${redirectUrl}`}>Sign In</Link>
                </Button>
                <Button size="sm" className="text-xs rounded-full bg-brand-500 hover:bg-brand-600" asChild>
                  <Link href={`/sign-up?redirect_url=${redirectUrl}`}>Join Free</Link>
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="text-xs rounded-full" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ━━━ HERO BANNER ━━━ */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className={cn('absolute inset-0 bg-gradient-to-br', accent.gradient)} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-10">
          {/* Back button (mobile) */}
          <Link
            href="/opportunities"
            className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-all mb-6"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
            Back
          </Link>

          {/* Badges */}
          <motion.div
            className="flex flex-wrap items-center gap-2 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
          >
            <Badge variant="outline" className={cn(accent.bgLight, accent.text, accent.border, 'text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm')}>
              {getTypeIconEl(opportunity.type)}
              {opportunity.type}
            </Badge>
            <Badge variant="secondary" className="text-[10px] backdrop-blur-sm">{opportunity.category}</Badge>
            {opportunity.experienceLevel && (
              <Badge variant="outline" className="text-[10px] capitalize backdrop-blur-sm">{opportunity.experienceLevel}</Badge>
            )}
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight max-w-3xl"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease }}
          >
            {opportunity.title}
          </motion.h1>

          {/* Company */}
          {opportunity.companyName && (
            <motion.p
              className="flex items-center gap-2 text-muted-foreground mt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease }}
            >
              <HugeiconsIcon icon={Building02Icon} className="w-4 h-4" />
              {opportunity.companyName}
            </motion.p>
          )}
        </div>
      </motion.div>

      {/* ━━━ INFO STRIP ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease }}
        >
          <SpotlightCard className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Budget */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                <MdAttachMoney className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-brand-purple-600 dark:text-brand-400" style={{ textShadow: '0 0 15px rgba(249,115,22,0.2)' }}>
                  {opportunity.currency || 'SLE'} {opportunity.budgetMin.toLocaleString()}
                  {opportunity.budgetMax !== opportunity.budgetMin && (
                    <span className="text-sm"> - {opportunity.currency || 'SLE'} {opportunity.budgetMax.toLocaleString()}</span>
                  )}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{opportunity.currency}</p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0">
                <HugeiconsIcon icon={Location01Icon} className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {opportunity.isRemote ? 'Remote' : opportunity.location || 'N/A'}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Location</p>
              </div>
            </div>

            {/* Deadline */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0">
                <HugeiconsIcon icon={Calendar01Icon} className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {opportunity.deadline ? new Date(opportunity.deadline).toLocaleDateString() : 'Open'}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Deadline</p>
              </div>
            </div>

            {/* Applicants */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0">
                <HugeiconsIcon icon={UserGroupIcon} className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{opportunity.applicationsCount}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Applicants</p>
              </div>
            </div>
          </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Description + Skills ── */}
          <motion.div
            className="lg:col-span-2 space-y-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, ease }}
          >
            {/* Description */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
                <h2 className="text-lg font-bold text-foreground">Description</h2>
              </div>
              <div className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                {opportunity.description}
              </div>
            </div>

            {/* Required Skills */}
            {opportunity.requiredSkills && opportunity.requiredSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('w-6 h-0.5 rounded-full', accent.bg)} />
                  <h2 className="text-lg font-bold text-foreground">Required Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {opportunity.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border font-medium',
                        accent.bgLight, accent.text, accent.border
                      )}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Posted By - inline on large screens */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-0.5 bg-muted-foreground/30 rounded-full" />
                <h2 className="text-lg font-bold text-foreground">Posted by</h2>
              </div>
              <SpotlightCard className="flex items-center gap-4 p-4">
                <Avatar className="w-12 h-12 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 ring-offset-2 ring-offset-background">
                  <AvatarImage src={opportunity.author.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold">
                    {opportunity.author.fullName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{opportunity.author.fullName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <HugeiconsIcon icon={Clock01Icon} className="w-3 h-3" />
                    Posted {formatDistanceToNow(opportunity.createdAt)}
                  </p>
                </div>
              </SpotlightCard>
            </div>
          </motion.div>

          {/* ── Right: Sidebar ── */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            {/* Apply / Owner Card */}
            <div className="sticky top-20 space-y-4">
              <SpotlightCard className="overflow-hidden">
                <div className="p-5">
                  {isOwner ? (
                    /* ── Owner View ── */
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={Shield01Icon} className="w-7 h-7 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                      <p className="font-bold text-foreground">Your Opportunity</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-5">
                        Manage applications from your dashboard
                      </p>
                      <div className="space-y-2">
                        <Button className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl" asChild>
                          <Link href="/dashboard/employer/applications">
                            Review Applications
                            <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full rounded-xl" asChild>
                          <Link href="/dashboard/employer">
                            Employer Dashboard
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : hasApplied && applicationStatus === 'accepted' ? (
                    /* ── Accepted: Work Submission ── */
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-2">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-6 h-6 text-green-500" />
                        </div>
                        <p className="font-bold text-foreground">Application Accepted!</p>
                        <p className="text-xs text-muted-foreground mt-1">Submit your completed work below</p>
                      </div>

                      {/* Journey Stepper */}
                      {submissions.length > 0 && (() => {
                        const latest = submissions[0]
                        const steps = [
                          { key: 'submitted', label: 'Submitted' },
                          { key: 'under_review', label: 'Under Review' },
                          { key: 'decision', label: latest.status === 'revision_requested' ? 'Revision Requested' : latest.status === 'approved' ? 'Approved' : 'Pending Decision' },
                          { key: 'payment', label: 'Payment' },
                          { key: 'complete', label: 'Complete' },
                        ]
                        const currentStep = latest.status === 'submitted' ? 1
                          : latest.status === 'revision_requested' ? 2
                          : latest.status === 'approved' ? 5
                          : latest.status === 'payment_pending' ? 3
                          : 0

                        return (
                          <div className="p-4 rounded-xl bg-muted/50 border border-border/40 space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Submission Progress</p>
                            <div className="flex items-center justify-between gap-1">
                              {steps.map((step, idx) => {
                                const isPast = idx < currentStep
                                const isCurrent = idx === currentStep
                                return (
                                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                                    <div className="flex flex-col items-center gap-1">
                                      <motion.div
                                        className={cn(
                                          'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border-2 transition-colors',
                                          isPast ? 'bg-emerald-500 border-emerald-500 text-white' :
                                          isCurrent ? 'bg-brand-500 border-brand-500 text-brand-dark' :
                                          'bg-muted border-border text-muted-foreground'
                                        )}
                                        animate={isCurrent ? { boxShadow: ['0 0 0 0 rgba(254,199,20,0.3)', '0 0 0 6px rgba(254,199,20,0)', '0 0 0 0 rgba(254,199,20,0.3)'] } : {}}
                                        transition={isCurrent ? { duration: 2, repeat: Infinity } : {}}
                                      >
                                        {isPast ? '✓' : idx + 1}
                                      </motion.div>
                                      <span className={cn('text-[8px] leading-tight text-center max-w-[50px]', isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                        {step.label}
                                      </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                      <div className={cn('flex-1 h-0.5 mx-0.5 mt-[-12px] rounded-full', isPast ? 'bg-emerald-500' : 'bg-border')} />
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Revision feedback callout */}
                            {latest.status === 'revision_requested' && latest.feedback && (
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20"
                              >
                                <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1">Employer Feedback</p>
                                <p className="text-xs text-foreground leading-relaxed">{latest.feedback}</p>
                              </motion.div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Submit Work Button */}
                      <Dialog open={isSubmitWorkOpen} onOpenChange={setIsSubmitWorkOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl">
                            <HugeiconsIcon icon={Upload01Icon} className="w-4 h-4 mr-2" />
                            {submissions.length > 0 ? 'Submit Updated Work' : 'Submit Work'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Submit Work</DialogTitle>
                            <DialogDescription>Upload your deliverables and add a message</DialogDescription>
                          </DialogHeader>

                          {/* Upload progress overlay */}
                          <AnimatePresence>
                            {uploadProgress && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 rounded-xl"
                              >
                                <HugeiconsIcon icon={Loading02Icon} className="w-10 h-10 text-brand-500 animate-spin mb-4" />
                                <p className="text-sm font-semibold text-foreground mb-1">
                                  {uploadProgress.phase === 'uploading'
                                    ? `Uploading files (${uploadProgress.current}/${uploadProgress.total})...`
                                    : 'Submitting work...'}
                                </p>
                                {uploadProgress.phase === 'uploading' && (
                                  <>
                                    <p className="text-xs text-muted-foreground mb-3 truncate max-w-[250px]">{uploadProgress.fileName}</p>
                                    <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full overflow-hidden">
                                      <motion.div
                                        className="h-full bg-brand-500 rounded-full"
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    </div>
                                  </>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                              <Label htmlFor="work-message">Message <span className="text-red-500">*</span></Label>
                              <Textarea
                                id="work-message"
                                placeholder="Describe what you've completed..."
                                value={workMessage}
                                onChange={(e) => setWorkMessage(e.target.value)}
                                rows={4}
                                className="focus:ring-brand-purple-500/30 dark:ring-brand-500/30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Deliverable Files</Label>
                              <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                                onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true) }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false) }}
                                onDrop={handleDrop}
                                className={cn(
                                  'border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 relative',
                                  isDragOver
                                    ? 'border-brand-500 bg-brand-500/5 scale-[1.02] shadow-lg shadow-brand-500/10'
                                    : 'border-brand-purple-500/30 dark:border-brand-500/30 hover:border-brand-500/60'
                                )}
                              >
                                <motion.div animate={isDragOver ? { scale: 1.15 } : { scale: 1 }} transition={{ duration: 0.2 }}>
                                  <HugeiconsIcon icon={Upload01Icon} className={cn('w-8 h-8 mx-auto mb-2 transition-colors', isDragOver ? 'text-brand-500' : 'text-brand-purple-400 dark:text-brand-400/60')} />
                                </motion.div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  {isDragOver ? 'Drop files here!' : 'Drag & drop or browse files'}
                                </p>
                                <p className="text-[10px] text-muted-foreground mb-2">Images, videos, audio, PDFs, archives — max 10 files, 50MB each</p>
                                <Input
                                  type="file"
                                  multiple
                                  onChange={handleFileChange}
                                  className="max-w-[200px] mx-auto"
                                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip,.rar,.psd,.ai,.svg,.mp4,.mov,.mp3,.wav,.aac,.fig,.sketch"
                                />
                              </div>
                              {workFiles.length > 0 && (
                                <div className="space-y-1.5 mt-3">
                                  <p className="text-[10px] text-muted-foreground font-medium">{workFiles.length} file{workFiles.length > 1 ? 's' : ''} selected</p>
                                  {workFiles.map((file, index) => {
                                    const badge = getFileTypeBadge(file)
                                    const thumb = getFileThumbnail(file)
                                    return (
                                      <motion.div
                                        key={`${file.name}-${index}`}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="flex items-center gap-2.5 p-2 bg-muted/50 rounded-lg group"
                                      >
                                        {thumb ? (
                                          <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                                            {file.type.startsWith('video/') ? (
                                              <video src={thumb} className="w-full h-full object-cover" muted />
                                            ) : (
                                              <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            )}
                                          </div>
                                        ) : (
                                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                            <HugeiconsIcon icon={FileAttachmentIcon} className="w-4 h-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs truncate font-medium text-foreground">{file.name}</p>
                                          <p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
                                        </div>
                                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 flex-shrink-0', badge.color)}>
                                          {badge.label}
                                        </Badge>
                                        <button onClick={() => removeFile(index)} className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                                          <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                                        </button>
                                      </motion.div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsSubmitWorkOpen(false)}>Cancel</Button>
                              <Button
                                className="flex-1 bg-brand-500 hover:bg-brand-600 rounded-xl"
                                onClick={handleSubmitWork}
                                disabled={isSubmittingWork || (!workMessage.trim() && workFiles.length === 0)}
                              >
                                {isSubmittingWork ? (<><HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />Submitting...</>) : (<><HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />Submit Work</>)}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Submission History Timeline */}
                      {isLoadingSubmissions ? (
                        <div className="flex justify-center py-4"><HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                      ) : submissions.length > 0 ? (
                        <div className="space-y-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Submission History</p>
                          {submissions.map((sub, i) => {
                            const sc = getSubmissionStatusColor(sub.status)
                            const isLatest = i === 0
                            return (
                              <motion.div
                                key={sub.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex gap-3"
                              >
                                <div className="flex flex-col items-center">
                                  <motion.div
                                    className={cn('w-3 h-3 rounded-full ring-2 flex-shrink-0', sc.dot, sc.ring)}
                                    animate={isLatest && sub.status === 'submitted' ? { scale: [1, 1.3, 1] } : {}}
                                    transition={isLatest ? { duration: 2, repeat: Infinity } : {}}
                                  />
                                  {i < submissions.length - 1 && <div className="w-px flex-1 bg-border/50 my-1" />}
                                </div>
                                <div className="pb-4 min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <Badge className={cn(sc.bgLight, sc.text, sc.border, 'text-[9px] capitalize')}>
                                        {sub.status.replace('_', ' ')}
                                      </Badge>
                                      {sub.status === 'approved' && (
                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px]">
                                          Paid
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDistanceToNow(sub.created_at)}</span>
                                  </div>
                                  {sub.message && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sub.message}</p>
                                  )}
                                  {sub.files && sub.files.length > 0 && (
                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                      <HugeiconsIcon icon={PackageIcon} className="w-3 h-3" />
                                      {sub.files.length} file{sub.files.length > 1 ? 's' : ''}
                                    </p>
                                  )}
                                  {sub.feedback && sub.status === 'revision_requested' && (
                                    <div className="mt-2 p-2 rounded-md bg-brand-500/5 border border-brand-500/15">
                                      <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 mb-0.5">Feedback</p>
                                      <p className="text-[11px] text-foreground leading-relaxed">{sub.feedback}</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : hasApplied ? (
                    /* ── Already Applied ── */
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                      <p className="font-bold text-foreground">Application Submitted!</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        Status: <span className="capitalize font-semibold text-foreground">{applicationStatus || 'pending'}</span>
                      </p>

                      {/* Mini progress */}
                      <div className="flex items-center justify-center gap-1 mb-5">
                        {['Pending', 'Reviewed', 'Accepted'].map((s, i) => (
                          <div key={s} className="flex items-center gap-1">
                            <div className={cn(
                              'w-2.5 h-2.5 rounded-full transition-colors',
                              i < appStep ? 'bg-brand-500' : 'bg-border'
                            )} />
                            <span className={cn(
                              'text-[9px] font-medium',
                              i < appStep ? 'text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground'
                            )}>{s}</span>
                            {i < 2 && <div className={cn('w-4 h-px', i < appStep - 1 ? 'bg-brand-500' : 'bg-border')} />}
                          </div>
                        ))}
                      </div>

                      <Button variant="outline" className="w-full rounded-xl" asChild>
                        <Link href="/dashboard/applications">
                          <HugeiconsIcon icon={LinkSquare01Icon} className="w-3.5 h-3.5 mr-2" />
                          View My Applications
                        </Link>
                      </Button>
                    </div>
                  ) : (isAuthenticated && role === 'creative') ? (
                    /* ── Apply Now (authenticated creative users) ── */
                    <>
                      <div className="text-center mb-4">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-3">
                          <HugeiconsIcon icon={SparklesIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                        </div>
                        <p className="font-bold text-foreground">Interested?</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Showcase your portfolio and submit a proposal
                        </p>
                      </div>

                      <Button className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl h-12 text-base font-bold shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                        <Link href={`/opportunities/${opportunityId}/apply`}>
                          <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                          Apply Now
                        </Link>
                      </Button>
                    </>
                  ) : !isAuthenticated ? (
                    /* ── Not authenticated: Sign-in prompt ── */
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={SparklesIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                      <p className="font-bold text-foreground">Interested in this opportunity?</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-5">
                        Sign in or create an account to apply for this {opportunity.type}
                      </p>
                      <div className="space-y-2">
                        <Button className="w-full bg-brand-500 hover:bg-brand-600 rounded-xl h-12 text-base font-bold shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                          <Link href={`/sign-in?redirect_url=${redirectUrl}`}>
                            <HugeiconsIcon icon={Login01Icon} className="w-4 h-4 mr-2" />
                            Sign In to Apply
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full rounded-xl" asChild>
                          <Link href={`/sign-up?redirect_url=${redirectUrl}`}>
                            <HugeiconsIcon icon={UserAdd01Icon} className="w-4 h-4 mr-2" />
                            Create Account
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Authenticated, non-creative, non-owner: neutral view ── */
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mb-3">
                        <HugeiconsIcon icon={Briefcase01Icon} className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="font-bold text-foreground">Opportunity Details</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        This opportunity is open for creative applicants
                      </p>
                      <Button variant="outline" className="w-full rounded-xl" asChild>
                        <Link href="/opportunities">
                          <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5 mr-2" />
                          Browse Opportunities
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SpotlightCard>

              {/* Posted By - mobile only */}
              <SpotlightCard className="lg:hidden p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Posted by</p>
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 ring-2 ring-brand-purple-500/20 dark:ring-brand-500/20 ring-offset-2 ring-offset-background">
                    <AvatarImage src={opportunity.author.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark font-bold text-sm">
                      {opportunity.author.fullName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{opportunity.author.fullName}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(opportunity.createdAt)}</p>
                  </div>
                </div>
              </SpotlightCard>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━━ Sign-In Prompt Modal ━━━ */}
      <AnimatePresence>
        {showSignInPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSignInPrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.35, ease }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border/50 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Sign in to Apply</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create an account or sign in to apply for this opportunity
                  </p>
                </div>
                <button onClick={() => setShowSignInPrompt(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground">
                  <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-brand-500/10 via-brand-purple-500/5 to-transparent p-5 text-center border border-brand-500/10 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                  <HugeiconsIcon icon={SparklesIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                </div>
                <p className="text-sm text-foreground font-medium mb-1">Join Creatuno</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sign up to apply for gigs, jobs, and investments. Build your portfolio and get discovered by employers.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button className="w-full rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark" asChild>
                  <Link href={`/sign-in?redirect_url=${redirectUrl}`}>
                    <HugeiconsIcon icon={Login01Icon} className="w-4 h-4 mr-2" />
                    Sign In
                  </Link>
                </Button>
                <Button variant="outline" className="w-full rounded-full" asChild>
                  <Link href={`/sign-up?redirect_url=${redirectUrl}`}>
                    <HugeiconsIcon icon={UserAdd01Icon} className="w-4 h-4 mr-2" />
                    Create Account
                  </Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━ Mobile sticky apply bar for unauthenticated users ━━━ */}
      {!isAuthenticated && !isOwner && (
        <div className="fixed bottom-6 left-4 right-4 z-40 sm:hidden">
          <Button
            className="w-full py-3.5 rounded-full bg-brand-500 text-brand-dark font-semibold text-sm shadow-lg shadow-brand-purple-500/30 dark:shadow-brand-500/30"
            asChild
          >
            <Link href={`/sign-in?redirect_url=${redirectUrl}`}>
              <HugeiconsIcon icon={Login01Icon} className="w-4 h-4 mr-2" />
              Sign In to Apply
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
