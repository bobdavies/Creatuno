'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, BookOpen01Icon, BulbIcon, Calendar01Icon, Cancel01Icon, CheckmarkCircle01Icon, Clock01Icon, Loading02Icon, LockIcon, Megaphone01Icon, Mortarboard01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import React, { useState, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { MdMic } from 'react-icons/md'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PublicPageLayout } from '@/components/landing/public-page-layout'

const ease = [0.23, 1, 0.32, 1] as const

// ─── Data ────────────────────────────────────────────────────────────────────

const previewArticles = [
  {
    title: 'Why Offline-First Matters for Sierra Leone',
    excerpt: 'How building for low-bandwidth environments is unlocking creative potential across the continent.',
    category: 'Industry Insights',
    readTime: '6 min read',
    date: 'Coming Soon',
  },
  {
    title: 'Meet Our First 100 Creatives',
    excerpt: 'Celebrating the talented designers, photographers, and artists who joined Creatuno in its earliest days.',
    category: 'Creator Spotlight',
    readTime: '8 min read',
    date: 'Coming Soon',
  },
  {
    title: 'The Future of Creative Work in Sierra Leone',
    excerpt: 'From graphic design to video editing -- the emerging creative economy and where it is headed.',
    category: 'Industry Insights',
    readTime: '5 min read',
    date: 'Coming Soon',
  },
]

const categories = [
  { icon: Mortarboard01Icon, label: 'Tutorials & Tips' },
  { icon: MdMic, label: 'Creator Spotlights' },
  { icon: Megaphone01Icon, label: 'Platform Updates' },
  { icon: BulbIcon, label: 'Industry Insights' },
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

export default function BlogPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/blog-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to subscribe')
      }
      setIsSuccess(true)
      setName('')
      setEmail('')
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
              <HugeiconsIcon icon={BookOpen01Icon} className="w-3.5 h-3.5" />
              Blog
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1]">
              <span className="text-brand-dark dark:text-foreground">
                Stories, Insights{'\n'}& Updates
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-base sm:text-lg">
              Our blog is launching soon. Be the first to read stories from Sierra Leone creatives,
              platform updates, and industry insights.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ━━━ COMING SOON BADGE ━━━ */}
      <section className="py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-purple-500/10 border border-brand-purple-500/20 text-brand-purple-500 text-sm font-semibold">
                <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4" />
                Coming Soon -- Subscribe to get notified at launch
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ━━━ PREVIEW ARTICLES ━━━ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">What&apos;s Coming</h2>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {previewArticles.map((article, i) => (
              <AnimatedSection key={article.title} delay={i * 0.08}>
                <div className="group relative h-full rounded-2xl border border-border/50 bg-card/40 overflow-hidden">
                  {/* Locked overlay */}
                  <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 border border-border/60 text-sm font-medium text-muted-foreground">
                      <HugeiconsIcon icon={LockIcon} className="w-3.5 h-3.5" />
                      Available soon
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    {/* Category & meta */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple-600 dark:text-brand-400">{article.category}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                        {article.date}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground mb-2 leading-snug">{article.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{article.excerpt}</p>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60">{article.readTime}</span>
                      <span className="flex items-center gap-1 text-xs text-brand-purple-600 dark:text-brand-400/50 font-medium">
                        Read
                        <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ CONTENT CATEGORIES ━━━ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">What to Expect</h2>
            <p className="text-sm text-muted-foreground">Content tailored for Sierra Leone creatives and the community</p>
          </AnimatedSection>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {categories.map((cat, i) => {
              const icon = cat.icon
              const iconEl = typeof icon === 'function'
                ? React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'w-4 h-4 text-brand-purple-600 dark:text-brand-400' })
                : <HugeiconsIcon icon={icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
              return (
                <AnimatedSection key={cat.label} delay={i * 0.06}>
                  <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full border border-border/50 bg-card/40 hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all">
                    {iconEl}
                    <span className="text-sm font-medium text-foreground">{cat.label}</span>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━ SUBSCRIBE FORM ━━━ */}
      <section className="py-16 sm:py-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <AnimatedSection>
            <SpotlightCard className="overflow-hidden">
              {/* Header */}
              <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center border-b border-border/30">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                    <HugeiconsIcon icon={Notification01Icon} className="w-7 h-7 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5">Get Notified at Launch</h2>
                  <p className="text-sm text-muted-foreground">
                    Be the first to know when our blog goes live. No spam, just great content.
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="px-6 sm:px-8 py-6 sm:py-8">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">You&apos;re on the list!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      We&apos;ll send you an email when the blog launches. Stay tuned!
                    </p>
                    <Button variant="outline" className="rounded-full" onClick={() => setIsSuccess(false)}>
                      Subscribe another email
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubscribe} className="space-y-4">
                    <div>
                      <label htmlFor="blog-name" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Your Name
                      </label>
                      <Input
                        id="blog-name"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-xl bg-background/50"
                      />
                    </div>
                    <div>
                      <label htmlFor="blog-email" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Email Address
                      </label>
                      <Input
                        id="blog-email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-xl bg-background/50"
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
                      className="w-full bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-8 py-2.5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 transition-all hover:shadow-xl hover:shadow-brand-500/25"
                    >
                      {isSubmitting ? (
                        <>
                          <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={Notification01Icon} className="w-4 h-4 mr-2" />
                          Notify Me at Launch
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </SpotlightCard>
          </AnimatedSection>
        </div>
      </section>
    </PublicPageLayout>
  )
}
