'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, BookOpen01Icon, Briefcase01Icon, Cancel01Icon, CheckmarkCircle01Icon, Clock01Icon, ColorPickerIcon, GlobeIcon, LaptopIcon, Loading02Icon, Megaphone01Icon, Message01Icon, SentIcon, SparklesIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import React, { useState, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { MdFavoriteBorder, MdCode } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SpotlightCard from '@/components/SpotlightCard'
import { PublicPageLayout } from '@/components/landing/public-page-layout'

const ease = [0.23, 1, 0.32, 1] as const

// ─── Data ────────────────────────────────────────────────────────────────────

const cultureValues = [
  {
    icon: GlobeIcon,
    title: 'Remote-First',
    description: 'Work from anywhere. We believe great work happens when people have the freedom to work where they are most productive.',
  },
  {
    icon: MdFavoriteBorder,
    title: 'Mission-Driven',
    description: 'Every line of code, every design, and every decision is guided by our mission to empower Sierra Leone creatives.',
  },
  {
    icon: UserGroupIcon,
    title: 'Small Team, Big Impact',
    description: 'We are a lean, focused team where every person makes a meaningful difference. Your contributions matter.',
  },
  {
    icon: BookOpen01Icon,
    title: 'Learning Culture',
    description: 'We invest in your growth with a learning budget, mentorship, and a culture of knowledge sharing.',
  },
  {
    icon: Clock01Icon,
    title: 'Work-Life Balance',
    description: 'Flexible hours, generous time off, and a culture that respects your life outside of work.',
  },
  {
    icon: SparklesIcon,
    title: 'Diverse & Inclusive',
    description: 'We celebrate different perspectives and backgrounds. Building for Sierra Leone means building with Sierra Leone.',
  },
]

const perks = [
  'Flexible working hours & remote work',
  'Competitive compensation',
  'Learning & development budget',
  'Creative freedom to shape the product',
  'Equity / ownership potential',
  'Impact-driven work that changes lives',
  'Collaborative, supportive team culture',
  'Access to the Sierra Leone creative community',
]

const interestAreas = [
  { icon: MdCode, label: 'Engineering', description: 'Frontend, backend, mobile, infrastructure' },
  { icon: ColorPickerIcon, label: 'Design', description: 'Product design, brand, UX research' },
  { icon: Message01Icon, label: 'Community', description: 'Community management, support, content' },
  { icon: Megaphone01Icon, label: 'Marketing', description: 'Growth, partnerships, social media' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CareersPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    role: '',
    portfolioUrl: '',
    coverLetter: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/careers-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to submit application')
      }
      setIsSuccess(true)
      setFormState({ name: '', email: '', role: '', portfolioUrl: '', coverLetter: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicPageLayout>
      {/* ━━━ HERO ━━━ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple-500/30 dark:border-brand-500/30 bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
              <HugeiconsIcon icon={Briefcase01Icon} className="w-3.5 h-3.5" />
              Careers
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1]">
              <span className="text-brand-dark dark:text-foreground">
                Build the Future of{'\n'}Creative Work
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-base sm:text-lg">
              Join a mission-driven team empowering the next generation of Sierra Leone creatives
              through technology and community.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ━━━ CULTURE VALUES ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-3 block">Our Culture</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">Why Creatuno?</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              We&apos;re building something meaningful -- and we do it in a way that reflects our values.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {cultureValues.map((v, i) => {
              const Icon = v.icon
              const iconEl = typeof Icon === 'function'
                ? React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'w-5 h-5 text-brand-purple-600 dark:text-brand-400' })
                : <HugeiconsIcon icon={Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
              return (
                <AnimatedSection key={v.title} delay={i * 0.06}>
                  <div className="group h-full rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6 hover:border-brand-purple-500/20 dark:border-brand-500/20 hover:shadow-lg hover:shadow-brand-500/5 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-4 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10 group-hover:ring-brand-purple-500/20 dark:ring-brand-500/20 transition-all">
                      {iconEl}
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1.5">{v.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.description}</p>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ PERKS ━━━ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="relative rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent" />
              <div className="relative p-6 sm:p-10 md:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                    <HugeiconsIcon icon={LaptopIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">What We Offer</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {perks.map((perk, i) => (
                    <motion.div
                      key={perk}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04, ease }}
                      className="flex items-center gap-2.5"
                    >
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{perk}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ━━━ OPEN POSITIONS ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-3 block">Open Roles</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">We&apos;re Always Looking for Talent</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              We don&apos;t have specific openings right now, but we&apos;re always interested in hearing from
              talented people who share our mission. Here are the areas we&apos;re typically hiring for:
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {interestAreas.map((area, i) => {
              const Icon = area.icon
              const iconEl = typeof Icon === 'function'
                ? React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'w-5 h-5 text-brand-purple-600 dark:text-brand-400' })
                : <HugeiconsIcon icon={Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
              return (
                <AnimatedSection key={area.label} delay={i * 0.06}>
                  <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl border border-border/50 bg-card/40 hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                      {iconEl}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground mb-0.5">{area.label}</h3>
                      <p className="text-xs text-muted-foreground">{area.description}</p>
                    </div>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ APPLICATION FORM ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
              {/* Header */}
              <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center border-b border-border/30">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                    <HugeiconsIcon icon={SentIcon} className="w-7 h-7 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5">General Application</h2>
                  <p className="text-sm text-muted-foreground">
                    Tell us about yourself and what you&apos;d love to work on. We&apos;ll reach out when a role fits.
                  </p>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 sm:px-8 py-6 sm:py-8">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">Application received!</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Thank you for your interest in Creatuno. We&apos;ll review your application and reach out if there&apos;s a great fit.
                    </p>
                    <Button variant="outline" className="rounded-full" onClick={() => setIsSuccess(false)}>
                      Submit another application
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="career-name" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                          Full Name
                        </label>
                        <Input
                          id="career-name"
                          required
                          placeholder="John Doe"
                          value={formState.name}
                          onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                          className="rounded-xl bg-background/50"
                        />
                      </div>
                      <div>
                        <label htmlFor="career-email" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                          Email Address
                        </label>
                        <Input
                          id="career-email"
                          type="email"
                          required
                          placeholder="you@example.com"
                          value={formState.email}
                          onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                          className="rounded-xl bg-background/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="career-role" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Area of Interest
                      </label>
                      <select
                        id="career-role"
                        required
                        value={formState.role}
                        onChange={(e) => setFormState((p) => ({ ...p, role: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all"
                      >
                        <option value="" disabled>Select an area...</option>
                        <option value="engineering">Engineering</option>
                        <option value="design">Design</option>
                        <option value="community">Community</option>
                        <option value="marketing">Marketing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="career-url" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Portfolio or LinkedIn URL <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                      </label>
                      <Input
                        id="career-url"
                        type="url"
                        placeholder="https://..."
                        value={formState.portfolioUrl}
                        onChange={(e) => setFormState((p) => ({ ...p, portfolioUrl: e.target.value }))}
                        className="rounded-xl bg-background/50"
                      />
                    </div>

                    <div>
                      <label htmlFor="career-cover" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Cover Letter
                      </label>
                      <textarea
                        id="career-cover"
                        required
                        rows={5}
                        placeholder="Tell us about yourself, your experience, and why you'd love to work at Creatuno..."
                        value={formState.coverLetter}
                        onChange={(e) => setFormState((p) => ({ ...p, coverLetter: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all resize-none"
                      />
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-8 py-2.5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 transition-all hover:shadow-xl hover:shadow-brand-500/25"
                    >
                      {isSubmitting ? (
                        <>
                          <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                          Submit Application
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </PublicPageLayout>
  )
}
