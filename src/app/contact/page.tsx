'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Call02Icon, Cancel01Icon, CheckmarkCircle01Icon, HelpCircleIcon, InstagramIcon, Linkedin01Icon, Loading02Icon, Location01Icon, Mail01Icon, SentIcon, TwitterIcon } from "@hugeicons/core-free-icons";
import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SpotlightCard from '@/components/SpotlightCard'
import { PublicPageLayout } from '@/components/landing/public-page-layout'

const ease = [0.23, 1, 0.32, 1] as const

// ─── Data ────────────────────────────────────────────────────────────────────

const contactInfo = [
  {
    icon: Location01Icon,
    label: 'Office',
    primary: 'Freetown, Sierra Leone',
    secondary: 'Sierra Leone',
  },
  {
    icon: Mail01Icon,
    label: 'Email',
    primary: 'hello@creatuno.com',
    secondary: 'support@creatuno.com',
    href: 'mailto:hello@creatuno.com',
  },
  {
    icon: Call02Icon,
    label: 'Response Time',
    primary: 'Within 24 hours',
    secondary: 'Mon - Fri, 9am - 6pm GMT',
  },
]

const socials = [
  { icon: TwitterIcon, label: 'Twitter / X', href: '#', handle: '@creatuno' },
  { icon: Linkedin01Icon, label: 'LinkedIn', href: '#', handle: 'Creatuno' },
  { icon: InstagramIcon, label: 'Instagram', href: '#', handle: '@creatuno' },
]

const subjectOptions = [
  { value: '', label: 'Select a topic...' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'press', label: 'Press & Media' },
  { value: 'support', label: 'Technical Support' },
  { value: 'other', label: 'Other' },
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

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to send message')
      }
      setIsSuccess(true)
      setFormState({ name: '', email: '', subject: '', message: '' })
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
              <HugeiconsIcon icon={Mail01Icon} className="w-3.5 h-3.5" />
              Contact
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1]">
              <span className="text-brand-dark dark:text-foreground">
                Get in Touch
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto text-base sm:text-lg">
              Have a question, partnership idea, or just want to say hello? We&apos;d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ━━━ MAIN CONTENT ━━━ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

            {/* ── LEFT: Contact Form ── */}
            <div className="lg:col-span-3">
              <AnimatedSection>
                <SpotlightCard className="overflow-hidden">
                  <div className="relative px-6 sm:px-8 pt-6 pb-4 border-b border-border/30">
                    <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
                    <div className="relative">
                      <h2 className="text-lg font-bold text-foreground">Send Us a Message</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">We typically respond within 24 hours.</p>
                    </div>
                  </div>

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
                        <h3 className="text-lg font-bold text-foreground mb-2">Message sent!</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                          Thank you for reaching out. We&apos;ll get back to you shortly.
                        </p>
                        <Button variant="outline" className="rounded-full" onClick={() => setIsSuccess(false)}>
                          Send another message
                        </Button>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="contact-name" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                              Your Name
                            </label>
                            <Input
                              id="contact-name"
                              required
                              placeholder="John Doe"
                              value={formState.name}
                              onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                              className="rounded-xl bg-background/50"
                            />
                          </div>
                          <div>
                            <label htmlFor="contact-email" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                              Email Address
                            </label>
                            <Input
                              id="contact-email"
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
                          <label htmlFor="contact-subject" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                            Subject
                          </label>
                          <select
                            id="contact-subject"
                            required
                            value={formState.subject}
                            onChange={(e) => setFormState((p) => ({ ...p, subject: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-purple-500/50 dark:border-brand-500/50 transition-all"
                          >
                            {subjectOptions.map((opt) => (
                              <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="contact-message" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                            Message
                          </label>
                          <textarea
                            id="contact-message"
                            required
                            rows={5}
                            placeholder="Tell us more about your inquiry..."
                            value={formState.message}
                            onChange={(e) => setFormState((p) => ({ ...p, message: e.target.value }))}
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
                              Sending...
                            </>
                          ) : (
                            <>
                              <HugeiconsIcon icon={SentIcon} className="w-4 h-4 mr-2" />
                              Send Message
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </SpotlightCard>
              </AnimatedSection>
            </div>

            {/* ── RIGHT: Info sidebar ── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Contact info cards */}
              {contactInfo.map((item, i) => (
                  <AnimatedSection key={item.label} delay={i * 0.08}>
                    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                          <HugeiconsIcon icon={item.icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                          {item.href ? (
                            <a href={item.href} className="text-sm font-medium text-foreground hover:text-brand-purple-600 dark:text-brand-400 transition-colors block">
                              {item.primary}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-foreground">{item.primary}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{item.secondary}</p>
                        </div>
                      </div>
                    </div>
                  </AnimatedSection>
              ))}

              {/* Social links */}
              <AnimatedSection delay={0.25}>
                <SpotlightCard className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Follow Us</p>
                  <div className="space-y-2.5">
                    {socials.map((s) => (
                        <a
                          key={s.label}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center group-hover:bg-brand-purple-500/10 dark:bg-brand-500/10 transition-colors">
                            <HugeiconsIcon icon={s.icon} className="w-4 h-4 text-muted-foreground group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{s.label}</p>
                            <p className="text-[10px] text-muted-foreground">{s.handle}</p>
                          </div>
                        </a>
                    ))}
                  </div>
                </SpotlightCard>
              </AnimatedSection>

              {/* Help center link */}
              <AnimatedSection delay={0.35}>
                <SpotlightCard className="p-5 transition-all">
                  <Link
                    href="/help"
                    className="group flex items-center gap-3"
                  >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                    <HugeiconsIcon icon={HelpCircleIcon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors">
                      Looking for answers?
                    </p>
                    <p className="text-xs text-muted-foreground">Browse our Help Center & FAQ</p>
                  </div>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 text-muted-foreground group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors" />
                </Link>
                </SpotlightCard>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </section>
    </PublicPageLayout>
  )
}
