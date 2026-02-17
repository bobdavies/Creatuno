'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, ArrowUp01Icon, ArrowUpDownIcon, Briefcase01Icon, Cancel01Icon, CheckmarkCircle01Icon, HelpCircleIcon, Image01Icon, Loading02Icon, Mail01Icon, Message01Icon, RocketIcon, Search01Icon, SentIcon, UserCircleIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SpotlightCard from '@/components/SpotlightCard'
import { PublicPageLayout } from '@/components/landing/public-page-layout'
import { cn } from '@/lib/utils'

// ─── FAQ Data ────────────────────────────────────────────────────────────────

interface FAQItem {
  q: string
  a: string
}

interface FAQCategory {
  id: string
  label: string
  icon: React.ElementType
  description: string
  items: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: RocketIcon,
    description: 'Sign up, onboarding, and choosing your role',
    items: [
      {
        q: 'How do I create a Creatuno account?',
        a: 'Click "Get Started" on the homepage. You can sign up with your email or a social account. After verifying your email you will be taken to the onboarding flow where you choose your role and fill in your profile.',
      },
      {
        q: 'What roles are available on Creatuno?',
        a: 'Creatuno supports four roles: Creative Professional (showcase your portfolio and apply for gigs), Mentor (guide and review other creatives), Employer (post opportunities and hire talent), and Investor (discover and support creative talent).',
      },
      {
        q: 'Can I change my role later?',
        a: 'Currently your role is set during onboarding. If you need to change it, visit Settings and update your profile, or contact our support team for assistance.',
      },
      {
        q: 'Does Creatuno work offline?',
        a: 'Yes! Creatuno is built as an offline-first Progressive Web App. You can browse cached portfolios, draft messages, and work on content even without an internet connection. Changes sync automatically when you reconnect.',
      },
    ],
  },
  {
    id: 'account-profile',
    label: 'Account & Profile',
    icon: UserCircleIcon,
    description: 'Managing your account, avatar, and skills',
    items: [
      {
        q: 'How do I edit my profile?',
        a: 'Go to Settings or click your avatar and choose "Edit Profile". You can update your name, bio, skills, location, and avatar photo.',
      },
      {
        q: 'How do I change my avatar?',
        a: 'Navigate to Profile > Edit Profile. Click on your current avatar to upload a new image. The image will be cropped to a square and stored securely.',
      },
      {
        q: 'How do I manage my skills?',
        a: 'In Edit Profile, scroll to the Skills section. You can add new skills by typing and pressing Enter, or remove existing ones by clicking the X on each skill tag.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Please contact our support team using the form below. We will process your account deletion request and remove all associated data within 30 days.',
      },
    ],
  },
  {
    id: 'portfolios',
    label: 'Portfolios & Projects',
    icon: Image01Icon,
    description: 'Creating, sharing, and managing portfolios',
    items: [
      {
        q: 'How do I create a portfolio?',
        a: 'From your Dashboard, click "New Portfolio". Give it a title, description, and tagline. You can then add individual projects with images, descriptions, tags, and external links.',
      },
      {
        q: 'Can I have multiple portfolios?',
        a: 'Yes! You can create as many portfolios as you need -- for example, one for graphic design work and another for photography.',
      },
      {
        q: 'How do I share my portfolio?',
        a: 'Each portfolio has a unique public URL based on your username and portfolio slug. You can copy this link from the portfolio page and share it anywhere. Public portfolios are discoverable through the Portfolios page and search.',
      },
      {
        q: 'Can I make my portfolio private?',
        a: 'Yes. When editing a portfolio, toggle the "Public" switch off. Private portfolios are only visible to you and won\'t appear in search results or the public directory.',
      },
    ],
  },
  {
    id: 'opportunities',
    label: 'Opportunities & Applications',
    icon: Briefcase01Icon,
    description: 'Finding gigs, applying, and posting opportunities',
    items: [
      {
        q: 'How do I find opportunities?',
        a: 'Browse the Opportunities page from the navigation bar. You can filter by type (gig, job, investment), category, budget range, and whether the opportunity is remote.',
      },
      {
        q: 'How do I apply for an opportunity?',
        a: 'Open an opportunity and click "Apply". You will be asked to write a cover letter, optionally propose a budget, and attach a portfolio. The employer will be notified of your application.',
      },
      {
        q: 'How do I post an opportunity as an employer?',
        a: 'From your Employer Dashboard, click "Post Opportunity". Fill in the title, description, type, category, budget range, required skills, and deadline. Your listing will be visible to all creatives.',
      },
      {
        q: 'How do I submit work for an accepted application?',
        a: 'Once an employer accepts your application, go to your Applications dashboard. You will see an option to submit work with files and a message. The employer can then approve or request revisions (up to 2 times).',
      },
    ],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    icon: Message01Icon,
    description: 'Sending messages, attachments, and offline messaging',
    items: [
      {
        q: 'How do I send a message?',
        a: 'Navigate to Messages from the sidebar. Start a new conversation by selecting a user, or continue an existing one. Type your message and press Send.',
      },
      {
        q: 'Can I send file attachments?',
        a: 'Yes. In the message composer, click the attachment icon to upload files. Supported formats include images, PDFs, and documents.',
      },
      {
        q: 'Do messages work offline?',
        a: 'You can draft and read cached messages while offline. New messages will be queued and sent automatically when your connection is restored.',
      },
    ],
  },
  {
    id: 'mentorship',
    label: 'Mentorship',
    icon: UserGroupIcon,
    description: 'Finding mentors, requesting guidance, and giving feedback',
    items: [
      {
        q: 'How do I find a mentor?',
        a: 'Go to the Mentorship page and browse available mentors. You can filter by skills and availability. Click "Request Mentorship" to send a request with your goals and skills you want to develop.',
      },
      {
        q: 'How does the mentorship process work?',
        a: 'After a mentor accepts your request, you will be paired in an active mentorship. You can communicate through messages, and the mentor can provide feedback on your work. Either party can end the mentorship when goals are met.',
      },
      {
        q: 'How do I become a mentor?',
        a: 'Select the "Mentor" role during onboarding, or update your profile to enable mentorship. Set your availability, the number of mentees you can accept, and the skills you can teach.',
      },
      {
        q: 'Can I leave feedback for my mentor?',
        a: 'Yes. Once a mentorship session concludes, you can rate your mentor and leave written feedback. This helps other creatives find great mentors.',
      },
    ],
  },
]

const ease = [0.23, 1, 0.32, 1] as const

// ─── Page Component ──────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const [formState, setFormState] = useState({ name: '', email: '', subject: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const faqRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Back to top visibility
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filter FAQ items by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return faqCategories
    const q = searchQuery.toLowerCase()
    return faqCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [searchQuery])

  const totalResults = filteredCategories.reduce((sum, c) => sum + c.items.length, 0)
  const allItemKeys = filteredCategories.flatMap((cat) => cat.items.map((_, idx) => `${cat.id}-${idx}`))
  const allExpanded = allItemKeys.length > 0 && allItemKeys.every((key) => openItems.has(key))

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (allExpanded) {
      setOpenItems(new Set())
    } else {
      setOpenItems(new Set(allItemKeys))
    }
  }

  const scrollToFaq = (categoryId: string) => {
    const el = document.getElementById(`faq-${categoryId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
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

      setSubmitSuccess(true)
      setFormState({ name: '', email: '', subject: '', message: '' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple-500/30 dark:border-brand-500/30 bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
              <HugeiconsIcon icon={HelpCircleIcon} className="w-3.5 h-3.5" />
              Help Center
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
              <span className="text-brand-dark dark:text-foreground">
                How can we help?
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Find answers to common questions or reach out to our team for personalised support.
            </p>

            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="w-full pl-12 pr-24 py-3.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all text-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <>
                    <span className="text-xs text-muted-foreground mr-1">
                      {totalResults} result{totalResults !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        searchInputRef.current?.focus()
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      aria-label="Clear search"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 text-[10px] text-muted-foreground font-mono">
                    Ctrl K
                  </kbd>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ━━━ CATEGORY QUICK LINKS ━━━ */}
        {!searchQuery && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-12 sm:mb-16"
          >
            {faqCategories.map((cat, i) => (
                <SpotlightCard key={cat.id} className="p-4 sm:p-5 flex flex-col items-start gap-3 hover:shadow-lg hover:shadow-brand-500/5 transition-all overflow-hidden">
                  <motion.button
                    onClick={() => scrollToFaq(cat.id)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.05, ease }}
                    className="group relative w-full flex flex-col items-start gap-3 text-left cursor-pointer"
                  >
                    {/* Subtle hover gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                        <HugeiconsIcon icon={cat.icon} className="w-5 h-5 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                    </div>
                    <div className="relative">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors">{cat.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
                    </div>
                    <div className="relative flex items-center gap-1 text-[10px] font-medium text-muted-foreground group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors">
                      {cat.items.length} questions
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </motion.button>
                </SpotlightCard>
            ))}
          </motion.section>
        )}

        {/* ━━━ FAQ ACCORDION ━━━ */}
        <section ref={faqRef} className="mb-16 sm:mb-20">
          {/* Section header with expand/collapse */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {searchQuery ? 'Search Results' : 'Frequently Asked Questions'}
            </h2>
            {filteredCategories.length > 0 && (
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-card/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all"
              >
                <HugeiconsIcon icon={ArrowUpDownIcon} className="w-3.5 h-3.5" />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            )}
          </div>

          {filteredCategories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
            >
            <SpotlightCard className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <HugeiconsIcon icon={Search01Icon} className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                We couldn&apos;t find anything matching &ldquo;{searchQuery}&rdquo;. Try different keywords or send us a message below.
              </p>
              <Button variant="outline" className="rounded-full" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </SpotlightCard>
            </motion.div>
          ) : (
            <div className="space-y-10 sm:space-y-12">
              {filteredCategories.map((cat) => (
                  <div key={cat.id} id={`faq-${cat.id}`} className="scroll-mt-24">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                        <HugeiconsIcon icon={cat.icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-foreground">{cat.label}</h3>
                        <p className="text-xs text-muted-foreground hidden sm:block">{cat.description}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {cat.items.map((item, idx) => {
                        const key = `${cat.id}-${idx}`
                        const isOpen = openItems.has(key)
                        return (
                          <motion.div
                            key={key}
                            layout
                            className={cn(
                              'rounded-xl border transition-all',
                              isOpen
                                ? 'border-brand-purple-500/30 dark:border-brand-500/30 bg-card/60 shadow-sm shadow-brand-500/5'
                                : 'border-border/50 bg-card/30 hover:border-border hover:bg-card/40',
                            )}
                          >
                            <button
                              onClick={() => toggleItem(key)}
                              className="w-full flex items-center justify-between gap-3 p-4 text-left"
                            >
                              <span className={cn('text-sm font-medium leading-snug', isOpen ? 'text-foreground' : 'text-foreground/80')}>
                                {item.q}
                              </span>
                              <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center"
                              >
                                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 text-muted-foreground" />
                              </motion.div>
                            </button>
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-3 mx-4 mb-0 -mt-0">
                                    {item.a}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
            ))}
            </div>
          )}
        </section>

        {/* ━━━ CONTACT / SUPPORT FORM ━━━ */}
        <section className="mb-16 sm:mb-20">
          <div className="max-w-2xl mx-auto">
            <SpotlightCard className="overflow-hidden">
              {/* Form header */}
              <div className="relative px-6 sm:px-8 pt-8 pb-6 text-center border-b border-border/30">
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-brand-purple-500/10 dark:ring-brand-500/10">
                    <HugeiconsIcon icon={Mail01Icon} className="w-7 h-7 text-brand-purple-600 dark:text-brand-400" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5">Still need help?</h2>
                  <p className="text-sm text-muted-foreground">
                    Send us a message and our team will get back to you within 24 hours.
                  </p>
                </div>
              </div>

              {/* Form body */}
              <div className="px-6 sm:px-8 py-6 sm:py-8">
                {submitSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-10"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">Message sent successfully!</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                      Thank you for reaching out. We&apos;ll review your message and get back to you as soon as possible.
                    </p>
                    <Button variant="outline" className="rounded-full" onClick={() => setSubmitSuccess(false)}>
                      Send another message
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="support-name" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                          Your Name
                        </label>
                        <Input
                          id="support-name"
                          required
                          placeholder="John Doe"
                          value={formState.name}
                          onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                          className="rounded-xl bg-background/50"
                        />
                      </div>
                      <div>
                        <label htmlFor="support-email" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                          Email Address
                        </label>
                        <Input
                          id="support-email"
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
                      <label htmlFor="support-subject" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Subject
                      </label>
                      <Input
                        id="support-subject"
                        required
                        placeholder="What do you need help with?"
                        value={formState.subject}
                        onChange={(e) => setFormState((p) => ({ ...p, subject: e.target.value }))}
                        className="rounded-xl bg-background/50"
                      />
                    </div>
                    <div>
                      <label htmlFor="support-message" className="text-xs font-semibold text-foreground mb-1.5 block uppercase tracking-wider">
                        Message
                      </label>
                      <textarea
                        id="support-message"
                        required
                        rows={5}
                        placeholder="Describe your issue or question in detail..."
                        value={formState.message}
                        onChange={(e) => setFormState((p) => ({ ...p, message: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/50 transition-all resize-none"
                      />
                    </div>

                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 flex-shrink-0" />
                        {submitError}
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
          </div>
        </section>

        {/* Quick links footer */}
        <section className="mb-12 text-center">
          <p className="text-xs text-muted-foreground mb-3">Related resources</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Cookie Policy', href: '/cookie-policy' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border/50 bg-card/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-brand-purple-500/30 dark:border-brand-500/30 hover:bg-card/60 transition-all"
              >
                {link.label}
                <HugeiconsIcon icon={ArrowRight01Icon} className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Back to top */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-brand-500 text-brand-dark shadow-lg shadow-brand-500/25 flex items-center justify-center hover:bg-brand-600 transition-colors"
            aria-label="Back to top"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </PublicPageLayout>
  )
}
