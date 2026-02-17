'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import BlurText from '@/components/BlurText'

/*
 * Editorial "How It Works" section.
 * Matches the typography-led style of the Features section:
 * no icons, oversized step numbers, horizontal card layout
 * with warm brown accent panels. Each step is a full-bleed
 * card with a large number + text, staggered on scroll.
 */

const steps = [
  {
    num: '01',
    title: 'Sign Up in Seconds',
    description: 'Create your free account and tell us about your creative skills and goals during a quick onboarding.',
    keyword: 'Join',
  },
  {
    num: '02',
    title: 'Build Your Portfolio',
    description: 'Add projects, images, and videos to showcase your best work. It works offline so nothing stops your creativity.',
    keyword: 'Create',
  },
  {
    num: '03',
    title: 'Get Discovered',
    description: 'Your portfolio goes live with a shareable link. Employers, investors, and collaborators can find you.',
    keyword: 'Share',
  },
  {
    num: '04',
    title: 'Grow Your Career',
    description: 'Apply to opportunities, connect with mentors, engage in the community, and take your career to the next level.',
    keyword: 'Thrive',
  },
]

function StepBlock({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const isEven = index % 2 === 0

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 44 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="group"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Number panel — warm brown */}
        <div className={`relative bg-[#261838] p-6 sm:p-8 md:p-12 flex flex-col justify-between min-h-[160px] sm:min-h-[200px] md:min-h-[280px] ${isEven ? '' : 'md:order-2'}`}>
          {/* Subtle texture */}
          <div className="absolute inset-0 opacity-[0.04] bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20baseFrequency%3D%220.8%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')] pointer-events-none" />

          {/* Large number */}
          <span className="text-[60px] sm:text-[80px] md:text-[120px] font-bold leading-none text-white/10 select-none">
            {step.num}
          </span>

          {/* Keyword */}
          <span className="text-brand-purple-600 dark:text-brand-400 text-xs font-semibold tracking-[0.3em] uppercase mt-auto">
            {step.keyword}
          </span>
        </div>

        {/* Content panel — dark */}
        <div className={`relative bg-card/80 p-6 sm:p-8 md:p-12 flex flex-col justify-center ${isEven ? '' : 'md:order-1'}`}>
          {/* Step label */}
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <span className="w-6 sm:w-8 h-px bg-brand-500/50" />
            <span className="text-xs font-medium text-brand-purple-500/70 dark:text-brand-400/70 tracking-widest uppercase">
              Step {step.num}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-tight mb-3 sm:mb-4 group-hover:text-brand-50 transition-colors duration-300">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed text-sm sm:text-base max-w-sm">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function HowItWorksSection() {
  return (
    <section className="relative py-16 sm:py-24 md:py-32">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-8 sm:mb-12 md:mb-16">
          <div>
            <p className="text-brand-purple-600 dark:text-brand-400 text-xs sm:text-sm font-medium tracking-widest uppercase mb-2 sm:mb-3">
              How It Works
            </p>
            <BlurText
              text="Simple as it should be"
              className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground leading-tight"
              delay={100}
              animateBy="words"
              direction="bottom"
            />
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xs leading-relaxed">
            Four steps to launch your creative career.
          </p>
        </div>

        {/* Step cards — stacked vertically with gap */}
        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          {steps.map((step, index) => (
            <StepBlock key={step.num} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
