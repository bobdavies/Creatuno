'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { useLandingAuth } from './landing-auth-context'
import BlurText from '@/components/BlurText'
import Cubes from '@/components/Cubes'

/*
 * CTA section redesigned to match the editorial / warm-brown
 * visual language of the catalog and how-it-works sections.
 * Split layout: large typographic left + warm brown accent right.
 * All logic, hooks, and auth state preserved exactly.
 */

export function LandingCTA() {
  const { isLoaded, isSignedIn, isCheckingProfile, profile, isOnboarded } = useLandingAuth()
  const router = useRouter()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const [liveStats, setLiveStats] = useState({ portfolios: 0, creatives: 0 })

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats')
        if (response.ok) {
          const data = await response.json()
          setLiveStats({ portfolios: data.portfolios, creatives: data.creatives })
        }
      } catch {
        // Silently fall back to 0
      }
    }
    fetchStats()
  }, [])

  const isLoadingState = !isLoaded || isCheckingProfile

  const handleClick = () => {
    if (isOnboarded && profile?.role) {
      router.push(getRoleBasedDashboard(profile.role))
    } else if (isSignedIn) {
      router.push('/onboarding')
    } else {
      router.push('/sign-up')
    }
  }

  const getButtonText = () => {
    if (isLoadingState) return 'Loading...'
    if (isSignedIn && isOnboarded) return 'Go to Dashboard'
    if (isSignedIn && !isOnboarded) return 'Complete Your Profile'
    return 'Start Building for Free'
  }

  const headline = isSignedIn && isOnboarded
    ? 'Your Creative Journey Continues'
    : 'Ready to stop being invisible?'

  const subtext = isSignedIn && isOnboarded
    ? 'Continue building your creative journey and discovering new opportunities.'
    : 'Thousands of creatives across Sierra Leone are already here. Build your portfolio, land real work, get mentored.'

  return (
    <section className="relative py-14 sm:py-20 md:py-28 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-xl sm:rounded-2xl overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-5">
            {/* Left — typographic content */}
            <div className="md:col-span-3 relative bg-card/80 p-6 sm:p-10 md:p-16 lg:p-20 flex flex-col justify-center">
              {/* Label */}
              <div className="flex items-center gap-3 mb-5 sm:mb-8">
                <span className="w-6 sm:w-8 h-px bg-brand-500/50" />
                <span className="text-xs font-medium text-brand-purple-500/70 dark:text-brand-400/70 tracking-widest uppercase">
                  {isSignedIn && isOnboarded ? 'Welcome Back' : 'Get Started'}
                </span>
              </div>

              {/* Headline */}
              <div className="mb-4 sm:mb-6">
                <BlurText
                  text={headline}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[1.08] tracking-tight"
                  delay={80}
                  animateBy="words"
                  direction="bottom"
                />
              </div>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base md:text-lg max-w-md mb-7 sm:mb-10">
                {subtext}
              </p>

              {/* CTA Button */}
              <div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-brand-dark text-base md:text-lg px-6 sm:px-8 py-5 h-auto rounded-xl shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 hover:shadow-brand-500/35 transition-all duration-300"
                    onClick={handleClick}
                    disabled={isLoadingState}
                  >
                    {isLoadingState ? (
                      <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin mr-2" />
                    ) : null}
                    {getButtonText()}
                    {!isLoadingState && <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 w-5 h-5" />}
                  </Button>
                </motion.div>

                {!isSignedIn && (
                  <p className="mt-4 sm:mt-5 text-xs text-muted-foreground/60">
                    Free. No strings.
                  </p>
                )}
              </div>
            </div>

            {/* Right — Cubes animation panel */}
            <div className="md:col-span-2 relative bg-[#1B0F28] flex flex-col justify-between min-h-[200px] sm:min-h-[240px] md:min-h-0 overflow-hidden">
              {/* Cubes animation background */}
              <div className="absolute inset-0 z-0">
                <Cubes
                  gridSize={8}
                  maxAngle={40}
                  radius={3}
                  borderStyle="1px solid #FEC714"
                  faceColor="#1B0F28"
                  rippleColor="#FEC714"
                  autoAnimate
                  rippleOnClick
                  shadow={false}
                />
              </div>

              {/* Bottom stats — side-by-side on mobile, stacked on tablet+ */}
              <div className="relative z-10 mt-auto m-4 sm:m-6 md:m-8 p-4 sm:p-6 md:p-8 rounded-xl bg-[#1B0F28]/80 backdrop-blur-sm border border-white/[0.06] flex flex-row md:flex-col gap-6 md:gap-0 md:space-y-4">
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                    {liveStats.portfolios > 0 ? liveStats.portfolios.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs sm:text-sm text-brand-purple-500/70 dark:text-brand-400/70 mt-1">Portfolios created</div>
                </div>
                <div className="hidden md:block w-12 h-px bg-white/10" />
                <div className="md:hidden w-px h-10 bg-white/10 self-center" />
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                    {liveStats.creatives > 0 ? liveStats.creatives.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs sm:text-sm text-brand-purple-500/70 dark:text-brand-400/70 mt-1">Creative professionals</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
