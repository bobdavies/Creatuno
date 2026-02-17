'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import BlurText from '@/components/BlurText'

/*
 * Editorial-style features section.
 * Instead of generic icon-cards, each feature is a large staggered row
 * with an oversized number, bold headline, and description — inspired
 * by magazine / editorial layouts. A decorative accent line connects
 * the vertical rhythm.
 *
 * All feature data (titles, descriptions, details) is preserved from
 * the original component.
 */

const features = [
  {
    num: '01',
    title: 'Portfolio\nBuilder',
    description: 'Create stunning, professional portfolios with drag-and-drop ease. Add projects, images, videos, and more.',
    detail: 'Works 100% offline',
    accent: 'Build',
  },
  {
    num: '02',
    title: 'Find\nOpportunities',
    description: 'Browse curated jobs, gigs, and investment opportunities tailored to your creative skills and location.',
    detail: 'Real-time listings',
    accent: 'Discover',
  },
  {
    num: '03',
    title: 'Mentorship\nNetwork',
    description: 'Connect with experienced professionals who guide you. Send requests, share portfolios, grow together.',
    detail: 'Direct messaging',
    accent: 'Connect',
  },
  {
    num: '04',
    title: 'Offline-\nFirst',
    description: 'No internet? No problem. Create, edit, and save your work anytime. Auto-sync when connected.',
    detail: 'Auto background sync',
    accent: 'Create',
  },
  {
    num: '05',
    title: 'Mobile-First\nDesign',
    description: 'Designed for your phone first. Fast on slow connections, installable as a progressive web app.',
    detail: 'Install as app',
    accent: 'Go',
  },
  {
    num: '06',
    title: 'Secure &\nPrivate',
    description: 'Your data is protected with enterprise-grade security. Control who sees your work with privacy settings.',
    detail: 'Role-based access',
    accent: 'Trust',
  },
]

function FeatureRow({ feature, index }: { feature: typeof features[0]; index: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const isEven = index % 2 === 0

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      className="group"
    >
      {/* Mobile: simple stacked layout  |  Tablet+: 12-col grid with alternating alignment */}
      <div className={`flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 md:gap-6 items-start py-7 sm:py-10 md:py-16 border-t border-border/60 ${isEven ? '' : 'md:text-right'}`}>
        {/* Number column */}
        <div className={`sm:col-span-3 md:col-span-2 ${isEven ? '' : 'md:order-last'}`}>
          <span className="text-4xl sm:text-5xl md:text-7xl font-bold text-muted-foreground/20 group-hover:text-muted-foreground/30 transition-colors duration-500 select-none tabular-nums">
            {feature.num}
          </span>
        </div>

        {/* Title column */}
        <div className={`sm:col-span-9 md:col-span-4 ${isEven ? '' : 'md:order-2'}`}>
          <h3 className="text-xl sm:text-2xl md:text-4xl font-bold text-foreground leading-[1.1] tracking-tight whitespace-pre-line group-hover:text-brand-50 transition-colors duration-300">
            {feature.title}
          </h3>
          {/* Accent word */}
          <span className="inline-block mt-2 sm:mt-3 text-xs font-semibold tracking-[0.25em] uppercase text-brand-purple-400 dark:text-brand-400/60 group-hover:text-brand-purple-500 dark:group-hover:text-brand-400 transition-colors duration-300">
            {feature.accent}
          </span>
        </div>

        {/* Description column */}
        <div className={`sm:col-span-12 md:col-span-6 mt-1 sm:mt-2 md:mt-0 ${isEven ? '' : 'md:order-1 md:text-left'}`}>
          <p className="text-muted-foreground leading-relaxed text-sm sm:text-base max-w-md">
            {feature.description}
          </p>
          {/* Detail tag */}
          <div className="mt-3 sm:mt-4 inline-flex items-center gap-2">
            <span className="w-5 h-px bg-brand-500/50" />
            <span className="text-xs font-medium text-brand-purple-500/70 dark:text-brand-400/70 tracking-wide">
              {feature.detail}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function FeaturesSection() {
  return (
    <section className="relative py-16 sm:py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section header — editorial, left-aligned */}
        <div className="mb-4 md:mb-8">
          <p className="text-brand-purple-600 dark:text-brand-400 text-xs sm:text-sm font-medium tracking-widest uppercase mb-2 sm:mb-3">
            Features
          </p>
          <BlurText
            text="Built different. Built for you."
            className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight max-w-xl"
            delay={100}
            animateBy="words"
            direction="bottom"
          />
        </div>

        {/* Feature rows */}
        <div>
          {features.map((feature, index) => (
            <FeatureRow key={feature.num} feature={feature} index={index} />
          ))}
          {/* Bottom border */}
          <div className="border-t border-border/60" />
        </div>
      </div>
    </section>
  )
}
