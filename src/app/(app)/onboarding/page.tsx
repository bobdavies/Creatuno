'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  AnalyticsUpIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  BulbIcon,
  ColorPickerIcon,
  Loading02Icon,
  Location01Icon,
  Tick01Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import SpotlightCard from '@/components/SpotlightCard'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import confetti from 'canvas-confetti'
import Image from 'next/image'

// ─── Types & Constants ──────────────────────────────────────────────────────

type UserRole = 'creative' | 'mentor' | 'employer' | 'investor'

const roles = [
  {
    id: 'creative' as UserRole,
    title: 'Creative Professional',
    description: 'Showcase your work and find opportunities',
    icon: ColorPickerIcon,
    gradient: 'from-brand-purple-500/20 to-brand-purple-500/20',
    ring: 'ring-brand-purple-500',
    emoji: 'paintbrush',
  },
  {
    id: 'mentor' as UserRole,
    title: 'Mentor',
    description: 'Guide and support emerging creatives',
    icon: UserGroupIcon,
    gradient: 'from-brand-purple-500/20 to-brand-purple-500/20',
    ring: 'ring-brand-purple-500',
    emoji: 'compass',
  },
  {
    id: 'employer' as UserRole,
    title: 'Employer / Client',
    description: 'Find and hire talented creatives',
    icon: Briefcase01Icon,
    gradient: 'from-brand-500/20 to-brand-500/20',
    ring: 'ring-brand-500',
    emoji: 'briefcase',
  },
  {
    id: 'investor' as UserRole,
    title: 'Investor / Patron',
    description: 'Support and invest in creative talent',
    icon: AnalyticsUpIcon,
    gradient: 'from-brand-500/20 to-brand-purple-500/20',
    ring: 'ring-brand-500',
    emoji: 'chart',
  },
]

const skillSuggestions = [
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Illustration', 'Branding', 'Motion Graphics',
  'Social Media', 'Content Writing', 'Animation', '3D Design',
]

const mentorExpertiseOptions = [
  'Career Guidance', 'Portfolio Review', 'Technical Skills', 'Business Development',
  'Freelancing', 'Job Hunting', 'Client Management', 'Pricing Strategy',
]

const investmentInterestOptions = [
  'Creative Startups', 'Individual Artists', 'Tech Projects', 'Content Creation',
  'Design Studios', 'Photography', 'Film/Video', 'Digital Products',
]

const hiringCategoryOptions = [
  'Graphic Design', 'Web Development', 'UI/UX Design', 'Photography',
  'Video Production', 'Content Writing', 'Marketing', 'Branding',
]

const STEP_META = [
  { label: 'Your Role', sublabel: 'Who are you?', accentFrom: 'from-brand-purple-600', accentTo: 'to-brand-purple-600' },
  { label: 'Profile', sublabel: 'Tell us about you', accentFrom: 'from-brand-purple-600', accentTo: 'to-brand-purple-600' },
  { label: 'Skills', sublabel: 'What you do', accentFrom: 'from-brand-600', accentTo: 'to-brand-purple-600' },
  { label: 'Finish', sublabel: 'Almost there!', accentFrom: 'from-brand-600', accentTo: 'to-brand-500' },
]

// ─── Animated Background ────────────────────────────────────────────────────

const GRADIENT_COLORS: Record<number, string> = {
  1: 'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(236,72,153,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(168,85,247,0.06) 0%, transparent 50%)',
  2: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(34,211,238,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(99,102,241,0.06) 0%, transparent 50%)',
  3: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(52,211,153,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(20,184,166,0.06) 0%, transparent 50%)',
  4: 'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(251,191,36,0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(249,115,22,0.06) 0%, transparent 50%)',
}

function AnimatedBackground({ step }: { step: number }) {
  return (
    <motion.div
      className="fixed inset-0 -z-10 pointer-events-none"
      animate={{ background: GRADIENT_COLORS[step] || GRADIENT_COLORS[1] }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    />
  )
}

// ─── Floating Particles ─────────────────────────────────────────────────────

function FloatingParticles() {
  return (
    <div className="fixed inset-0 -z-5 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-brand-purple-500/10 dark:bg-brand-400/10"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: Math.random() * 6 + 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  )
}

// ─── Typewriter Effect ──────────────────────────────────────────────────────

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [text])

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-[1.1em] bg-brand-purple-500 dark:bg-brand-400 ml-0.5 animate-pulse align-middle" />}
    </span>
  )
}

// ─── Step Indicator (Custom) ────────────────────────────────────────────────

function OnboardingStepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  return (
    <div className="flex items-center gap-3 w-full max-w-sm mx-auto">
      {STEP_META.map((meta, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === currentStep
        const isComplete = stepNum < currentStep

        return (
          <div key={idx} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: isActive ? 1.15 : 1,
                  backgroundColor: isComplete
                    ? 'var(--color-brand-500, #FEC714)'
                    : isActive
                    ? 'var(--color-brand-500, #FEC714)'
                    : 'var(--color-muted, #27272a)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="relative w-10 h-10 rounded-full flex items-center justify-center"
              >
                <AnimatePresence mode="wait">
                  {isComplete ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" className="text-brand-dark">
                        <motion.path
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "text-xs font-bold",
                        isActive ? 'text-brand-dark' : 'text-muted-foreground'
                      )}
                    >
                      {stepNum}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="stepRing"
                    className="absolute inset-0 rounded-full ring-2 ring-brand-500/50 ring-offset-2 ring-offset-background"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.div>
              <span className={cn(
                "text-[10px] font-medium hidden sm:block",
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {meta.label}
              </span>
            </div>
            {idx < totalSteps - 1 && (
              <div className="flex-1 mx-2 h-0.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-brand-500 rounded-full"
                  animate={{ width: isComplete ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Slide Variants ─────────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
  }),
}

// ─── Confetti Launcher ──────────────────────────────────────────────────────

function fireConfetti() {
  const end = Date.now() + 2000
  const colors = ['#FEC714', '#7E5DA7', '#5227FF', '#A855F7', '#06B6D4']

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()

  // Big burst
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.6 },
    colors,
  })
}

// ─── Main Onboarding Page ───────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)

  const [formData, setFormData] = useState({
    role: '' as UserRole | '',
    fullName: '',
    bio: '',
    location: '',
    skills: [] as string[],
    createPortfolio: true,
    mentorExpertise: [] as string[],
    isAvailableForMentorship: true,
    maxMentees: 5,
    hiringNeeds: '',
    hiringCategories: [] as string[],
    investmentInterests: [] as string[],
    investmentBudget: '',
  })

  // Pre-fill name from Clerk
  useEffect(() => {
    if (user?.fullName && !formData.fullName) {
      setFormData(prev => ({ ...prev, fullName: user.fullName || '' }))
    }
  }, [user?.fullName, formData.fullName])

  // Check if user is already onboarded
  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!isLoaded || !user) {
        setIsCheckingOnboarding(false)
        return
      }
      try {
        const response = await fetch('/api/profiles')
        if (response.ok) {
          const data = await response.json()
          if (data.profile?.full_name && data.profile?.role) {
            const dashboard = getRoleBasedDashboard(data.profile.role)
            router.replace(dashboard)
            return
          }
        }
      } catch (error) {
        console.error('[Onboarding] Error checking onboarding status:', error)
      }
      setIsCheckingOnboarding(false)
    }
    checkOnboardingStatus()
  }, [isLoaded, user, router])

  const totalSteps = 4

  const handleRoleSelect = (role: UserRole) => {
    setFormData(prev => ({ ...prev, role }))
  }

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => {
      if (prev.skills.includes(skill)) {
        return { ...prev, skills: prev.skills.filter(s => s !== skill) }
      }
      if (prev.skills.length < 10) {
        return { ...prev, skills: [...prev.skills, skill] }
      }
      toast.error('Maximum 10 skills allowed')
      return prev
    })
  }

  const handleArrayToggle = (field: 'mentorExpertise' | 'investmentInterests' | 'hiringCategories', item: string) => {
    setFormData(prev => {
      const current = prev[field]
      if (current.includes(item)) {
        return { ...prev, [field]: current.filter(s => s !== item) }
      }
      return { ...prev, [field]: [...current, item] }
    })
  }

  const goNext = () => {
    if (step === 1 && !formData.role) {
      toast.error('Please select a role to continue')
      return
    }
    if (step === 2 && !formData.fullName.trim()) {
      toast.error('Please enter your name')
      return
    }
    setDirection(1)
    setStep(s => Math.min(s + 1, totalSteps))
  }

  const goBack = () => {
    setDirection(-1)
    setStep(s => Math.max(s - 1, 1))
  }

  const redirectToRoleDashboard = useCallback((role: UserRole | '', createPortfolio: boolean) => {
    switch (role) {
      case 'mentor': router.push('/dashboard/mentor'); break
      case 'employer': router.push('/dashboard/employer'); break
      case 'investor': router.push('/dashboard/investor'); break
      case 'creative':
      default:
        router.push(createPortfolio ? '/dashboard/portfolios/new' : '/dashboard')
        break
    }
  }, [router])

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.emailAddresses?.[0]?.emailAddress || '',
          full_name: formData.fullName,
          bio: formData.bio,
          location: formData.location,
          role: formData.role,
          skills: formData.skills,
          is_mentor: formData.role === 'mentor',
          mentor_expertise: formData.mentorExpertise,
          is_available_for_mentorship: formData.isAvailableForMentorship,
          max_mentees: formData.maxMentees,
          hiring_needs: formData.hiringNeeds,
          hiring_categories: formData.hiringCategories,
          investment_interests: formData.investmentInterests,
          investment_budget: formData.investmentBudget,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (!errorData.error?.includes('not configured')) {
          console.warn('Profile save warning:', errorData)
        }
      }

      // Show success state with confetti
      setShowSuccess(true)
      fireConfetti()
      toast.success('Welcome to Creatuno!')

      // Redirect after celebration
      setTimeout(() => {
        redirectToRoleDashboard(formData.role, formData.createPortfolio)
      }, 2500)
    } catch (error) {
      console.error('Error completing onboarding:', error)
      setShowSuccess(true)
      fireConfetti()
      toast.success('Welcome to Creatuno!')
      setTimeout(() => {
        redirectToRoleDashboard(formData.role, formData.createPortfolio)
      }, 2500)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading State ─────────────────────────────────────────────────────────

  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-16 h-16 mx-auto mb-6">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-brand-purple-500/30 dark:border-brand-400/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-1 rounded-full border-2 border-t-brand-500 border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/branding/logo-mark.svg"
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 opacity-60"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Preparing your journey...</p>
        </motion.div>
      </div>
    )
  }

  // ── Success State ─────────────────────────────────────────────────────────

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AnimatedBackground step={4} />
        <FloatingParticles />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-purple-600 flex items-center justify-center shadow-2xl shadow-brand-500/30"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 500 }}
            >
              <svg width="40" height="40" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl sm:text-4xl font-bold text-foreground mb-3"
          >
            You&apos;re all set!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground text-lg"
          >
            Welcome to the Creatuno community, <span className="text-brand-purple-600 dark:text-brand-400 font-semibold">{formData.fullName || user?.firstName}</span>.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-sm text-muted-foreground mt-6"
          >
            Redirecting to your dashboard...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // ── Main Onboarding UI ────────────────────────────────────────────────────

  const firstName = user?.firstName || formData.fullName.split(' ')[0] || ''

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <AnimatedBackground step={step} />
      <FloatingParticles />

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-border/30 backdrop-blur-md bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/branding/logo-horizontal-dark.svg"
              alt="Creatuno"
              width={130}
              height={18}
              className="h-5 w-auto dark:hidden"
              priority
            />
            <Image
              src="/branding/logo-horizontal-bright.svg"
              alt="Creatuno"
              width={130}
              height={18}
              className="h-5 w-auto hidden dark:block"
              priority
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
            Step {step} of {totalSteps}
          </span>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col relative z-10">
        <div className="container mx-auto px-4 pt-6 pb-4 max-w-xl">
          <OnboardingStepIndicator currentStep={step} totalSteps={totalSteps} />
        </div>

        <div className="flex-1 container mx-auto px-4 max-w-xl overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="py-6"
            >
              {/* ── Step 1: Role Selection ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                        {firstName ? (
                          <TypewriterText text={`Hey ${firstName}, welcome!`} />
                        ) : (
                          <TypewriterText text="Welcome to Creatuno!" />
                        )}
                      </h1>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-muted-foreground"
                    >
                      What brings you here? Pick your primary role.
                    </motion.p>
                  </div>

                  <div className="grid gap-3">
                    {roles.map((role, i) => {
                      const isSelected = formData.role === role.id
                      return (
                        <motion.div
                          key={role.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + i * 0.08, ease: [0.23, 1, 0.32, 1] }}
                        >
                          <SpotlightCard
                            className={cn(
                              'cursor-pointer transition-all duration-300 p-4 flex items-center gap-4',
                              isSelected
                                ? 'ring-2 ring-brand-500 shadow-lg shadow-brand-500/10'
                                : 'hover:ring-2 hover:ring-brand-500/40 hover:shadow-md'
                            )}
                            onClick={() => handleRoleSelect(role.id)}
                          >
                            <motion.div
                              animate={{ scale: isSelected ? 1.1 : 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 bg-gradient-to-br',
                                isSelected ? role.gradient : 'from-muted to-muted'
                              )}
                            >
                              <HugeiconsIcon
                                icon={role.icon}
                                className={cn(
                                  'w-6 h-6 transition-colors duration-300',
                                  isSelected ? 'text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground'
                                )}
                              />
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground">{role.title}</h3>
                              <p className="text-sm text-muted-foreground">{role.description}</p>
                            </div>
                            <motion.div
                              initial={false}
                              animate={{
                                scale: isSelected ? 1 : 0,
                                opacity: isSelected ? 1 : 0,
                              }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            >
                              <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                                <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 text-brand-dark" />
                              </div>
                            </motion.div>
                          </SpotlightCard>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 2: Profile ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl sm:text-3xl font-bold text-foreground"
                    >
                      Tell us about yourself
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="text-muted-foreground"
                    >
                      This helps others find and connect with you
                    </motion.p>
                  </div>

                  {/* Avatar preview */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                    className="flex justify-center"
                  >
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-purple-500 to-brand-500 flex items-center justify-center text-brand-dark text-2xl font-bold shadow-lg shadow-brand-500/20">
                        {user?.imageUrl ? (
                          <img src={user.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          formData.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <HugeiconsIcon icon={UserIcon} className="w-8 h-8" />
                        )}
                      </div>
                      <motion.div
                        className="absolute inset-0 rounded-full ring-2 ring-brand-500/40 ring-offset-2 ring-offset-background"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  </motion.div>

                  <div className="space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="fullName" className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={UserIcon} className="w-3.5 h-3.5 text-brand-purple-500 dark:text-brand-400" />
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        placeholder="Your full name"
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="bg-background/50 backdrop-blur-sm border-border/50 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="location" className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Location01Icon} className="w-3.5 h-3.5 text-brand-purple-500 dark:text-brand-400" />
                        Location
                      </Label>
                      <Input
                        id="location"
                        placeholder="e.g., Freetown, Sierra Leone"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        className="bg-background/50 backdrop-blur-sm border-border/50 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell us about yourself and your experience..."
                        value={formData.bio}
                        onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                        className="bg-background/50 backdrop-blur-sm border-border/50 focus:border-brand-500 focus:ring-brand-500/20 transition-all resize-none"
                      />
                    </motion.div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Skills ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <motion.h1
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl sm:text-3xl font-bold text-foreground"
                    >
                      What are your skills?
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-muted-foreground"
                    >
                      Select up to 10 skills that describe your expertise
                    </motion.p>
                  </div>

                  {/* Circular progress ring */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                    className="flex justify-center"
                  >
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle
                          cx="22" cy="22" r="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted/40"
                        />
                        <motion.circle
                          cx="22" cy="22" r="18"
                          fill="none"
                          stroke="url(#skillGradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 18}
                          animate={{
                            strokeDashoffset: 2 * Math.PI * 18 * (1 - formData.skills.length / 10),
                          }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                        <defs>
                          <linearGradient id="skillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#7E5DA7" />
                            <stop offset="100%" stopColor="#FEC714" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          key={formData.skills.length}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-lg font-bold text-foreground leading-none"
                        >
                          {formData.skills.length}
                        </motion.span>
                        <span className="text-[10px] text-muted-foreground">of 10</span>
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {skillSuggestions.map((skill, i) => {
                      const isSelected = formData.skills.includes(skill)
                      return (
                        <motion.div
                          key={skill}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 + i * 0.03 }}
                        >
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className={cn(
                              'cursor-pointer text-sm py-2 px-3.5 transition-all duration-200',
                              isSelected
                                ? 'bg-brand-500 hover:bg-brand-600 border-brand-500 shadow-md shadow-brand-500/20 scale-105'
                                : 'hover:border-brand-500/50 hover:bg-brand-500/5 backdrop-blur-sm bg-background/50'
                            )}
                            onClick={() => handleSkillToggle(skill)}
                          >
                            {skill}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.span
                                  initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                                  animate={{ width: 'auto', opacity: 1, marginLeft: 4 }}
                                  exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Badge>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Step 4: Role-Specific Setup ── */}
              {step === 4 && (
                <div className="space-y-6">
                  {/* Creative */}
                  {formData.role === 'creative' && (
                    <>
                      <div className="text-center space-y-2">
                        <motion.h1
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-2xl sm:text-3xl font-bold text-foreground"
                        >
                          Ready to showcase your work?
                        </motion.h1>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-muted-foreground"
                        >
                          Create your first portfolio and start getting discovered
                        </motion.p>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                      >
                        <SpotlightCard className="p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-brand-500/20 to-brand-purple-500/20 rounded-xl flex items-center justify-center">
                              <HugeiconsIcon icon={Add01Icon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">Create your first portfolio</h3>
                              <p className="text-sm text-muted-foreground">Showcase your best work</p>
                            </div>
                            <Switch
                              checked={formData.createPortfolio}
                              onCheckedChange={(checked) =>
                                setFormData(prev => ({ ...prev, createPortfolio: checked }))
                              }
                            />
                          </div>
                        </SpotlightCard>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="p-4 bg-gradient-to-r from-brand-purple-500/5 to-brand-500/5 rounded-xl border border-brand-purple-500/10 dark:border-brand-500/10 backdrop-blur-sm"
                      >
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <HugeiconsIcon icon={BulbIcon} className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                          <span>Your portfolio works offline! Create and edit even without internet connection.</span>
                        </p>
                      </motion.div>
                    </>
                  )}

                  {/* Mentor */}
                  {formData.role === 'mentor' && (
                    <>
                      <div className="text-center space-y-2">
                        <motion.h1
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-2xl sm:text-3xl font-bold text-foreground"
                        >
                          Set up your mentorship profile
                        </motion.h1>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-muted-foreground"
                        >
                          Help emerging creatives grow their skills and careers
                        </motion.p>
                      </div>

                      <div className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                        >
                          <Label className="mb-3 block">Areas of Expertise</Label>
                          <div className="flex flex-wrap gap-2">
                            {mentorExpertiseOptions.map((item) => {
                              const isSelected = formData.mentorExpertise.includes(item)
                              return (
                                <Badge
                                  key={item}
                                  variant={isSelected ? 'default' : 'outline'}
                                  className={cn(
                                    'cursor-pointer text-sm py-2 px-3 transition-all duration-200',
                                    isSelected
                                      ? 'bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/20'
                                      : 'hover:border-brand-500/50 bg-background/50 backdrop-blur-sm'
                                  )}
                                  onClick={() => handleArrayToggle('mentorExpertise', item)}
                                >
                                  {item}
                                  {isSelected && <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3 ml-1" />}
                                </Badge>
                              )
                            })}
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                        >
                          <SpotlightCard className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-foreground">Available for mentorship</p>
                                <p className="text-sm text-muted-foreground">Accept new mentee requests</p>
                              </div>
                              <Switch
                                checked={formData.isAvailableForMentorship}
                                onCheckedChange={(checked) =>
                                  setFormData(prev => ({ ...prev, isAvailableForMentorship: checked }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="maxMentees">Maximum mentees</Label>
                              <Input
                                id="maxMentees"
                                type="number"
                                min={1}
                                max={20}
                                value={formData.maxMentees}
                                onChange={(e) =>
                                  setFormData(prev => ({ ...prev, maxMentees: parseInt(e.target.value) || 5 }))
                                }
                                className="bg-background/50 backdrop-blur-sm"
                              />
                            </div>
                          </SpotlightCard>
                        </motion.div>
                      </div>
                    </>
                  )}

                  {/* Employer */}
                  {formData.role === 'employer' && (
                    <>
                      <div className="text-center space-y-2">
                        <motion.h1
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-2xl sm:text-3xl font-bold text-foreground"
                        >
                          Tell us about your hiring needs
                        </motion.h1>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-muted-foreground"
                        >
                          This helps us match you with the right talent
                        </motion.p>
                      </div>

                      <div className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                        >
                          <Label className="mb-3 block">What skills are you looking for?</Label>
                          <div className="flex flex-wrap gap-2">
                            {hiringCategoryOptions.map((item) => {
                              const isSelected = formData.hiringCategories.includes(item)
                              return (
                                <Badge
                                  key={item}
                                  variant={isSelected ? 'default' : 'outline'}
                                  className={cn(
                                    'cursor-pointer text-sm py-2 px-3 transition-all duration-200',
                                    isSelected
                                      ? 'bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/20'
                                      : 'hover:border-brand-500/50 bg-background/50 backdrop-blur-sm'
                                  )}
                                  onClick={() => handleArrayToggle('hiringCategories', item)}
                                >
                                  {item}
                                  {isSelected && <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3 ml-1" />}
                                </Badge>
                              )
                            })}
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="space-y-2"
                        >
                          <Label htmlFor="hiringNeeds">Describe your typical projects</Label>
                          <Textarea
                            id="hiringNeeds"
                            placeholder="e.g., We regularly need logo designs, social media graphics..."
                            value={formData.hiringNeeds}
                            onChange={(e) => setFormData(prev => ({ ...prev, hiringNeeds: e.target.value }))}
                            rows={3}
                            className="bg-background/50 backdrop-blur-sm border-border/50 resize-none"
                          />
                        </motion.div>
                      </div>
                    </>
                  )}

                  {/* Investor */}
                  {formData.role === 'investor' && (
                    <>
                      <div className="text-center space-y-2">
                        <motion.h1
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-2xl sm:text-3xl font-bold text-foreground"
                        >
                          What are you looking to invest in?
                        </motion.h1>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          className="text-muted-foreground"
                        >
                          Help us match you with promising creative talent
                        </motion.p>
                      </div>

                      <div className="space-y-4">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                        >
                          <Label className="mb-3 block">Investment Interests</Label>
                          <div className="flex flex-wrap gap-2">
                            {investmentInterestOptions.map((item) => {
                              const isSelected = formData.investmentInterests.includes(item)
                              return (
                                <Badge
                                  key={item}
                                  variant={isSelected ? 'default' : 'outline'}
                                  className={cn(
                                    'cursor-pointer text-sm py-2 px-3 transition-all duration-200',
                                    isSelected
                                      ? 'bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/20'
                                      : 'hover:border-brand-500/50 bg-background/50 backdrop-blur-sm'
                                  )}
                                  onClick={() => handleArrayToggle('investmentInterests', item)}
                                >
                                  {item}
                                  {isSelected && <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3 ml-1" />}
                                </Badge>
                              )
                            })}
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="space-y-2"
                        >
                          <Label htmlFor="investmentBudget">Typical investment range (optional)</Label>
                          <Input
                            id="investmentBudget"
                            placeholder="e.g., $1,000 - $10,000"
                            value={formData.investmentBudget}
                            onChange={(e) => setFormData(prev => ({ ...prev, investmentBudget: e.target.value }))}
                            className="bg-background/50 backdrop-blur-sm border-border/50"
                          />
                        </motion.div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Footer Navigation ── */}
        <div className="relative z-10 border-t border-border/30 backdrop-blur-md bg-background/60">
          <div className="container mx-auto px-4 py-4 max-w-xl">
            <div className={cn(
              'flex gap-3',
              step === 1 ? 'justify-end' : 'justify-between'
            )}>
              {step > 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    onClick={goBack}
                    className="px-6 border-border/50 bg-background/50 backdrop-blur-sm hover:bg-muted/50"
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </motion.div>
              )}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {step < totalSteps ? (
                  <Button
                    onClick={goNext}
                    className="px-8 bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full shadow-lg shadow-brand-500/25 transition-all duration-200"
                  >
                    Continue
                    <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={isSubmitting}
                    className="px-8 bg-gradient-to-r from-brand-purple-600 to-brand-500 hover:from-brand-purple-700 hover:to-brand-600 text-white rounded-full shadow-lg shadow-brand-500/25 transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <HugeiconsIcon icon={Tick01Icon} className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
