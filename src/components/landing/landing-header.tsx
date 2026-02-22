'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { useLandingAuth } from './landing-auth-context'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const StaggeredMenu = dynamic(() => import('@/components/StaggeredMenu'), { ssr: false })

const ease = [0.23, 1, 0.32, 1] as const

export function LandingHeader() {
  const { isLoaded, isSignedIn, isCheckingProfile, profile, isOnboarded } = useLandingAuth()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  // Build dynamic mobile menu items based on auth state
  const mobileMenuItems = useMemo(() => {
    const base = [
      { label: 'Features', link: '#features' },
      { label: 'Portfolios', link: '/portfolios' },
      { label: 'Opportunities', link: '/opportunities' },
    ]
    if (!isLoaded) return base
    if (isSignedIn) {
      if (isOnboarded && profile?.role) {
        base.push({ label: 'Dashboard', link: getRoleBasedDashboard(profile.role) })
      } else {
        base.push({ label: 'Complete Setup', link: '/onboarding' })
      }
    } else {
      base.push({ label: 'Sign In', link: '/sign-in' })
      base.push({ label: 'Get Started', link: '/sign-up' })
    }
    return base
  }, [isLoaded, isSignedIn, isOnboarded, profile?.role])

  // Track scroll for sticky header effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleDashboardClick = () => {
    if (isOnboarded && profile?.role) {
      router.push(getRoleBasedDashboard(profile.role))
    } else {
      router.push('/onboarding')
    }
  }

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Portfolios', href: '/portfolios' },
    { label: 'Opportunities', href: '/opportunities' },
  ]

  return (
    <>
      <motion.nav
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b',
          scrolled
            ? 'bg-background/80 backdrop-blur-xl border-border/50 shadow-lg shadow-black/5'
            : 'bg-transparent border-transparent'
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* ── Logo ── */}
          <Link href="/" className="relative group flex items-center">
            <Image
              src="/branding/logo-horizontal-dark.svg"
              alt="Creatuno"
              width={130}
              height={18}
              className="h-5 w-auto dark:hidden"
              priority
            />
            <Image
              src="/branding/logo-horizontal-bright.svg"
              alt="Creatuno"
              width={130}
              height={18}
              className="h-5 w-auto hidden dark:block"
              priority
            />
          </Link>

          {/* ── Desktop Nav Links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Desktop Auth Buttons ── */}
          <div className="hidden md:flex items-center gap-3">
            {!isLoaded ? (
              <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : isSignedIn ? (
              <>
                {isCheckingProfile ? (
                  <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
                      onClick={handleDashboardClick}
                    >
                      {isOnboarded ? 'Dashboard' : 'Complete Setup'}
                      <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1.5" />
                    </Button>
                  </motion.div>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                    <Link href="/sign-up">Get Started</Link>
                  </Button>
                </motion.div>
              </>
            )}
          </div>

          {/* Spacer for mobile — StaggeredMenu renders its own toggle */}
          <span className="md:hidden w-10" />
        </div>
      </motion.nav>

      {/* ── Mobile StaggeredMenu (full-screen GSAP panel) ── */}
      <div className="md:hidden">
        <StaggeredMenu
          position="right"
          isFixed
          colors={['#7E5DA7', '#FEC714']}
          accentColor="#FEC714"
          menuButtonColor="currentColor"
          openMenuButtonColor="#FEC714"
          displaySocials={false}
          displayItemNumbering={true}
          className="!z-[60]"
          items={mobileMenuItems}
        />
      </div>

      {/* Spacer for fixed nav */}
      <div className="h-16" />
    </>
  )
}
