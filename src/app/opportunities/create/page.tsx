'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon, ArrowLeft01Icon, Briefcase01Icon, Building02Icon, Calendar01Icon, CheckmarkCircle01Icon, GlobeIcon, Loading02Icon, Location01Icon, SparklesIcon, Tag01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MdAttachMoney, MdBolt } from 'react-icons/md'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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

// ─── Constants ──────────────────────────────────────────────────────────────

const categories = [
  'Graphic Design', 'Web Development', 'Photography', 'Video Production',
  'UI/UX Design', 'Branding', 'Illustration', 'Motion Graphics',
  'Social Media', 'Content Strategy', 'Other',
]

const skillOptions = [
  'Graphic Design', 'UI/UX Design', 'Web Development', 'Photography',
  'Video Editing', 'Branding', 'Illustration', 'Motion Graphics',
  'Social Media', 'Content Strategy', 'Figma', 'Adobe Creative Suite',
  'React', 'Next.js', 'Python', 'WordPress', 'Copywriting',
]

const typeOptions = [
  {
    value: 'gig' as const,
    label: 'Gig',
    desc: 'Short-term project or freelance work',
    icon: MdBolt,
    color: 'blue',
    gradient: 'from-blue-600/20 via-blue-500/10 to-transparent',
    accent: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    borderActive: 'border-blue-500',
    shadow: 'shadow-blue-500/10',
  },
  {
    value: 'job' as const,
    label: 'Job',
    desc: 'Long-term position or employment',
    icon: Briefcase01Icon,
    color: 'green',
    gradient: 'from-green-600/20 via-green-500/10 to-transparent',
    accent: 'text-green-500',
    bgLight: 'bg-green-500/10',
    borderActive: 'border-green-500',
    shadow: 'shadow-green-500/10',
  },
  {
    value: 'investment' as const,
    label: 'Investment',
    desc: 'Fund a creative project or startup',
    icon: AnalyticsUpIcon,
    color: 'purple',
    gradient: 'from-purple-600/20 via-purple-500/10 to-transparent',
    accent: 'text-purple-500',
    bgLight: 'bg-purple-500/10',
    borderActive: 'border-purple-500',
    shadow: 'shadow-purple-500/10',
  },
]

const ease = [0.23, 1, 0.32, 1] as const

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CreateOpportunityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const forCreatorId = searchParams.get('for')
  const forCreatorName = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : null

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: role === 'investor' ? 'investment' : 'gig' as 'gig' | 'job' | 'investment',
    category: '',
    budget_min: '',
    budget_max: '',
    currency: 'SLE',
    location: '',
    is_remote: true,
    deadline: '',
    experience_level: '' as '' | 'junior' | 'mid-level' | 'senior',
    company_name: '',
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill))
    } else if (selectedSkills.length < 10) {
      setSelectedSkills([...selectedSkills, skill])
    } else {
      toast.error('Maximum 10 skills allowed')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) { toast.error('Title is required'); return }
    if (!formData.description.trim()) { toast.error('Description is required'); return }
    if (!formData.category) { toast.error('Category is required'); return }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          type: formData.type,
          category: formData.category,
          budget_min: formData.budget_min ? parseFloat(formData.budget_min) : 0,
          budget_max: formData.budget_max ? parseFloat(formData.budget_max) : 0,
          currency: formData.currency,
          location: formData.location || (formData.is_remote ? 'Remote' : ''),
          is_remote: formData.is_remote,
          deadline: formData.deadline || null,
          required_skills: selectedSkills,
          experience_level: formData.experience_level || null,
          company_name: formData.company_name || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (forCreatorId) {
          fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient_id: forCreatorId,
              type: 'opportunity_invite',
              title: 'You\'ve been invited to an opportunity!',
              message: `Check out "${formData.title.trim()}" — an opportunity created with you in mind.`,
              link: `/opportunities/${data.opportunity.id}`,
            }),
          }).catch(() => {})
        }
        toast.success('Opportunity posted successfully!')
        router.push(`/opportunities/${data.opportunity.id}`)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to post opportunity')
      }
    } catch (error) {
      console.error('Error creating opportunity:', error)
      toast.error('Failed to post opportunity')
    } finally {
      setIsSubmitting(false)
    }
  }

  const descPercent = Math.min((formData.description.length / 2000) * 100, 100)

  return (
    <div className="min-h-screen pb-28">

      {/* ━━━ HERO HEADER ━━━ */}
      <motion.div
        className="relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-8">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 transition-all mb-6"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
              Back to Opportunities
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 text-[10px] font-bold uppercase tracking-wider border">
                <HugeiconsIcon icon={SparklesIcon} className="w-3 h-3 mr-1" />
                New Posting
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Post an{' '}
              <span className="text-brand-dark dark:text-foreground">
                Opportunity
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Find the right creative talent for your project
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* ━━━ FORM ━━━ */}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6">

        {forCreatorName && (
          <motion.div
            className="mt-4 p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <HugeiconsIcon icon={Briefcase01Icon} className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Creating opportunity for {forCreatorName}</p>
                <p className="text-xs text-muted-foreground">They&apos;ll be notified and invited to apply once published</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Type Selector ── */}
        <motion.div
          className="mt-6 mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Opportunity Type</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {typeOptions.map((type) => {
              const isActive = formData.type === type.value
              const icon = type.icon
              const iconEl = typeof icon === 'function'
                ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: cn('w-5 h-5', type.accent) })
                : <HugeiconsIcon icon={icon} className={cn('w-5 h-5', type.accent)} />
              return (
                <motion.button
                  key={type.value}
                  type="button"
                  onClick={() => updateField('type', type.value)}
                  className={cn(
                    'relative p-5 rounded-2xl border-2 text-left transition-all overflow-hidden group',
                    isActive
                      ? cn(type.borderActive, 'shadow-lg', type.shadow)
                      : 'border-border/50 hover:border-brand-purple-500/30 dark:border-brand-500/30'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Background gradient */}
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-br transition-opacity duration-300',
                    type.gradient,
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                  )} />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', type.bgLight)}>
                        {iconEl}
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={cn('w-6 h-6 rounded-full flex items-center justify-center', type.bgLight)}
                        >
                          <HugeiconsIcon icon={Tick01Icon} className={cn('w-4 h-4', type.accent)} />
                        </motion.div>
                      )}
                    </div>
                    <p className="font-bold text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* ── Basic Information ── */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Basic Information</h2>
          </div>

          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs text-muted-foreground">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g. Logo Designer Needed for Startup"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                maxLength={100}
                className="h-12 rounded-xl bg-background focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-xs text-muted-foreground">
                  Description <span className="text-red-500">*</span>
                </Label>
                <span className={cn(
                  'text-[10px] font-bold',
                  descPercent > 90 ? 'text-red-500' : descPercent > 70 ? 'text-yellow-500' : 'text-muted-foreground'
                )}>
                  {formData.description.length}/2000
                </span>
              </div>
              <Textarea
                id="description"
                placeholder="Describe the project, deliverables, and expectations..."
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={6}
                maxLength={2000}
                className="rounded-xl bg-background focus:ring-2 focus:ring-brand-purple-500/30 dark:ring-brand-500/30 resize-none"
              />
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-border/50 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    descPercent > 90 ? 'bg-red-500' : descPercent > 70 ? 'bg-yellow-500' : 'bg-brand-500'
                  )}
                  style={{ width: `${descPercent}%` }}
                />
              </div>
            </div>

            {/* Category + Company row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.category} onValueChange={(val) => updateField('category', val)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="text-xs text-muted-foreground flex items-center gap-1">
                  <HugeiconsIcon icon={Building02Icon} className="w-3 h-3" />
                  Company Name
                </Label>
                <Input
                  id="company_name"
                  placeholder="Your company or org name"
                  value={formData.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Budget ── */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <MdAttachMoney className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
              Budget
            </h2>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="budget_min" className="text-xs text-muted-foreground">Minimum</Label>
              <Input
                id="budget_min"
                type="number"
                placeholder="0"
                min="0"
                value={formData.budget_min}
                onChange={(e) => updateField('budget_min', e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <span className="text-muted-foreground pb-2.5 font-bold">&ndash;</span>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="budget_max" className="text-xs text-muted-foreground">Maximum</Label>
              <Input
                id="budget_max"
                type="number"
                placeholder="0"
                min="0"
                value={formData.budget_max}
                onChange={(e) => updateField('budget_max', e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex-shrink-0">
              <div className="flex rounded-xl border border-border/60 overflow-hidden">
                {['SLE', 'USD', 'EUR', 'GBP'].map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => updateField('currency', cur)}
                    className={cn(
                      'px-3 py-2.5 text-xs font-bold transition-colors',
                      formData.currency === cur
                        ? 'bg-brand-500 text-brand-dark'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Location & Deadline ── */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <HugeiconsIcon icon={Location01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
              Location & Deadline
            </h2>
          </div>

          <div className="space-y-5">
            {/* Remote toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <HugeiconsIcon icon={GlobeIcon} className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Remote Work</p>
                  <p className="text-xs text-muted-foreground">Can be done from anywhere</p>
                </div>
              </div>
              <Switch
                id="is_remote"
                checked={formData.is_remote}
                onCheckedChange={(checked) => updateField('is_remote', checked)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!formData.is_remote && (
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. Freetown, Sierra Leone"
                    value={formData.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              )}
              <div className={cn('space-y-1.5', formData.is_remote && 'sm:col-span-2')}>
                <Label htmlFor="deadline" className="text-xs text-muted-foreground flex items-center gap-1">
                  <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                  Deadline / Start Date
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => updateField('deadline', e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Required Skills ── */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-brand-500 rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <HugeiconsIcon icon={Tag01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                Required Skills
              </h2>
            </div>
            {selectedSkills.length > 0 && (
              <span className="text-[10px] font-bold text-brand-purple-600 dark:text-brand-400 bg-brand-purple-500/10 dark:bg-brand-500/10 px-2 py-0.5 rounded-full">
                {selectedSkills.length}/10
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3">Select up to 10 skills needed for this opportunity</p>

          <div className="flex flex-wrap gap-2 mb-5">
            {skillOptions.map((skill) => {
              const isSelected = selectedSkills.includes(skill)
              return (
                <motion.button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border font-medium transition-all',
                    isSelected
                      ? 'bg-brand-500 text-brand-dark border-brand-500 shadow-sm shadow-brand-purple-500/20 dark:shadow-brand-500/20'
                      : 'border-border/60 text-muted-foreground hover:border-brand-500/40 hover:text-brand-purple-600 dark:hover:text-brand-400'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSelected && <HugeiconsIcon icon={Tick01Icon} className="w-3 h-3 mr-1 inline" />}
                  {skill}
                </motion.button>
              )
            })}
          </div>

          {/* Experience Level */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Experience Level</Label>
            <Select
              value={formData.experience_level}
              onValueChange={(val) => updateField('experience_level', val)}
            >
              <SelectTrigger className="h-11 rounded-xl max-w-xs">
                <SelectValue placeholder="Any experience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid-level">Mid-Level</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      </form>

      {/* ━━━ STICKY FOOTER ━━━ */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t border-border z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="rounded-full" asChild>
            <Link href="/opportunities">Cancel</Link>
          </Button>

          <div className="flex items-center gap-3">
            {/* Quick summary */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              {formData.title && <span className="truncate max-w-[120px] font-medium text-foreground">{formData.title}</span>}
              {formData.category && (
                <>
                  <span className="text-border">|</span>
                  <span>{formData.category}</span>
                </>
              )}
            </div>

            <Button
              type="submit"
              form="create-form"
              className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-6 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 h-10"
              disabled={isSubmitting}
              onClick={(e) => {
                // Trigger form submit since the button is outside the form element
                e.preventDefault()
                const form = document.querySelector('form')
                if (form) form.requestSubmit()
              }}
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 mr-2" />
                  Post Opportunity
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
