'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, ArrowUp01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { PublicPageLayout } from '@/components/landing/public-page-layout'
import { cn } from '@/lib/utils'

const ease = [0.23, 1, 0.32, 1] as const

interface TOCSection {
  id: string
  title: string
}

interface RelatedLink {
  label: string
  href: string
}

/** Hugeicons from @hugeicons/core-free-icons are data objects; react-icons are React components. */
interface LegalPageShellProps {
  badge: { icon: React.ElementType | Record<string, unknown>; label: string }
  title: string
  subtitle: string
  sections: TOCSection[]
  relatedLinks: RelatedLink[]
  children: React.ReactNode
}

export function LegalPageShell({ badge, title, subtitle, sections, relatedLinks, children }: LegalPageShellProps) {
  const [tocOpen, setTocOpen] = useState(false)
  const [activeId, setActiveId] = useState<string>('')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  // Scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
      setShowBackToTop(scrollTop > 600)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll spy for active TOC item
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visibleSections = new Map<string, boolean>()

    sections.forEach((section) => {
      const el = document.getElementById(section.id)
      if (!el) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          visibleSections.set(section.id, entry.isIntersecting)

          // Find the first visible section
          for (const s of sections) {
            if (visibleSections.get(s.id)) {
              setActiveId(s.id)
              return
            }
          }
        },
        { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [sections])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const badgeIconEl =
    typeof badge.icon === 'function'
      ? React.createElement(badge.icon as React.ElementType, { className: 'w-3.5 h-3.5' })
      : <HugeiconsIcon icon={badge.icon as Parameters<typeof HugeiconsIcon>[0]['icon']} className="w-3.5 h-3.5" />

  return (
    <PublicPageLayout>
      {/* Scroll progress bar */}
      <div className="fixed top-16 left-0 right-0 z-40 h-0.5 bg-border/20">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-purple-400"
          style={{ width: `${scrollProgress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 via-brand-purple-500/5 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-purple-500/30 dark:border-brand-500/30 bg-brand-purple-500/10 dark:bg-brand-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest mb-6">
              {badgeIconEl}
              {badge.label}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              <span className="text-brand-dark dark:text-foreground">
                {title}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        {/* Mobile TOC */}
        <div className="lg:hidden mb-8">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm text-sm font-medium text-foreground hover:border-brand-purple-500/20 dark:border-brand-500/20 transition-all"
          >
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Menu01Icon} className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" />
              Table of Contents
            </span>
            <HugeiconsIcon icon={ArrowDown01Icon} className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', tocOpen && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {tocOpen && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm space-y-0.5">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      onClick={() => setTocOpen(false)}
                      className={cn(
                        'block text-xs py-1.5 px-2 rounded-lg transition-all',
                        activeId === s.id
                          ? 'text-brand-purple-600 dark:text-brand-400 bg-brand-purple-500/10 dark:bg-brand-500/10 font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                      )}
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-12">
          {/* Desktop TOC sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <nav className="sticky top-24">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">On this page</p>
              <div className="space-y-0.5 border-l border-border/50">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={cn(
                      'block text-xs py-1.5 pl-3 -ml-px border-l-2 transition-all truncate',
                      activeId === s.id
                        ? 'border-brand-500 text-brand-purple-600 dark:text-brand-400 font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                    )}
                  >
                    {s.title}
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          {/* Content */}
          <article className="flex-1 min-w-0 space-y-10 text-sm text-muted-foreground leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-2 [&_h3]:mt-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_p]:mb-3 [&_section]:border-b [&_section]:border-border/30 [&_section]:pb-8">
            {children}

            {/* Related links */}
            <div className="pt-2 !border-b-0">
              <p className="text-xs text-muted-foreground mb-3">Related</p>
              <div className="flex flex-wrap gap-2">
                {relatedLinks.map((link) => (
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
            </div>
          </article>
        </div>
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
