'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon, ArrowRight01Icon, Briefcase01Icon, CheckmarkCircle01Icon, ColorPickerIcon, GlobeIcon, Mortarboard01Icon, Resize01Icon, RocketIcon, SparklesIcon, Target01Icon, UserGroupIcon, WifiOff01Icon } from "@hugeicons/core-free-icons";
import React, { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'motion/react'
import { MdFavoriteBorder, MdBolt } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'
import { PublicPageLayout } from '@/components/landing/public-page-layout'

const ease = [0.23, 1, 0.32, 1] as const

// ─── Data ────────────────────────────────────────────────────────────────────

const values = [
  {
    icon: WifiOff01Icon,
    title: 'Offline-First',
    description: 'Built for low-bandwidth environments. Create, edit, and browse even without internet -- everything syncs when you reconnect.',
  },
  {
    icon: MdFavoriteBorder,
    title: 'Community-Driven',
    description: 'Our Village Square empowers creatives to share, learn, and grow together. The community is the platform.',
  },
  {
    icon: Resize01Icon,
    title: 'Fair & Transparent',
    description: 'Industry-low 10% platform fees, clear terms, and no hidden costs. Creatives keep what they earn.',
  },
  {
    icon: GlobeIcon,
    title: 'Sierra Leone-Focused',
    description: 'Designed specifically for Sierra Leone. Local context, local currency support, local opportunities.',
  },
  {
    icon: ColorPickerIcon,
    title: 'Creator-Owned',
    description: 'You retain full ownership of everything you create. Your portfolio, your projects, your intellectual property.',
  },
  {
    icon: SparklesIcon,
    title: 'Impact-First',
    description: 'More than a platform -- a social impact initiative to unlock the economic potential of creative talent across Sierra Leone.',
  },
]

const impactGoals = [
  { value: '10,000+', label: 'Creatives empowered to earn sustainable income', icon: UserGroupIcon },
  { value: '50%', label: 'Average income increase for active creatives', icon: AnalyticsUpIcon },
  { value: '1,000+', label: 'Active mentorship relationships', icon: Mortarboard01Icon },
  { value: '5,000+', label: 'Opportunities matched & fulfilled', icon: Briefcase01Icon },
]

const timeline = [
  {
    phase: 'Phase 1',
    title: 'MVP Launch',
    period: 'Months 1-3',
    target: '100 beta users in Freetown',
    items: [
      'Portfolio builder (online + offline)',
      'Public portfolio viewing & discovery',
      'Village Square community feed',
      'User profiles & search',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Full Platform',
    period: 'Months 4-6',
    target: '500 users across Sierra Leone',
    items: [
      'Mentorship system',
      'Opportunities board',
      'Payment integration',
      'Notifications & enhanced search',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Scale & Expand',
    period: 'Months 7-12',
    target: '5,000 users; expand to Liberia & Ghana',
    items: [
      'Mobile money integration',
      'AI mentorship matching',
      'Portfolio analytics & premium features',
      'Regional expansion across Sierra Leone',
    ],
  },
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

export default function AboutPage() {
  return (
    <PublicPageLayout>
      {/* ━━━ HERO ━━━ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-brand-purple-500/10 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple-500/30 dark:border-brand-500/30 bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
              <MdFavoriteBorder className="w-3.5 h-3.5" />
              Our Story
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1]">
              <span className="text-brand-dark dark:text-foreground">
                Empowering Creative{'\n'}Talent Across Sierra Leone
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
              Creatuno is an offline-first platform that connects talented creative professionals
              in low-bandwidth environments and global opportunities.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ━━━ MISSION ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <SpotlightCard className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent" />
              <div className="relative p-8 sm:p-12 md:p-16 text-center">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-4 block">Our Mission</span>
                <blockquote className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-snug max-w-3xl mx-auto">
                  &ldquo;Connect talented creative professionals in low-bandwidth environments
                  and global opportunities through an offline-first digital platform.&rdquo;
                </blockquote>
              </div>
            </SpotlightCard>
          </AnimatedSection>
        </div>
      </section>

      {/* ━━━ THE PROBLEM / THE SOLUTION ━━━ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Problem */}
            <AnimatedSection delay={0}>
              <SpotlightCard className="h-full p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <HugeiconsIcon icon={Target01Icon} className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">The Challenge</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Creative professionals in Sierra Leone and similar developing markets face critical barriers
                  that keep their talent invisible to the world:
                </p>
                <ul className="space-y-2.5">
                  {[
                    'No affordable way to showcase work online',
                    'Existing platforms are data-heavy and unusable on slow 3G networks',
                    'Limited access to jobs, gigs, and investment opportunities',
                    'Mentorship gap -- emerging creatives lack guidance from experienced professionals',
                    'Payment barriers for international or remote work',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </AnimatedSection>

            {/* The Solution */}
            <AnimatedSection delay={0.1}>
              <SpotlightCard className="h-full p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center">
                    <MdBolt className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">Our Solution</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Creatuno is purpose-built for low-bandwidth environments, giving creatives everything
                  they need to thrive -- even without consistent internet:
                </p>
                <ul className="space-y-2.5">
                  {[
                    'Build professional portfolios entirely offline',
                    'Discover jobs, gigs, and freelance opportunities',
                    'Connect with experienced mentors in your field',
                    'Earn money safely through secure payments',
                    'Build community in the Village Square feed',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ━━━ CORE VALUES ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-3 block">What We Stand For</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Our Core Values</h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {values.map((v, i) => {
              const Icon = v.icon
              const iconEl = typeof Icon === 'function'
                ? React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'w-5 h-5 text-brand-purple-600 dark:text-brand-400' })
                : <HugeiconsIcon icon={Icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
              return (
                <AnimatedSection key={v.title} delay={i * 0.06}>
                  <SpotlightCard className="group h-full p-5 sm:p-6 hover:shadow-lg hover:shadow-brand-500/5 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mb-4 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10 group-hover:ring-brand-purple-500/20 dark:ring-brand-500/20 transition-all">
                      {iconEl}
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1.5">{v.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.description}</p>
                  </SpotlightCard>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ IMPACT GOALS ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-3 block">Social Impact</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">Impact Goals</h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Creatuno is more than a business -- it&apos;s a social impact initiative to unlock the economic potential of creative talent.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {impactGoals.map((goal, i) => (
                <AnimatedSection key={goal.label} delay={i * 0.08}>
                  <SpotlightCard className="relative p-6 sm:p-8 overflow-hidden group transition-all">
                    <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/10 to-brand-purple-500/5 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                      <HugeiconsIcon icon={goal.icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-brand-500 to-brand-purple-400 bg-clip-text text-transparent mb-2">
                      {goal.value}
                    </div>
                    <p className="text-sm text-muted-foreground pr-12">{goal.label}</p>
                  </SpotlightCard>
                </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ ROADMAP ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400 mb-3 block">Where We&apos;re Going</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Our Roadmap</h2>
          </AnimatedSection>

          <div className="relative">
            {/* Vertical line (desktop) */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-border/50 -translate-x-1/2" />

            <div className="space-y-8 md:space-y-0">
              {timeline.map((phase, i) => (
                <AnimatedSection key={phase.phase} delay={i * 0.1}>
                  <div className={`md:grid md:grid-cols-2 md:gap-10 md:mb-12 ${i % 2 === 1 ? 'md:direction-rtl' : ''}`}>
                    {/* Card */}
                    <div className={`${i % 2 === 1 ? 'md:col-start-2' : 'md:col-start-1'}`}>
                      <SpotlightCard className="relative p-6 sm:p-8 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/3 to-transparent" />
                        <div className="relative">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple-500/10 dark:bg-brand-500/10 border border-brand-purple-500/20 dark:border-brand-500/20 text-brand-purple-600 dark:text-brand-400 text-xs font-bold">
                              <HugeiconsIcon icon={RocketIcon} className="w-3 h-3" />
                              {phase.phase}
                            </span>
                            <span className="text-xs text-muted-foreground">{phase.period}</span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-1">{phase.title}</h3>
                          <p className="text-xs text-muted-foreground mb-4">Target: {phase.target}</p>
                          <ul className="space-y-2">
                            {phase.items.map((item) => (
                              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400/70 mt-0.5 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </SpotlightCard>
                    </div>

                    {/* Timeline dot (desktop) */}
                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center justify-center" style={{ top: `${i * 33 + 8}%` }}>
                      <div className="w-4 h-4 rounded-full bg-brand-500 ring-4 ring-background" />
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-purple-500" />

              <div className="relative p-8 sm:p-12 md:p-16 text-center">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  Get started
                </h2>
                <p className="text-white/80 max-w-lg mx-auto mb-8 text-sm sm:text-base">
                  Whether you&apos;re a creative professional, mentor, employer, or investor -- there&apos;s a place for you on Creatuno.
                  Help us empower the next generation of Sierra Leone creatives.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link href="/sign-up">
                    <Button size="lg" className="bg-white text-brand-600 hover:bg-white/90 rounded-xl px-8 shadow-lg font-semibold">
                      Get Started Free
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-xl px-8">
                      Contact Us
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </PublicPageLayout>
  )
}
