'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Loading02Icon, Logout01Icon, Notification01Icon, Search01Icon, Settings01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useOfflineSync } from '@/hooks/use-offline-sync'
import { useSession } from '@/components/providers/user-session-provider'
import { useTranslation } from '@/lib/i18n/context'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const StaggeredMenu = dynamic(() => import('@/components/StaggeredMenu'), { ssr: false })

// ─── Role Helpers (unchanged logic) ─────────────────────────────────────────

function getRoleCTA(role: string | null, t: (key: string) => string): { label: string; href: string } {
  switch (role) {
    case 'employer':
      return { label: t('nav.postOpportunity'), href: '/opportunities/create' }
    case 'investor':
      return { label: t('nav.browsePortfolios'), href: '/portfolios' }
    case 'mentor':
      return { label: t('nav.manageMentees'), href: '/dashboard/mentor' }
    default:
      return { label: t('nav.newPortfolio'), href: '/dashboard/portfolios/new' }
  }
}

function getDesktopNavLinks(role: string | null, t: (key: string) => string) {
  const base = [
    { label: t('nav.dashboard'), href: getRoleBasedDashboard(role) },
  ]

  switch (role) {
    case 'employer':
      return [
        ...base,
        { label: t('nav.applications'), href: '/dashboard/employer/applications' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.feed'), href: '/feed' },
      ]
    case 'investor':
      return [
        ...base,
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.discover'), href: '/portfolios' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.feed'), href: '/feed' },
      ]
    case 'mentor':
      return [
        ...base,
        { label: t('nav.scoutTalents'), href: '/mentorship/scout' },
        { label: t('nav.mentees'), href: '/mentorship' },
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.feed'), href: '/feed' },
      ]
    default:
      return [
        ...base,
        { label: t('nav.portfolios'), href: '/dashboard/portfolios' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.feed'), href: '/feed' },
        { label: t('nav.findMentors'), href: '/mentorship' },
      ]
  }
}

function getMobileMenuLinks(role: string | null, t: (key: string) => string) {
  const dashboardUrl = getRoleBasedDashboard(role)

  switch (role) {
    case 'employer':
      return [
        { label: t('nav.dashboard'), href: dashboardUrl },
        { label: t('nav.postOpportunity'), href: '/opportunities/create' },
        { label: t('nav.applications'), href: '/dashboard/employer/applications' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.villagSquare'), href: '/feed' },
        { label: t('nav.messages'), href: '/messages' },
        { label: t('nav.notifications'), href: '/notifications' },
        { label: t('nav.search'), href: '/search' },
      ]
    case 'investor':
      return [
        { label: t('nav.dashboard'), href: dashboardUrl },
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.browsePortfolios'), href: '/portfolios' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.villagSquare'), href: '/feed' },
        { label: t('nav.messages'), href: '/messages' },
        { label: t('nav.notifications'), href: '/notifications' },
        { label: t('nav.search'), href: '/search' },
      ]
    case 'mentor':
      return [
        { label: t('nav.dashboard'), href: dashboardUrl },
        { label: t('nav.scoutTalents'), href: '/mentorship/scout' },
        { label: t('nav.mentees'), href: '/mentorship' },
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.villagSquare'), href: '/feed' },
        { label: t('nav.messages'), href: '/messages' },
        { label: t('nav.notifications'), href: '/notifications' },
        { label: t('nav.search'), href: '/search' },
      ]
    default:
      return [
        { label: t('nav.dashboard'), href: dashboardUrl },
        { label: t('nav.portfolios'), href: '/dashboard/portfolios' },
        { label: t('nav.myApplications'), href: '/dashboard/applications' },
        { label: t('nav.opportunities'), href: '/opportunities' },
        { label: t('nav.pitchStage'), href: '/pitch-stage' },
        { label: t('nav.villagSquare'), href: '/feed' },
        { label: t('nav.findMentors'), href: '/mentorship' },
        { label: t('nav.messages'), href: '/messages' },
        { label: t('nav.notifications'), href: '/notifications' },
        { label: t('nav.search'), href: '/search' },
      ]
  }
}

function getRoleLabel(role: string | null): string {
  switch (role) {
    case 'employer': return 'Employer'
    case 'investor': return 'Investor'
    case 'mentor': return 'Mentor'
    default: return 'Creative'
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { isOnline, isHydrated } = useNetworkStatus()
  const { isSyncing, pendingCount } = useOfflineSync()
  const { role, handleSignOut } = useSession()
  const { t } = useTranslation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  const cta = getRoleCTA(role, t)
  const desktopLinks = getDesktopNavLinks(role, t)
  const mobileLinks = getMobileMenuLinks(role, t)

  // Build StaggeredMenu items from mobile links + auth actions
  const staggeredMenuItems = useMemo(() => {
    const items = mobileLinks.map((link) => ({
      label: link.label,
      link: link.href,
    }))

    if (isSignedIn) {
      items.push({ label: t('nav.profile'), link: '/profile' })
      items.push({ label: t('nav.settings'), link: '/settings' })
      items.push({
        label: t('nav.signOut'),
        link: '#',
        onClick: () => handleSignOut(),
      } as { label: string; link: string; onClick?: () => void })
    } else {
      items.push({ label: t('nav.signIn'), link: '/sign-in' })
      items.push({ label: t('nav.getStarted'), link: '/sign-up' })
    }

    return items
  }, [mobileLinks, isSignedIn, t, handleSignOut])

  // Scroll detection for shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch unread notifications count
  useEffect(() => {
    if (!isSignedIn) return

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/notifications?unread_only=true')
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.notifications?.length || 0)
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [isSignedIn])

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`

  // Check if a nav link is active
  const isLinkActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/employer' || href === '/dashboard/investor' || href === '/dashboard/mentor') {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        'sticky top-0 z-50 w-full transition-shadow duration-300',
        'bg-background/80 backdrop-blur-xl border-b border-border/50',
        scrolled && 'shadow-lg shadow-black/5'
      )}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
        {/* ── Logo ── */}
        <Link href="/" className="flex items-center group relative">
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

        {/* ── Right Section ── */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Network + Sync: compact dot indicators */}
          <div className="flex items-center gap-1.5 mr-1">
            {/* Network dot */}
            <div className="relative group">
              <div className={cn(
                'w-2 h-2 rounded-full transition-colors',
                !isHydrated ? 'bg-muted-foreground/40' : isOnline ? 'bg-green-500' : 'bg-red-500'
              )} />
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded-md border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {!isHydrated ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
              </div>
            </div>

            {/* Sync indicator */}
            {pendingCount > 0 && (
              <div className={cn(
                'w-2 h-2 rounded-full bg-brand-500',
                isSyncing && 'animate-pulse'
              )} />
            )}
          </div>

          {isSignedIn ? (
            <>
              {/* ── Desktop Navigation Links ── */}
              <nav className="hidden md:flex items-center gap-0.5">
                {desktopLinks.map((link) => {
                  const active = isLinkActive(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                        active
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {link.label}
                      {active && (
                        <motion.div
                          layoutId="navIndicator"
                          className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-500 rounded-full"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                    </Link>
                  )
                })}
              </nav>

              {/* ── CTA Button ── */}
              <motion.div
                className="hidden md:block"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  size="sm"
                  className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-4 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20"
                  asChild
                >
                  <Link href={cta.href}>
                    <HugeiconsIcon icon={Add01Icon} className="w-3.5 h-3.5 mr-1.5" />
                    {cta.label}
                  </Link>
                </Button>
              </motion.div>

              {/* ── Search ── */}
              <Link
                href="/search"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <HugeiconsIcon icon={Search01Icon} className="w-[18px] h-[18px]" />
              </Link>

              {/* ── Notifications ── */}
              <Link
                href="/notifications"
                className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <HugeiconsIcon icon={Notification01Icon} className="w-[18px] h-[18px]" />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-brand-500 text-brand-dark text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-brand-purple-500/30 dark:shadow-brand-500/30"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>

              {/* ── Desktop User Dropdown ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden md:flex items-center rounded-full focus:outline-none ring-2 ring-transparent hover:ring-brand-purple-500/30 dark:ring-brand-500/30 transition-all duration-200">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
                      <AvatarFallback className="bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark text-xs font-bold">
                        {initials || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-1.5">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.fullName || 'User'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer flex items-center gap-2">
                      <HugeiconsIcon icon={UserIcon} className="w-3.5 h-3.5" />
                      {t('nav.profile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer flex items-center gap-2">
                      <HugeiconsIcon icon={Settings01Icon} className="w-3.5 h-3.5" />
                      {t('nav.settings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500 cursor-pointer flex items-center gap-2"
                    onClick={() => handleSignOut()}
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="w-3.5 h-3.5" />
                    {t('nav.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
                <Link href="/sign-in">{t('nav.signIn')}</Link>
              </Button>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="sm" className="bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-full px-5 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
                  <Link href="/sign-up">{t('nav.getStarted')}</Link>
                </Button>
              </motion.div>
            </div>
          )}

          {/* Spacer for mobile — StaggeredMenu renders its own toggle */}
          <span className="md:hidden w-16" />
        </div>
      </div>
    </motion.header>

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
        items={staggeredMenuItems}
      />
    </div>
    </>
  )
}
