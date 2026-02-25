'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Home01Icon,
  Briefcase01Icon,
  Message01Icon,
  FolderOpenIcon,
  UserIcon,
  UserGroupIcon,
  AddCircleIcon,
  CheckListIcon,
  Compass01Icon,
  SparklesIcon,
  PackageIcon,
} from '@hugeicons/core-free-icons'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/providers/user-session-provider'
import { useTranslation } from '@/lib/i18n/context'

const HIDE_DELAY = 10_000 // 10 seconds of inactivity

interface NavItem {
  labelKey: string
  href: string
  icon: typeof Home01Icon
}

const creativeNav: NavItem[] = [
  { labelKey: 'nav.home', href: '/dashboard', icon: Home01Icon },
  { labelKey: 'nav.portfolios', href: '/dashboard/portfolios', icon: FolderOpenIcon },
  { labelKey: 'nav.opportunities', href: '/opportunities', icon: Briefcase01Icon },
  { labelKey: 'nav.feed', href: '/feed', icon: Message01Icon },
  { labelKey: 'nav.profile', href: '/profile', icon: UserIcon },
]

const mentorNav: NavItem[] = [
  { labelKey: 'nav.home', href: '/dashboard/mentor', icon: Home01Icon },
  { labelKey: 'nav.scoutTalents', href: '/mentorship/scout', icon: Compass01Icon },
  { labelKey: 'nav.mentees', href: '/mentorship', icon: UserGroupIcon },
  { labelKey: 'nav.feed', href: '/feed', icon: Message01Icon },
  { labelKey: 'nav.profile', href: '/profile', icon: UserIcon },
]

const employerNav: NavItem[] = [
  { labelKey: 'nav.home', href: '/dashboard/employer', icon: Home01Icon },
  { labelKey: 'nav.post', href: '/opportunities/create', icon: AddCircleIcon },
  { labelKey: 'nav.applications', href: '/dashboard/employer/applications', icon: CheckListIcon },
  { labelKey: 'nav.deliverables', href: '/dashboard/employer/deliverables', icon: PackageIcon },
  { labelKey: 'nav.profile', href: '/profile', icon: UserIcon },
]

const investorNav: NavItem[] = [
  { labelKey: 'nav.home', href: '/dashboard/investor', icon: Home01Icon },
  { labelKey: 'nav.pitchStage', href: '/pitch-stage', icon: SparklesIcon },
  { labelKey: 'nav.discover', href: '/portfolios', icon: Compass01Icon },
  { labelKey: 'nav.feed', href: '/feed', icon: Message01Icon },
  { labelKey: 'nav.profile', href: '/profile', icon: UserIcon },
]

function getNavForRole(role: string | null): NavItem[] {
  switch (role) {
    case 'mentor':
      return mentorNav
    case 'employer':
      return employerNav
    case 'investor':
      return investorNav
    default:
      return creativeNav
  }
}

export function MobileNav() {
  const pathname = usePathname()
  const { role } = useSession()
  const { t } = useTranslation()
  const navItems = getNavForRole(role)

  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY)
  }, [])

  useEffect(() => {
    // Start the initial hide timer
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY)

    const events = ['touchstart', 'mousedown', 'scroll', 'mousemove', 'keydown'] as const
    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((e) => document.removeEventListener(e, resetTimer))
    }
  }, [resetTimer])

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around h-[68px] px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-all duration-200',
                    isActive
                      ? 'text-brand-purple-600 dark:text-brand-400'
                      : 'text-muted-foreground active:text-foreground'
                  )}
                >
                  {/* Glow background for active item */}
                  {isActive && (
                    <motion.div
                      layoutId="mobileNavGlow"
                      className="absolute inset-x-2 inset-y-1 rounded-xl bg-brand-500/8"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <HugeiconsIcon
                    icon={item.icon}
                    className={cn(
                      'relative w-5 h-5 transition-transform duration-200',
                      isActive && 'scale-110'
                    )}
                  />

                  <span className="relative truncate">{t(item.labelKey)}</span>

                  {/* Active dot indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="mobileNavDot"
                      className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
