'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Image01Icon,
  Loading02Icon,
  SparklesIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons"
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { cn } from '@/lib/utils'

const ease = [0.23, 1, 0.32, 1] as const

const CATEGORIES = [
  'Design', 'Film', 'Photography', 'Music', 'Tech', 'Writing',
  'Fashion', 'Art', 'Architecture', 'Animation', 'Gaming', 'Other',
]

const SKILL_SUGGESTIONS = [
  'Branding', 'UI/UX', 'Motion Graphics', 'Cinematography',
  'Photography', 'Music Production', 'Web Development',
  'Illustration', 'Copywriting', '3D Modeling', 'Video Editing',
  'Graphic Design', 'Sound Design', 'Game Design',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ZAR', 'NGN', 'KES']

const STEPS = [
  { id: 1, label: 'Portfolio' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'The Ask' },
  { id: 4, label: 'Media' },
  { id: 5, label: 'Preview' },
]

interface Portfolio {
  id: string
  title: string
  slug: string
  tagline?: string
}

interface Mentee {
  user_id: string
  full_name: string
  avatar_url: string | null
}

export default function CreatePitchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role } = useSession()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const isMentor = role === 'mentor'
  const preselectedMentee = searchParams.get('mentee')

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [selectedMentee, setSelectedMentee] = useState<string>(preselectedMentee || '')

  const [form, setForm] = useState({
    portfolio_id: '',
    title: '',
    tagline: '',
    description: '',
    category: '',
    skills: [] as string[],
    funding_ask: '',
    currency: 'USD',
    cover_image: '',
    video_url: '',
  })

  useEffect(() => {
    if (role && !['creative', 'mentor'].includes(role)) {
      toast.error('Only creatives and mentors can create pitches')
      router.push('/pitch-stage')
      return
    }
    loadData()
  }, [role])

  useEffect(() => {
    if (isMentor && selectedMentee) {
      loadMenteePortfolios(selectedMentee)
    }
  }, [selectedMentee, isMentor])

  const loadData = async () => {
    setIsLoading(true)
    try {
      if (isMentor) {
        const res = await fetch('/api/mentors/mentees')
        if (res.ok) {
          const data = await res.json()
          setMentees(data.mentees || [])
        }
        if (preselectedMentee) {
          await loadMenteePortfolios(preselectedMentee)
        }
      } else {
        const res = await fetch('/api/portfolios')
        if (res.ok) {
          const data = await res.json()
          setPortfolios(data.portfolios || [])
        }
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMenteePortfolios = async (menteeId: string) => {
    try {
      const res = await fetch(`/api/portfolios/public?user_id=${menteeId}`)
      if (res.ok) {
        const data = await res.json()
        setPortfolios(data.portfolios || [])
      }
    } catch {}
  }

  const updateForm = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : prev.skills.length < 10
          ? [...prev.skills, skill]
          : prev.skills,
    }))
  }

  const canProceed = (s: number): boolean => {
    if (s === 1) {
      if (isMentor) return !!selectedMentee
      return true
    }
    if (s === 2) return !!form.title.trim() && !!form.description.trim()
    if (s === 3) return true
    if (s === 4) return true
    return true
  }

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/pitches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          portfolio_id: form.portfolio_id || null,
          funding_ask: form.funding_ask ? parseFloat(form.funding_ask) : null,
          creative_id: isMentor ? selectedMentee : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create pitch')
        return
      }

      const { pitch } = await res.json()

      if (publish) {
        const pubRes = await fetch(`/api/pitches/${pitch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'live' }),
        })

        if (pubRes.ok) {
          toast.success('Pitch published to The Pitch Stage!')
          router.push(`/pitch-stage/${pitch.id}`)
        } else {
          toast.success('Pitch saved as draft')
          router.push('/pitch-stage/my-pitches')
        }
      } else {
        toast.success('Pitch saved as draft')
        router.push('/pitch-stage/my-pitches')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-brand-purple-500/10 to-transparent" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-6">
          <Link
            href="/pitch-stage"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-all mb-6"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
            Back to Pitch Stage
          </Link>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {isMentor ? 'Champion a Mentee' : 'Create Your Pitch'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isMentor
              ? 'Showcase your mentee\'s talent to investors on The Pitch Stage'
              : 'Step into the spotlight and attract investment for your creative work'
            }
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => { if (s.id < step || canProceed(s.id - 1)) setStep(s.id) }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all w-full',
                  step === s.id
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                    : s.id < step
                      ? 'bg-brand-500/5 text-brand-500 border border-brand-500/10'
                      : 'bg-muted/30 text-muted-foreground border border-transparent'
                )}
              >
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  step === s.id
                    ? 'bg-brand-500 text-brand-dark'
                    : s.id < step
                      ? 'bg-brand-500/20 text-brand-500'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {s.id < step ? <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-3 h-3" /> : s.id}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('h-px w-4 flex-shrink-0', i < step - 1 ? 'bg-brand-500/30' : 'bg-border/50')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepContainer key="step1">
              <h2 className="text-lg font-bold text-foreground mb-4">
                {isMentor ? 'Select Mentee & Portfolio' : 'Select a Portfolio'}
              </h2>

              {isMentor && (
                <div className="mb-6">
                  <Label className="text-sm font-semibold mb-2 block">Which mentee are you championing?</Label>
                  {mentees.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 text-center">
                      <p className="text-sm text-muted-foreground">You don&apos;t have any active mentees yet.</p>
                      <Button asChild variant="outline" className="mt-3 rounded-full" size="sm">
                        <Link href="/mentorship/scout">Scout Talent</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {mentees.map(m => (
                        <button
                          key={m.user_id}
                          onClick={() => setSelectedMentee(m.user_id)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                            selectedMentee === m.user_id
                              ? 'border-brand-500/50 bg-brand-500/5'
                              : 'border-border/50 hover:border-brand-500/20 hover:bg-muted/30'
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-purple-500 to-brand-500 flex items-center justify-center text-brand-dark text-xs font-bold">
                            {m.full_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium text-foreground">{m.full_name}</span>
                          {selectedMentee === m.user_id && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-brand-500 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Label className="text-sm font-semibold mb-2 block">
                {isMentor ? 'Select their portfolio to showcase (optional)' : 'Select a portfolio to showcase (optional)'}
              </Label>
              {portfolios.length === 0 ? (
                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 text-center">
                  <p className="text-sm text-muted-foreground">No portfolios found. You can still create a pitch without one.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button
                    onClick={() => updateForm('portfolio_id', '')}
                    className={cn(
                      'p-3 rounded-xl border transition-all text-left text-sm',
                      !form.portfolio_id
                        ? 'border-brand-500/50 bg-brand-500/5 text-foreground font-medium'
                        : 'border-border/50 hover:border-brand-500/20 text-muted-foreground'
                    )}
                  >
                    No portfolio — pitch without a showcase
                  </button>
                  {portfolios.map(p => (
                    <button
                      key={p.id}
                      onClick={() => updateForm('portfolio_id', p.id)}
                      className={cn(
                        'p-3 rounded-xl border transition-all text-left',
                        form.portfolio_id === p.id
                          ? 'border-brand-500/50 bg-brand-500/5'
                          : 'border-border/50 hover:border-brand-500/20 hover:bg-muted/30'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      {p.tagline && <p className="text-xs text-muted-foreground mt-0.5">{p.tagline}</p>}
                    </button>
                  ))}
                </div>
              )}
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer key="step2">
              <h2 className="text-lg font-bold text-foreground mb-4">Pitch Details</h2>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="title" className="text-sm font-semibold mb-1.5 block">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Brand Identity Studio — Premium Creative Services"
                    value={form.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    className="rounded-xl"
                    maxLength={100}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{form.title.length}/100</p>
                </div>

                <div>
                  <Label htmlFor="tagline" className="text-sm font-semibold mb-1.5 block">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="A short hook that captures attention (150 chars max)"
                    value={form.tagline}
                    onChange={(e) => updateForm('tagline', e.target.value)}
                    className="rounded-xl"
                    maxLength={150}
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-semibold mb-1.5 block">Pitch Narrative *</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell your story. What's your vision? What have you accomplished? Why should investors believe in you?"
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    className="rounded-xl min-h-[200px] resize-none"
                    maxLength={5000}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">{form.description.length}/5000</p>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Category</Label>
                  <Select value={form.category} onValueChange={(v) => updateForm('category', v)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Skills & Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILL_SUGGESTIONS.map(skill => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                          form.skills.includes(skill)
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30'
                            : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50'
                        )}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{form.skills.length}/10 selected</p>
                </div>
              </div>
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer key="step3">
              <h2 className="text-lg font-bold text-foreground mb-4">The Ask</h2>
              <p className="text-sm text-muted-foreground mb-6">
                How much funding are you looking for? This is optional — you can leave it blank if you&apos;re open to offers.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="funding_ask" className="text-sm font-semibold mb-1.5 block">Funding Amount</Label>
                  <Input
                    id="funding_ask"
                    type="number"
                    placeholder="e.g. 5000"
                    value={form.funding_ask}
                    onChange={(e) => updateForm('funding_ask', e.target.value)}
                    className="rounded-xl"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-1.5 block">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => updateForm('currency', v)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.funding_ask && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-2xl bg-brand-500/5 border border-brand-500/10"
                >
                  <p className="text-sm text-foreground font-medium">
                    Your ask: <span className="text-brand-600 dark:text-brand-400">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.currency, maximumFractionDigits: 0 }).format(parseFloat(form.funding_ask) || 0)}
                    </span>
                  </p>
                </motion.div>
              )}
            </StepContainer>
          )}

          {step === 4 && (
            <StepContainer key="step4">
              <h2 className="text-lg font-bold text-foreground mb-4">Media</h2>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="cover_image" className="text-sm font-semibold mb-1.5 block">
                    <HugeiconsIcon icon={Image01Icon} className="w-4 h-4 inline mr-1" />
                    Cover Image URL
                  </Label>
                  <Input
                    id="cover_image"
                    placeholder="https://example.com/my-cover.jpg"
                    value={form.cover_image}
                    onChange={(e) => updateForm('cover_image', e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Paste a direct URL to an image (hero image for your pitch card)</p>

                  {form.cover_image && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-xl overflow-hidden border border-border/50">
                      <img src={form.cover_image} alt="Cover preview" className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </motion.div>
                  )}
                </div>

                <div>
                  <Label htmlFor="video_url" className="text-sm font-semibold mb-1.5 block">
                    <HugeiconsIcon icon={Video01Icon} className="w-4 h-4 inline mr-1" />
                    Pitch Video URL (optional)
                  </Label>
                  <Input
                    id="video_url"
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    value={form.video_url}
                    onChange={(e) => updateForm('video_url', e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">YouTube or Vimeo link to a pitch video</p>
                </div>
              </div>
            </StepContainer>
          )}

          {step === 5 && (
            <StepContainer key="step5">
              <h2 className="text-lg font-bold text-foreground mb-4">Preview Your Pitch</h2>

              <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">
                {/* Preview card */}
                <div className="h-40 bg-gradient-to-br from-brand-500/20 via-brand-purple-500/10 to-muted/30 relative">
                  {form.cover_image ? (
                    <img src={form.cover_image} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 text-brand-500/30" />
                    </div>
                  )}
                  {form.category && (
                    <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm text-foreground border-0 text-[10px]">
                      {form.category}
                    </Badge>
                  )}
                  {form.funding_ask && (
                    <Badge className="absolute top-3 right-3 bg-brand-500/90 text-brand-dark border-0 text-[10px]">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.currency, maximumFractionDigits: 0 }).format(parseFloat(form.funding_ask) || 0)}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-foreground">{form.title || 'Untitled Pitch'}</h3>
                  {form.tagline && <p className="text-xs text-muted-foreground mt-1">{form.tagline}</p>}
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{form.description}</p>
                  {form.skills.length > 0 && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {form.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </StepContainer>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <Button variant="outline" className="rounded-full" onClick={() => setStep(step - 1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
              Previous
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            {step === 5 ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleSave(false)}
                  disabled={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-2" />
                  )}
                  Publish to Pitch Stage
                </Button>
              </>
            ) : (
              <Button
                className="rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed(step)}
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}
