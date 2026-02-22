'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, FloppyDiskIcon, GlobeIcon, Loading02Icon, LockIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { generateLocalId, savePortfolioOffline, syncPortfolioImmediately } from '@/lib/offline'
import { useNetworkStatus } from '@/hooks'
import { useSession } from '@/components/providers/user-session-provider'

// ─── Animation Config ─────────────────────────────────────────────────────────

const ease = [0.23, 1, 0.32, 1] as const

// Generate URL-friendly slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50)
}

export default function NewPortfolioPage() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const { userId } = useSession()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tagline: '',
    isPublic: true,
  })

  const slug = generateSlug(formData.title)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Please enter a portfolio title')
      return
    }

    if (!userId) {
      toast.error('Please sign in to create a portfolio')
      return
    }

    setIsSubmitting(true)

    try {
      const localId = generateLocalId()
      const portfolioData = {
        id: '',
        localId,
        userId,
        data: {
          title: formData.title.trim(),
          description: formData.description.trim(),
          tagline: formData.tagline.trim(),
          slug: slug || localId,
          is_public: formData.isPublic,
          view_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        projects: [],
        syncStatus: 'pending' as const,
        lastModified: Date.now(),
      }

      await savePortfolioOffline(portfolioData)

      if (isOnline) {
        const syncResult = await syncPortfolioImmediately(localId)
        if (syncResult.success) {
          toast.success('Portfolio created and saved to cloud!')
          router.push(`/dashboard/portfolios/${syncResult.serverId || localId}/edit`)
          return
        } else {
          console.warn('Immediate sync failed, will retry later:', syncResult.error)
          toast.success('Portfolio created! It will sync to cloud shortly.')
        }
      } else {
        toast.success('Portfolio saved offline. It will sync when you\'re back online.')
      }

      router.push(`/dashboard/portfolios/${localId}/edit`)

    } catch (error) {
      console.error('Error creating portfolio:', error)
      toast.error('Failed to create portfolio. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pb-32">

      {/* ━━━ HERO HEADER ━━━ */}
      <div className="relative overflow-hidden">
        {/* Gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-10">
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

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Create{' '}
              <span className="text-brand-dark dark:text-foreground">
                Portfolio
              </span>
            </h1>
          </motion.div>
          <motion.p
            className="text-muted-foreground mt-3 text-sm sm:text-base max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.15 }}
          >
            Set up your portfolio details and start showcasing your best work.
          </motion.p>
          {/* Badge */}
          <motion.div
            className="flex items-center gap-2 mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease, delay: 0.3 }}
          >
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-widest text-brand-purple-500 dark:text-brand-400/70">New Portfolio</span>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-6">

        {/* Offline indicator */}
        {!isOnline && (
          <motion.div
            className="mb-6 p-3.5 bg-brand-purple-500/10 dark:bg-brand-500/10 border border-brand-purple-500/30 dark:border-brand-500/30 rounded-xl text-sm text-brand-purple-600 dark:text-brand-400 flex items-center gap-2.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 flex-shrink-0" />
            You&apos;re offline. Your portfolio will be saved locally and synced when you&apos;re back online.
          </motion.div>
        )}

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.2 }}
        >
          {/* Form section */}
          <SpotlightCard className="p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Portfolio Details</h2>
              <p className="text-xs text-muted-foreground mt-1">Tell viewers about your creative work</p>
            </div>

            {/* Title */}
            <div className="space-y-2.5">
              <Label htmlFor="title" className="text-xs uppercase tracking-wider font-semibold text-foreground/80">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Graphic Design Portfolio"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-background/50 border-border/50 focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all duration-200 h-11"
              />
              {slug && (
                <motion.p
                  className="text-xs text-muted-foreground"
                  key={slug}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  URL: creatuno.app/portfolio/you/<span className="text-brand-purple-600 dark:text-brand-400 font-medium">{slug}</span>
                </motion.p>
              )}
            </div>

            {/* Tagline */}
            <div className="space-y-2.5">
              <Label htmlFor="tagline" className="text-xs uppercase tracking-wider font-semibold text-foreground/80">
                Tagline <span className="text-muted-foreground font-normal normal-case tracking-normal">(optional)</span>
              </Label>
              <Input
                id="tagline"
                placeholder="e.g., Creating visual stories that inspire"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                maxLength={100}
                className="bg-background/50 border-border/50 focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all duration-200 h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                A short catchy phrase that describes your work
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2.5">
              <Label htmlFor="description" className="text-xs uppercase tracking-wider font-semibold text-foreground/80">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Tell viewers about your work, skills, and experience..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="bg-background/50 border-border/50 focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all duration-200 resize-none"
              />
            </div>

            {/* Visibility Toggle */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
              formData.isPublic
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-muted/30 border-border/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`transition-opacity duration-200 ${formData.isPublic ? 'opacity-100' : 'opacity-50'}`}>
                  {formData.isPublic ? (
                    <HugeiconsIcon icon={GlobeIcon} className="w-5 h-5 text-green-500" />
                  ) : (
                    <HugeiconsIcon icon={LockIcon} className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {formData.isPublic ? 'Public Portfolio' : 'Private Portfolio'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formData.isPublic
                      ? 'Anyone can view this portfolio'
                      : 'Only you can view this portfolio'}
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>
          </SpotlightCard>

          {/* Actions */}
          <motion.div
            className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Button variant="ghost" type="button" className="text-muted-foreground hover:text-foreground" asChild>
              <Link href="/dashboard/portfolios">Cancel</Link>
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                className="bg-brand-500 hover:bg-brand-600 px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 transition-all duration-200"
                disabled={isSubmitting || !formData.title.trim()}
              >
                {isSubmitting ? (
                  <>
                    <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={FloppyDiskIcon} className="w-4 h-4 mr-2" />
                    Create &amp; Add Projects
                  </>
                )}
              </Button>
            </motion.div>
          </motion.div>
        </motion.form>
      </div>
    </div>
  )
}
