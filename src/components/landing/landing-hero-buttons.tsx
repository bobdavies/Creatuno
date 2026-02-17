'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Loading02Icon, PlayIcon } from "@hugeicons/core-free-icons";
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { useLandingAuth } from './landing-auth-context'

export function LandingHeroButtons() {
  const { isLoaded, isSignedIn, isCheckingProfile, profile, isOnboarded } = useLandingAuth()
  const router = useRouter()

  const isLoadingState = !isLoaded || isCheckingProfile

  const handlePrimaryClick = () => {
    if (isOnboarded && profile?.role) {
      router.push(getRoleBasedDashboard(profile.role))
    } else if (isSignedIn) {
      router.push('/onboarding')
    } else {
      router.push('/sign-up')
    }
  }

  const getPrimaryText = () => {
    if (isLoadingState) return 'Loading...'
    if (isSignedIn && isOnboarded) return 'Go to Dashboard'
    if (isSignedIn && !isOnboarded) return 'Complete Your Profile'
    return 'Create Your Portfolio'
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 w-full px-4 sm:px-0">
      {/* Primary CTA */}
      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
        <Button
          size="lg"
          className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-brand-dark text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all duration-300"
          onClick={handlePrimaryClick}
          disabled={isLoadingState}
        >
          {isLoadingState ? (
            <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin mr-2" />
          ) : null}
          {getPrimaryText()}
          {!isLoadingState && <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 w-5 h-5" />}
        </Button>
      </motion.div>

      {/* Secondary CTA */}
      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl transition-all duration-300"
          asChild
        >
          <Link href="/portfolios" className="flex items-center justify-center">
            <HugeiconsIcon icon={PlayIcon} className="mr-2 w-4 h-4" />
            Explore Portfolios
          </Link>
        </Button>
      </motion.div>
    </div>
  )
}
