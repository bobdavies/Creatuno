'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react'
import { LandingHeroButtons } from './landing-hero-buttons'
import BlurText from '@/components/BlurText'
import RotatingText from '@/components/RotatingText'

const Aurora = dynamic(() => import('@/components/Aurora'), { ssr: false })

/* ------------------------------------------------------------------ */
/*  Image sets & labels for each card position                        */
/* ------------------------------------------------------------------ */
const CARD_DATA = [
  {
    images: ['/hero/architect.webp', '/hero/singer.webp'],
    labels: ['Architecture', 'Vocalist'],
    alts: ['Architect reviewing blueprints', 'Singer performing on stage'],
  },
  {
    images: ['/hero/music-producer.webp', '/hero/performer.webp'],
    labels: ['Music', 'Performer'],
    alts: ['Music producer with MIDI controller', 'Performer on stage'],
  },
  {
    images: ['/hero/photographer.webp', '/hero/photographer-2.webp'],
    labels: ['Photography', 'Photography'],
    alts: ['Photographer with camera', 'Photographer with professional gear'],
  },
  {
    images: [
      '/hero/fashion-designer.webp',
      '/hero/filmmaker.webp',
      '/hero/seamstress.webp',
      '/hero/vocalist.webp',
      '/hero/dancer.webp',
      '/hero/street-photographer.webp',
      '/hero/tailor.webp',
      '/hero/vocalist-2.webp',
      '/hero/potter.webp',
    ],
    labels: [
      'Fashion',
      'Film',
      'Fashion',
      'Vocalist',
      'Dance',
      'Street Photo',
      'Fashion',
      'Vocalist',
      'Pottery',
    ],
    alts: [
      'Fashion designer with fabrics',
      'Filmmaker with clapperboard on set',
      'Seamstress sewing Sierra Leone print fabric',
      'Singer with vintage microphone',
      'Dancer with headphones',
      'Street photographer in Sierra Leone market',
      'Tailor at sewing machine',
      'Singer performing close-up',
      'Potter sculpting on wheel',
    ],
  },
]

/* Spring config for the flip transition */
const FLIP_SPRING = { type: 'spring' as const, damping: 30, stiffness: 400 }

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  /* ---- Flip state: tracks current visible image index per card ---- */
  const [cardImageIndices, setCardImageIndices] = useState([0, 0, 0, 0])

  useEffect(() => {
    let nextCard = 0
    const interval = setInterval(() => {
      setCardImageIndices(prev => {
        const next = [...prev]
        next[nextCard] = (prev[nextCard] + 1) % CARD_DATA[nextCard].images.length
        return next
      })
      nextCard = (nextCard + 1) % 4
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section
      ref={containerRef}
      className="relative h-[100dvh] flex items-center justify-center overflow-hidden"
    >
      {/* Aurora background with brand colors */}
      <div className="absolute inset-0 z-0">
        <Aurora
          colorStops={['#7E5DA7', '#FEC714', '#7E5DA7']}
          amplitude={1.2}
          blend={0.6}
          speed={0.4}
        />
      </div>

      {/* Subtle dark overlay to ensure text readability */}
      <div className="absolute inset-0 z-[1] bg-background/60" />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* ===== Left Column: Text Content ===== */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-brand-purple-500/10 border border-brand-500/20 mb-5 sm:mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-brand-500" />
              <span className="text-xs sm:text-sm text-brand-purple-600 dark:text-brand-300 font-medium">
                Built for Creatives in Sierra Leone
              </span>
            </motion.div>

            {/* Headline: static "Where" + rotating phrases */}
            <div className="mb-5 sm:mb-7 flex flex-wrap items-baseline justify-center lg:justify-start gap-x-[0.3em]">
              <BlurText
                text="Where"
                className="text-3xl sm:text-4xl md:text-6xl lg:text-6xl xl:text-7xl font-black text-foreground leading-[1.08] tracking-tight justify-center lg:justify-start"
                delay={80}
                animateBy="words"
                direction="bottom"
                stepDuration={0.4}
              />
              <RotatingText
                texts={[
                  'Creatives Get Discovered',
                  'Mentors Find Their Mentees',
                  'Employers Find Top Talent',
                  'Investors Back Bold Ideas',
                ]}
                mainClassName="text-3xl sm:text-4xl md:text-6xl lg:text-6xl xl:text-7xl font-black text-foreground leading-[1.08] tracking-tight justify-center lg:justify-start overflow-hidden"
                staggerFrom="first"
                staggerDuration={0.025}
                splitBy="characters"
                rotationInterval={3000}
                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-120%', opacity: 0 }}
              />
            </div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-xs sm:text-sm md:text-base text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-7 sm:mb-9 leading-relaxed px-2 sm:px-0"
            >
              Build portfolios that work offline. Find real opportunities.
              Get mentored by people who&apos;ve been there. Stop being invisible.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
            >
              <LandingHeroButtons />
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="mt-7 sm:mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free. No strings.
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Works Offline
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-brand-purple-600 dark:text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Mobile-First
              </span>
            </motion.div>
          </div>

          {/* ===== Mobile/Tablet Image Strip (below lg) ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="lg:hidden mt-4 -mx-4 sm:-mx-6"
            aria-hidden="true"
          >
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-6 pb-2 snap-x snap-mandatory">
              {[
                { src: CARD_DATA[0].images[0], label: CARD_DATA[0].labels[0] },
                { src: CARD_DATA[1].images[0], label: CARD_DATA[1].labels[0] },
                { src: CARD_DATA[2].images[0], label: CARD_DATA[2].labels[0] },
                { src: CARD_DATA[3].images[0], label: CARD_DATA[3].labels[0] },
              ].map((img, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 w-36 sm:w-44 h-48 sm:h-56 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/10 snap-center"
                >
                  <Image
                    src={img.src}
                    alt={img.label}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 176px, 144px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <span className="absolute bottom-2 left-2 right-2 text-white text-[10px] sm:text-xs font-medium px-2 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 truncate text-center">
                    {img.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ===== Right Column: Photo Collage (lg+) ===== */}
          <div className="hidden lg:block relative" aria-hidden="true">
            {/* Decorative overlay (glow, dashed ring, floating dots) */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Pulsing glow ring behind collage */}
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.12, 0.22, 0.12] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-[-10%] rounded-full blur-3xl"
                style={{
                  background: 'radial-gradient(circle, rgba(126,93,167,0.2) 0%, rgba(254,199,20,0.1) 50%, transparent 70%)',
                }}
              />
              {/* Rotating dashed ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute top-[5%] right-[-5%] w-28 h-28 rounded-full border-2 border-dashed border-brand-purple-500/20"
              />
              {/* Floating dots */}
              <motion.div
                animate={{ y: [0, -12, 0], x: [0, 4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-3 right-[30%] w-5 h-5 rounded-full bg-brand-purple-500/30 backdrop-blur-sm"
              />
              <motion.div
                animate={{ y: [0, 10, 0], x: [0, -3, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-[48%] -right-2 w-4 h-4 rounded-full bg-brand-500/40 backdrop-blur-sm"
              />
              <motion.div
                animate={{ y: [0, -8, 0], x: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-[18%] -left-3 w-4 h-4 rounded-full bg-brand-400/30 backdrop-blur-sm"
              />
              <motion.div
                animate={{ y: [0, 8, 0], x: [0, -4, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute top-[22%] left-[52%] w-3 h-3 rounded-full bg-brand-purple-400/30 backdrop-blur-sm"
              />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute bottom-[-2%] right-[42%] w-3 h-3 rounded-full bg-brand-500/30 backdrop-blur-sm"
              />
            </div>

            {/* Grid layout */}
            <div
              className="relative grid grid-cols-3 grid-rows-3 gap-3 h-[420px] xl:h-[480px]"
              style={{ perspective: '1200px' }}
            >
              {/* ---- Card 1: Architecture / Singer (large, 2x2) ---- */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.85, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.3 }}
                className="col-span-2 row-span-2 h-full"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-full h-full"
                >
                  <motion.div
                    whileHover={{ scale: 1.03, rotate: -0.5 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl shadow-brand-purple-500/15 ring-1 ring-white/10 cursor-pointer group hover:shadow-2xl hover:shadow-brand-purple-500/25"
                  >
                    {/* AnimatePresence flip */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`card0-${cardImageIndices[0]}`}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={FLIP_SPRING}
                        className="absolute inset-0"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <Image
                          src={CARD_DATA[0].images[cardImageIndices[0]]}
                          alt={CARD_DATA[0].alts[cardImageIndices[0]]}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          sizes="(min-width: 1024px) 30vw, 0px"
                          priority
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 z-[2] bg-gradient-to-t from-brand-purple-500/30 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    {/* Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.2 }}
                      className="absolute bottom-3 left-3 right-3 z-[3] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-purple-400 animate-pulse" />
                      <span className="text-white text-xs font-medium">
                        {CARD_DATA[0].labels[cardImageIndices[0]]}
                      </span>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* ---- Card 2: Music / Performer (small, 1x1 top-right) ---- */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.85, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.5 }}
                className="col-span-1 row-span-1 h-full"
              >
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="w-full h-full"
                >
                  <motion.div
                    whileHover={{ scale: 1.04, rotate: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl shadow-brand-purple-400/15 ring-1 ring-white/10 cursor-pointer group hover:shadow-2xl hover:shadow-brand-purple-400/25"
                  >
                    {/* AnimatePresence flip */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`card1-${cardImageIndices[1]}`}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={FLIP_SPRING}
                        className="absolute inset-0"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <Image
                          src={CARD_DATA[1].images[cardImageIndices[1]]}
                          alt={CARD_DATA[1].alts[cardImageIndices[1]]}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          sizes="(min-width: 1024px) 15vw, 0px"
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 z-[2] bg-gradient-to-t from-brand-purple-500/30 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    {/* Play icon */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', delay: 1.4 }}
                      className="absolute top-2 right-2 z-[3] w-7 h-7 rounded-full bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center"
                    >
                      <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </motion.div>
                    {/* Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.4 }}
                      className="absolute bottom-2 left-2 right-2 z-[3] flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-purple-400 animate-pulse" />
                      <span className="text-white text-[10px] font-medium">
                        {CARD_DATA[1].labels[cardImageIndices[1]]}
                      </span>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* ---- Card 3: Photography (small, 1x1 middle-right) ---- */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.85, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.7 }}
                className="col-span-1 row-span-1 h-full"
              >
                <motion.div
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                  className="w-full h-full"
                >
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 1.5 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl shadow-brand-500/20 ring-1 ring-white/10 cursor-pointer group hover:shadow-2xl hover:shadow-brand-500/30"
                  >
                    {/* AnimatePresence flip */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`card2-${cardImageIndices[2]}`}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={FLIP_SPRING}
                        className="absolute inset-0"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <Image
                          src={CARD_DATA[2].images[cardImageIndices[2]]}
                          alt={CARD_DATA[2].alts[cardImageIndices[2]]}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          sizes="(min-width: 1024px) 15vw, 0px"
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 z-[2] bg-gradient-to-t from-brand-500/30 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    {/* Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.6 }}
                      className="absolute bottom-2 left-2 right-2 z-[3] flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-md border border-white/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                      <span className="text-white text-[10px] font-medium">
                        {CARD_DATA[2].labels[cardImageIndices[2]]}
                      </span>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* ---- Card 4: Multi-image carousel (wide, 2x1 bottom) ---- */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.85, rotateX: 8 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 80, delay: 0.9 }}
                className="col-span-2 row-span-1 h-full"
              >
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="w-full h-full"
                >
                  <motion.div
                    whileHover={{ scale: 1.03, rotate: -0.5 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl shadow-brand-400/15 ring-1 ring-white/10 cursor-pointer group hover:shadow-2xl hover:shadow-brand-400/25"
                  >
                    {/* AnimatePresence flip — cycles through 9 images */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`card3-${cardImageIndices[3]}`}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={FLIP_SPRING}
                        className="absolute inset-0"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <Image
                          src={CARD_DATA[3].images[cardImageIndices[3]]}
                          alt={CARD_DATA[3].alts[cardImageIndices[3]]}
                          fill
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          sizes="(min-width: 1024px) 30vw, 0px"
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 z-[2] bg-gradient-to-t from-brand-500/30 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    {/* Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.8 }}
                      className="absolute bottom-3 left-3 right-3 z-[3] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                      <span className="text-white text-xs font-medium">
                        {CARD_DATA[3].labels[cardImageIndices[3]]}
                      </span>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Empty cell (bottom-right, 1x1) - filled by grid flow */}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
