'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { motion, useInView } from 'framer-motion'
import { useRef, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
/*
 * Dynamic bento-grid catalog.
 * Fetches real portfolio images from the API, detects orientation
 * (landscape vs portrait), and places them in matching grid cells.
 * Category counts are computed live from portfolio owner skills.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface PortfolioData {
  id: string
  title: string
  firstImage: string | null
  user: {
    fullName: string
    skills: string[]
  }
}

interface ClassifiedPortfolio {
  id: string
  title: string
  firstImage: string
  fullName: string
  orientation: 'landscape' | 'portrait'
}

// ─── Categories ──────────────────────────────────────────────────────────────

const categories = [
  { name: 'Graphic Design', key: 'graphic-design', matchLabel: 'Graphic Design' },
  { name: 'Photography', key: 'photography', matchLabel: 'Photography' },
  { name: 'Fashion Art', key: 'fashion', matchLabel: 'Fashion' },
  { name: 'Music & Beats', key: 'music', matchLabel: 'Music' },
  { name: 'Web & UI Design', key: 'ui-ux', matchLabel: 'UI' },
  { name: 'Illustration', key: 'illustration', matchLabel: 'Illustration' },
]

// ─── Gradient fallbacks for cells without real images ─────────────────────────

const fallbackGradients = [
  'bg-gradient-to-br from-brand-dark via-brand-dark to-brand-dark',
  'bg-gradient-to-tr from-muted via-muted to-muted-foreground/20',
  'bg-gradient-to-b from-brand-dark via-muted to-brand-dark',
  'bg-gradient-to-br from-muted via-brand-dark to-muted',
  'bg-gradient-to-bl from-brand-dark via-muted to-brand-dark',
  'bg-gradient-to-t from-muted via-muted-foreground/30 to-muted',
]

// ─── Image orientation helper ────────────────────────────────────────────────

function detectOrientation(src: string): Promise<'landscape' | 'portrait'> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve(img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait')
    }
    img.onerror = () => resolve('landscape') // default fallback
    img.src = src
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LabelCard({
  name,
  count,
  categoryKey,
  index,
}: {
  name: string
  count: number
  categoryKey: string
  index: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.23, 1, 0.32, 1] }}
      className="group relative h-full"
    >
      <Link href={`/portfolios?category=${categoryKey}`} className="block h-full">
        <div className="relative h-full rounded-xl sm:rounded-2xl bg-[#261838] overflow-hidden flex flex-col justify-end p-4 sm:p-5 md:p-6 transition-all duration-300 hover:bg-[#322148] hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-purple-500/10">
          <h3 className="text-white text-base sm:text-lg md:text-xl font-semibold leading-tight">
            {name}
          </h3>
          <span className="text-brand-purple-600 dark:text-brand-400 text-xs sm:text-sm font-medium mt-1">
            {count} {count === 1 ? 'Portfolio' : 'Portfolios'}
          </span>

          {/* Hover arrow */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/0 group-hover:bg-white/10 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0">
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function PhotoCard({
  portfolio,
  fallbackGradient,
  index,
}: {
  portfolio?: ClassifiedPortfolio
  fallbackGradient: string
  index: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  if (!portfolio) {
    // Gradient fallback — no portfolio data
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.5, delay: index * 0.07, ease: [0.23, 1, 0.32, 1] }}
        className="group relative h-full"
      >
        <div className={`relative h-full rounded-xl sm:rounded-2xl overflow-hidden ${fallbackGradient}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.23, 1, 0.32, 1] }}
      className="group relative h-full"
    >
      <Link href={`/portfolio/view/${portfolio.id}`} className="block h-full">
        <div className="relative h-full rounded-xl sm:rounded-2xl overflow-hidden bg-muted">
          {/* Real portfolio image */}
          <img
            src={portfolio.firstImage}
            alt={portfolio.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03] group-hover:rotate-[0.5deg]"
            loading="lazy"
          />
          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {/* Hover tint */}
          <div className="absolute inset-0 bg-brand-500/0 group-hover:bg-brand-500/5 transition-colors duration-500" />

          {/* Portfolio info — always visible at bottom */}
          <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4">
            <p className="text-white text-xs sm:text-sm font-semibold leading-tight line-clamp-1">
              {portfolio.title}
            </p>
            <p className="text-white/60 text-[10px] sm:text-xs mt-0.5 line-clamp-1">
              by {portfolio.fullName}
            </p>
          </div>

          {/* Hover arrow */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0">
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/80" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="h-full rounded-xl sm:rounded-2xl bg-muted/50 animate-pulse"
    />
  )
}

// ─── Main Section ────────────────────────────────────────────────────────────

export function CatalogSection() {
  const [portfolios, setPortfolios] = useState<PortfolioData[]>([])
  const [classified, setClassified] = useState<ClassifiedPortfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch portfolios on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/portfolios/public')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setPortfolios(data.portfolios || [])
      } catch {
        console.error('Failed to load explore portfolios')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Detect orientation for portfolios that have images
  useEffect(() => {
    if (portfolios.length === 0) return

    const withImages = portfolios.filter((p) => p.firstImage)
    // Only classify up to 12 to limit network load
    const toClassify = withImages.slice(0, 12)

    async function classify() {
      const results = await Promise.all(
        toClassify.map(async (p) => {
          const orientation = await detectOrientation(p.firstImage!)
          return {
            id: p.id,
            title: p.title,
            firstImage: p.firstImage!,
            fullName: p.user.fullName,
            orientation,
          } satisfies ClassifiedPortfolio
        })
      )
      setClassified(results)
    }

    classify()
  }, [portfolios])

  // Compute category counts from portfolio owner skills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach((cat) => {
      counts[cat.key] = portfolios.filter((p) =>
        p.user.skills.some((s) =>
          s.toLowerCase().includes(cat.matchLabel.toLowerCase())
        )
      ).length
    })
    return counts
  }, [portfolios])

  // Split classified portfolios into portrait and landscape arrays
  const { portraitQueue, landscapeQueue } = useMemo(() => {
    const portrait: ClassifiedPortfolio[] = []
    const landscape: ClassifiedPortfolio[] = []
    classified.forEach((p) => {
      if (p.orientation === 'portrait') portrait.push(p)
      else landscape.push(p)
    })
    return { portraitQueue: portrait, landscapeQueue: landscape }
  }, [classified])

  // Assign portfolios to the 6 photo grid slots
  // Slots: 4 tall (row-span-2) prefer portrait, 2 standard (row-span-1) prefer landscape
  const gridPhotos = useMemo(() => {
    const pq = [...portraitQueue]
    const lq = [...landscapeQueue]

    function pickPortrait(): ClassifiedPortfolio | undefined {
      return pq.shift() || lq.shift()
    }
    function pickLandscape(): ClassifiedPortfolio | undefined {
      return lq.shift() || pq.shift()
    }

    // Grid order: [tall, tall, landscape, landscape, tall, tall]
    return [
      pickPortrait(),   // slot 0 — tall
      pickPortrait(),   // slot 1 — tall
      pickLandscape(),  // slot 2 — standard
      pickLandscape(),  // slot 3 — standard
      pickPortrait(),   // slot 4 — tall
      pickPortrait(),   // slot 5 — tall
    ]
  }, [portraitQueue, landscapeQueue])

  return (
    <section className="relative py-14 sm:py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section intro */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-8 sm:mb-12 md:mb-16"
        >
          <div>
            <p className="text-brand-purple-600 dark:text-brand-400 text-xs sm:text-sm font-medium tracking-widest uppercase mb-2 sm:mb-3">
              Explore
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground leading-tight">
              A World of<br />Creative Talent
            </h2>
          </div>
          <Link
            href="/portfolios"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors group/link"
          >
            Browse all portfolios
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
          </Link>
        </motion.div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 auto-rows-[120px] sm:auto-rows-[140px] md:auto-rows-[180px]">

          {isLoading ? (
            /* Loading skeleton */
            <>
              <div className="row-span-1 sm:row-span-2"><SkeletonCard index={0} /></div>
              <div className="row-span-1"><SkeletonCard index={1} /></div>
              <div className="row-span-1 sm:row-span-2"><SkeletonCard index={2} /></div>
              <div className="row-span-1"><SkeletonCard index={3} /></div>
              <div className="row-span-1"><SkeletonCard index={4} /></div>
              <div className="row-span-1"><SkeletonCard index={5} /></div>
              <div className="row-span-1"><SkeletonCard index={6} /></div>
              <div className="row-span-1 sm:row-span-2"><SkeletonCard index={7} /></div>
              <div className="row-span-1"><SkeletonCard index={8} /></div>
              <div className="row-span-1 sm:row-span-2"><SkeletonCard index={9} /></div>
              <div className="row-span-1"><SkeletonCard index={10} /></div>
              <div className="row-span-1"><SkeletonCard index={11} /></div>
            </>
          ) : (
            <>
              {/* Row 1 */}
              {/* Photo — tall (portrait preferred) */}
              <div className="row-span-1 sm:row-span-2">
                <PhotoCard portfolio={gridPhotos[0]} fallbackGradient={fallbackGradients[0]} index={0} />
              </div>
              {/* Label — Graphic Design */}
              <div className="row-span-1">
                <LabelCard name={categories[0].name} count={categoryCounts[categories[0].key] || 0} categoryKey={categories[0].key} index={1} />
              </div>
              {/* Photo — tall (portrait preferred) */}
              <div className="row-span-1 sm:row-span-2">
                <PhotoCard portfolio={gridPhotos[1]} fallbackGradient={fallbackGradients[2]} index={2} />
              </div>
              {/* Label — Music & Beats */}
              <div className="row-span-1">
                <LabelCard name={categories[3].name} count={categoryCounts[categories[3].key] || 0} categoryKey={categories[3].key} index={3} />
              </div>

              {/* Row 2 */}
              {/* Photo — standard (landscape preferred) */}
              <div className="row-span-1">
                <PhotoCard portfolio={gridPhotos[2]} fallbackGradient={fallbackGradients[1]} index={4} />
              </div>
              {/* Photo — standard (landscape preferred) */}
              <div className="row-span-1">
                <PhotoCard portfolio={gridPhotos[3]} fallbackGradient={fallbackGradients[3]} index={5} />
              </div>

              {/* Row 3 */}
              {/* Label — Photography */}
              <div className="row-span-1">
                <LabelCard name={categories[1].name} count={categoryCounts[categories[1].key] || 0} categoryKey={categories[1].key} index={6} />
              </div>
              {/* Photo — tall (portrait preferred) */}
              <div className="row-span-1 sm:row-span-2">
                <PhotoCard portfolio={gridPhotos[4]} fallbackGradient={fallbackGradients[4]} index={7} />
              </div>
              {/* Label — Fashion Art */}
              <div className="row-span-1">
                <LabelCard name={categories[2].name} count={categoryCounts[categories[2].key] || 0} categoryKey={categories[2].key} index={8} />
              </div>
              {/* Photo — tall (portrait preferred) */}
              <div className="row-span-1 sm:row-span-2">
                <PhotoCard portfolio={gridPhotos[5]} fallbackGradient={fallbackGradients[5]} index={9} />
              </div>

              {/* Row 4 */}
              {/* Label — Web & UI Design */}
              <div className="row-span-1">
                <LabelCard name={categories[4].name} count={categoryCounts[categories[4].key] || 0} categoryKey={categories[4].key} index={10} />
              </div>
              {/* Label — Illustration */}
              <div className="row-span-1">
                <LabelCard name={categories[5].name} count={categoryCounts[categories[5].key] || 0} categoryKey={categories[5].key} index={11} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
