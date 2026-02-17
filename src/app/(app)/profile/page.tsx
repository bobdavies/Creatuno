'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Camera01Icon, Edit01Icon, Loading02Icon, Location01Icon, Refresh01Icon, Share02Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import SpotlightCard from '@/components/SpotlightCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useSession } from '@/components/providers/user-session-provider'
import { useSettings } from '@/hooks/use-settings'
import { useOfflineSync } from '@/hooks/use-offline-sync'
import { offlineDB } from '@/lib/offline/indexed-db'
import { formatDistanceToNow } from '@/lib/format-date'
import { getRoleBasedDashboard } from '@/lib/auth/user-session'
import { useTranslation } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserProfile {
  id?: string
  full_name: string | null
  bio: string | null
  location: string | null
  role: string
  skills: string[]
  is_mentor: boolean
  is_available_for_mentorship: boolean
  max_mentees: number
  mentor_expertise?: string[]
  hiring_needs?: string
  hiring_categories?: string[]
  investment_interests?: string[]
  investment_budget?: string
}

interface ServerPortfolio {
  id: string
  title: string
  description: string | null
  slug: string
  is_public: boolean
  view_count: number
  updated_at: string
}

interface ApplicationItem {
  id: string
  status: string
  created_at: string
  opportunity?: {
    title?: string
    type?: string
    category?: string
    employer?: {
      full_name?: string
      avatar_url?: string | null
    }
  }
  applicant?: {
    full_name?: string
    avatar_url?: string | null
  }
}

interface MentorshipItem {
  id: string
  status: string
  created_at: string
  mentee?: {
    full_name: string
    avatar_url: string | null
    skills: string[]
  }
}

interface BookmarkItem {
  id: string
  created_at: string
  portfolio: {
    id: string
    title: string
    view_count: number
    profiles: {
      full_name: string
      avatar_url: string | null
    }
  }
}

// ─── Role Config ──────────────────────────────────────────────────────────

const roleConfig: Record<string, { color: string; bgColor: string; borderColor: string; accent: string }> = {
  creative: { color: 'text-brand-purple-600 dark:text-brand-400', bgColor: 'bg-brand-purple-500/10 dark:bg-brand-500/10', borderColor: 'border-brand-purple-500/30 dark:border-brand-500/30', accent: 'border-brand-500' },
  mentor: { color: 'text-brand-purple-600 dark:text-brand-400', bgColor: 'bg-brand-purple-500/10 dark:bg-brand-500/10', borderColor: 'border-brand-purple-500/30 dark:border-brand-500/30', accent: 'border-brand-purple-500' },
  employer: { color: 'text-brand-purple-600 dark:text-brand-400', bgColor: 'bg-brand-purple-500/10 dark:bg-brand-500/10', borderColor: 'border-brand-purple-500/30 dark:border-brand-500/30', accent: 'border-brand-purple-500' },
  investor: { color: 'text-brand-600 dark:text-brand-400', bgColor: 'bg-brand-500/10 dark:bg-brand-500/10', borderColor: 'border-brand-500/30 dark:border-brand-500/30', accent: 'border-brand-500' },
}

const roleGradients: Record<string, string> = {
  creative: 'from-brand-600 via-brand-purple-500 to-brand-400',
  mentor: 'from-brand-purple-600 via-brand-purple-500 to-brand-purple-400',
  employer: 'from-brand-purple-600 via-brand-500 to-brand-purple-400',
  investor: 'from-brand-600 via-brand-500 to-brand-400',
}

const statusDotColors: Record<string, string> = {
  pending: 'bg-brand-500',
  reviewing: 'bg-brand-purple-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-500',
  active: 'bg-green-500',
  completed: 'bg-muted-foreground',
}

const statusBadgeConfig: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-brand-500/10', text: 'text-brand-600 dark:text-brand-400' },
  reviewing: { bg: 'bg-brand-purple-500/10', text: 'text-brand-purple-600 dark:text-brand-400' },
  accepted: { bg: 'bg-green-500/10', text: 'text-green-500' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-500' },
  active: { bg: 'bg-green-500/10', text: 'text-green-500' },
  completed: { bg: 'bg-muted', text: 'text-muted-foreground' },
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const { userId, role } = useSession()
  const { settings, isLoaded: settingsLoaded, toggleSetting } = useSettings()
  const { isSyncing, pendingCount, triggerSync } = useOfflineSync()
  const { theme: resolvedTheme } = useTheme()
  const { t } = useTranslation()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [portfolios, setPortfolios] = useState<ServerPortfolio[]>([])
  const [applications, setApplications] = useState<ApplicationItem[]>([])
  const [mentorships, setMentorships] = useState<MentorshipItem[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [opportunities, setOpportunities] = useState<{ id: string; title: string; status: string; applications_count: number }[]>([])

  const [stats, setStats] = useState({ portfolioViews: 0, activeApplications: 0, totalEarnings: 0 })
  const [offlineStats, setOfflineStats] = useState({ portfolioCount: 0, projectCount: 0, imageCount: 0, pendingSyncCount: 0 })
  const [mentorOffersSent, setMentorOffersSent] = useState(0)

  useEffect(() => {
    if (isLoaded && userId) {
      loadAllData()
    }
  }, [isLoaded, userId, role])

  const loadAllData = async () => {
    setIsLoading(true)

    // Helper: try cache, then network, then cache result
    const cachedFetch = async (url: string, cacheKey: string, ttl = 15 * 60 * 1000) => {
      let idb: any = null
      try { idb = await import('@/lib/offline/indexed-db') } catch {}

      if (!navigator.onLine && idb) {
        const cached = await idb.getCachedData('api', cacheKey).catch(() => null)
        if (cached?.payload) return cached.payload
        return null
      }

      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      if (idb) { idb.cacheData('api', cacheKey, { payload: data }, ttl).catch(() => {}) }
      return data
    }

    try {
      const profileData = await cachedFetch('/api/profiles', 'profile:me', 30 * 60 * 1000)
      if (profileData?.profile) setProfile(profileData.profile)

      const portfolioData = await cachedFetch('/api/portfolios', 'profile:portfolios', 15 * 60 * 1000)
      if (portfolioData?.portfolios) setPortfolios(portfolioData.portfolios)

      try {
        const oStats = await offlineDB.getOfflineStats()
        setOfflineStats(oStats)
      } catch { /* ignore */ }

      if (role === 'creative' || !role) {
        const [statsData, appsData] = await Promise.all([
          cachedFetch('/api/stats/user', 'profile:stats'),
          cachedFetch('/api/applications', 'profile:applications'),
        ])
        if (statsData) setStats(statsData)
        if (appsData?.applications) setApplications(appsData.applications)
      }

      if (role === 'mentor') {
        const [mentorData, offersData] = await Promise.all([
          cachedFetch('/api/mentorship', 'profile:mentorship'),
          cachedFetch('/api/mentorship/offers?role=mentor', 'profile:mentor-offers'),
        ])
        if (mentorData) {
          const active = (mentorData.mentorships || []).filter((m: MentorshipItem) => m.status === 'active')
          const pending = (mentorData.requests || []).filter((r: MentorshipItem) => r.status === 'pending')
          setMentorships([...active, ...pending])
        }
        if (offersData?.offers) setMentorOffersSent(offersData.offers.length)
      }

      if (role === 'employer') {
        const [oppsData, appsData] = await Promise.all([
          cachedFetch('/api/opportunities?my=true', 'profile:employer-opps'),
          cachedFetch('/api/applications?role=employer', 'profile:employer-apps'),
        ])
        if (oppsData?.opportunities) setOpportunities(oppsData.opportunities)
        if (appsData?.applications) setApplications(appsData.applications)
      }

      if (role === 'investor') {
        const [bookData, oppsData] = await Promise.all([
          cachedFetch('/api/bookmarks', 'profile:bookmarks'),
          cachedFetch('/api/opportunities', 'profile:investor-opps'),
        ])
        if (bookData?.bookmarks) setBookmarks(bookData.bookmarks)
        if (oppsData?.opportunities) {
          setOpportunities(oppsData.opportunities.filter((o: { type: string }) => o.type === 'investment'))
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = async () => {
    try {
      await navigator.share?.({
        title: `${profile?.full_name || 'User'} on Creatuno`,
        text: profile?.bio || 'Check out my profile on Creatuno',
        url: window.location.href,
      })
    } catch {
      await navigator.clipboard?.writeText(window.location.href)
      toast.success(t('profile.profileLinkCopied'))
    }
  }

  const handleForceSync = async () => {
    toast.info(t('profile.syncing'))
    await triggerSync()
    try { const oStats = await offlineDB.getOfflineStats(); setOfflineStats(oStats) } catch { /* ignore */ }
    toast.success(t('profile.syncComplete'))
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
  const displayName = profile?.full_name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'
  const currentRole = profile?.role || role || 'creative'
  const roleCfg = roleConfig[currentRole] || roleConfig.creative
  const gradient = roleGradients[currentRole] || roleGradients.creative
  const roleLabel = t(`roles.${currentRole}`)
  const dashboardUrl = getRoleBasedDashboard(currentRole)

  const mentorActiveMentees = mentorships.filter(m => m.status === 'active').length
  const mentorPendingRequests = mentorships.filter(m => m.status === 'pending').length
  const employerActiveJobs = opportunities.filter(o => o.status === 'open').length
  const employerPendingApps = applications.filter(a => a.status === 'pending').length
  const storagePercent = Math.min(100, Math.round(((offlineStats.portfolioCount * 5 + offlineStats.projectCount * 2 + offlineStats.imageCount * 10) / 500) * 100))

  const themeLabel = settings.theme === 'light' ? t('settings.light') : settings.theme === 'system' ? t('settings.system') : t('settings.dark')
  const languageLabel = settings.language === 'krio' ? t('settings.krio') : t('settings.english')

  // Build stats array for current role
  const roleStats = currentRole === 'creative'
    ? [
        { value: stats.portfolioViews, label: t('profile.portfolioViews') },
        { value: stats.activeApplications, label: t('profile.activeApplications'), href: '/dashboard/applications' },
        { value: `$${stats.totalEarnings.toLocaleString()}`, label: t('profile.totalEarnings') },
      ]
    : currentRole === 'mentor'
    ? [
        { value: mentorActiveMentees, label: t('profile.activeMentees'), sub: `${profile?.max_mentees || 5} ${t('profile.maxSlots')}` },
        { value: mentorPendingRequests, label: t('profile.pendingRequests'), href: '/dashboard/mentor' },
        { value: mentorOffersSent, label: 'Offers Sent', href: '/mentorship/scout' },
      ]
    : currentRole === 'employer'
    ? [
        { value: opportunities.length, label: t('profile.totalPostings') },
        { value: employerActiveJobs, label: t('profile.activeJobs') },
        { value: employerPendingApps, label: t('profile.pendingApplications'), href: '/dashboard/employer/applications' },
      ]
    : [
        { value: bookmarks.length, label: t('profile.savedPortfolios') },
        { value: opportunities.length, label: t('profile.investmentOpps') },
        { value: 0, label: t('profile.messagesSent') },
      ]

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="pb-24 md:pb-8">

      {/* ━━━ BANNER ━━━ */}
      <div className={cn('relative w-full h-36 sm:h-44 md:h-48 bg-gradient-to-r', gradient)}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white_1px,transparent_1px)] bg-[length:20px_20px]" />
        {/* Action buttons inside banner */}
        <div className="absolute top-4 right-4 sm:right-6 flex items-center gap-2">
          <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm" asChild>
            <Link href="/profile/edit">
              <HugeiconsIcon icon={Edit01Icon} className="w-3.5 h-3.5 mr-1.5" />
              {t('profile.editProfile')}
            </Link>
          </Button>
          <Button size="icon" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm h-8 w-8" onClick={handleShare}>
            <HugeiconsIcon icon={Share02Icon} className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ━━━ PROFILE INFO (open, no card) ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Avatar overlapping the banner */}
        <div className="relative -mt-14 sm:-mt-16 mb-4 flex items-end gap-4">
          <div className="relative flex-shrink-0">
            <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-background shadow-xl">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback className="text-2xl sm:text-3xl bg-brand-500 text-brand-dark">
                {initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <Link
              href="/profile/edit"
              className="absolute bottom-1 right-1 w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-brand-dark hover:bg-brand-600 transition-colors shadow-lg border-2 border-background"
            >
              <HugeiconsIcon icon={Camera01Icon} className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Name, role, bio, location, skills */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{displayName}</h1>
            <Badge variant="outline" className={cn('text-xs', roleCfg.bgColor, roleCfg.color, roleCfg.borderColor)}>
              {roleLabel}
            </Badge>
            {profile?.is_mentor && profile?.is_available_for_mentorship && (
              <Badge variant="outline" className="text-xs bg-teal-500/10 text-teal-500 border-teal-500/30">
                {t('profile.acceptingMentees')}
              </Badge>
            )}
          </div>

          {profile?.bio && (
            <p className="text-muted-foreground text-sm italic mt-1 line-clamp-2 max-w-xl">
              &ldquo;{profile.bio}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            {profile?.location && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Location01Icon} className="w-3.5 h-3.5" />
                {profile.location}
              </span>
            )}
          </div>

          {profile?.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              <Link href="/profile/edit">
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors">
                  <HugeiconsIcon icon={Add01Icon} className="w-3 h-3 mr-0.5" />
                  {t('profile.addSkill')}
                </Badge>
              </Link>
            </div>
          )}
        </div>

        {/* ━━━ STATS STRIP (no cards, inline row) ━━━ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px mb-8 rounded-xl overflow-hidden bg-border">
          {roleStats.map((stat, i) => {
            const inner = (
              <div key={i} className="bg-background px-3 py-4 sm:px-5 sm:py-5 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
                {'sub' in stat && stat.sub && (
                  <p className="text-[10px] text-brand-purple-600 dark:text-brand-400 mt-0.5">{stat.sub}</p>
                )}
              </div>
            )
            if ('href' in stat && stat.href) {
              return <Link key={i} href={stat.href} className="hover:bg-muted/50 transition-colors">{inner}</Link>
            }
            return <div key={i}>{inner}</div>
          })}
        </div>

        {/* ━━━ MAIN GRID ━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-8">

          {/* ━━━ LEFT COLUMN ━━━ */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Creative Applications (Card) ── */}
            {currentRole === 'creative' && applications.length > 0 && (
              <SpotlightCard className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('profile.activeJobApplications')}</h2>
                    <Link href="/dashboard/applications" className="text-xs sm:text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors">
                      {t('profile.viewAll')} &rarr;
                    </Link>
                  </div>
                  <div className="space-y-1">
                    {applications.slice(0, 4).map((app) => (
                      <Link key={app.id} href="/dashboard/applications" className="block">
                        <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/60 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDotColors[app.status] || 'bg-zinc-500')} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground text-sm truncate">
                                {app.opportunity?.title || t('profile.unknownOpportunity')}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {app.opportunity?.employer?.full_name
                                  ? `${t('profile.postedBy')} ${app.opportunity.employer.full_name}`
                                  : app.opportunity?.category || t('profile.applied')
                                }
                                {' '}&middot; {formatDistanceToNow(app.created_at)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
              </SpotlightCard>
            )}

            {/* ── Mentor Activity (open section) ── */}
            {currentRole === 'mentor' && mentorships.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('profile.mentorshipActivity')}</h2>
                  <Link href="/dashboard/mentor" className="text-xs sm:text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors">
                    {t('profile.viewAll')} &rarr;
                  </Link>
                </div>
                <div className="space-y-1">
                  {mentorships.slice(0, 4).map((m) => (
                    <Link key={m.id} href="/dashboard/mentor" className="block">
                      <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDotColors[m.status] || 'bg-zinc-500')} />
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={m.mentee?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-teal-500/20 text-teal-500">
                              {m.mentee?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {m.mentee?.full_name || t('common.unknown')}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {m.mentee?.skills?.slice(0, 2).join(', ') || t('profile.noSkillsListed')}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={m.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── Employer Applications (open section) ── */}
            {currentRole === 'employer' && applications.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('profile.recentApplications')}</h2>
                  <Link href="/dashboard/employer/applications" className="text-xs sm:text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors">
                    {t('profile.viewAll')} &rarr;
                  </Link>
                </div>
                <div className="space-y-1">
                  {applications.slice(0, 4).map((app) => (
                    <Link key={app.id} href="/dashboard/employer/applications" className="block">
                      <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusDotColors[app.status] || 'bg-zinc-500')} />
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={app.applicant?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-brand-purple-500/20 text-brand-purple-600 dark:text-brand-400">
                              {app.applicant?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {app.applicant?.full_name || t('profile.unknownApplicant')}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {t('profile.appliedFor')}: {app.opportunity?.title || t('common.unknown')}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── Investor Bookmarks (open section) ── */}
            {currentRole === 'investor' && bookmarks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('profile.savedPortfolios')}</h2>
                  <Link href="/dashboard/investor" className="text-xs sm:text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors">
                    {t('profile.viewAll')} &rarr;
                  </Link>
                </div>
                <div className="space-y-1">
                  {bookmarks.slice(0, 4).map((b) => (
                    <Link key={b.id} href={`/portfolio/view/${b.portfolio.id}`} className="block">
                      <div className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/60 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={b.portfolio.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-green-500/20 text-green-500">
                              {b.portfolio.profiles?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{b.portfolio.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {t('common.by')} {b.portfolio.profiles?.full_name || t('common.unknown')} &middot; {b.portfolio.view_count} {t('profile.views')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* ── Mentor Expertise & Availability ── */}
            {currentRole === 'mentor' && (
              <section>
                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">Expertise & Availability</h2>
                <div className="space-y-4">
                  {/* Availability status */}
                  <SpotlightCard className="flex items-center gap-3 py-3 px-4">
                    <span className={cn(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      profile?.is_available_for_mentorship ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {profile?.is_available_for_mentorship ? 'Accepting Mentorship Requests' : 'Not Accepting Requests'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.is_available_for_mentorship
                          ? `${(profile?.max_mentees || 5) - mentorActiveMentees} of ${profile?.max_mentees || 5} slots available`
                          : 'Toggle availability in your profile settings'}
                      </p>
                    </div>
                  </SpotlightCard>

                  {/* Expertise areas */}
                  {profile?.mentor_expertise && profile.mentor_expertise.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expertise Areas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.mentor_expertise.map((area) => (
                          <Badge key={area} variant="outline" className="text-xs bg-teal-500/5 text-teal-500 border-teal-500/20">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edit link */}
                  <Link
                    href="/profile/edit"
                    className="inline-flex text-xs font-medium text-teal-500 hover:text-teal-400 transition-colors"
                  >
                    Edit mentorship settings &rarr;
                  </Link>
                </div>
              </section>
            )}

            {/* ── Portfolios (card grid with thumbnails) ── */}
            {currentRole === 'creative' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">{t('profile.myPortfolios')}</h2>
                  <Link href="/dashboard/portfolios" className="text-xs sm:text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors">
                    {t('profile.viewAll')} &rarr;
                  </Link>
                </div>
                {portfolios.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {portfolios.slice(0, 6).map((p) => (
                        <Link key={p.id} href={`/portfolio/view/${p.id}`} className="block group">
                          <SpotlightCard className="overflow-hidden hover:shadow-lg transition-shadow">
                            {/* Thumbnail */}
                            <div className="h-28 sm:h-32 bg-muted relative">
                              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_60%_40%,white_2px,transparent_2px)] bg-[length:16px_16px]" />
                              <div className="absolute bottom-2 left-2">
                                <Badge variant="outline" className={cn(
                                  'text-[10px] border-white/30 backdrop-blur-sm',
                                  p.is_public ? 'bg-white/20 text-white' : 'bg-black/20 text-white'
                                )}>
                                  {p.is_public ? t('profile.public') : t('profile.draft')}
                                </Badge>
                              </div>
                            </div>
                            {/* Info */}
                            <div className="pt-3 pb-3 px-3">
                              <h4 className="font-medium text-foreground text-sm truncate group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{p.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {p.view_count} {t('profile.views')}
                              </p>
                            </div>
                          </SpotlightCard>
                        </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 rounded-xl bg-muted/30">
                    <p className="text-muted-foreground text-sm mb-4">{t('profile.noPortfoliosYet')}</p>
                    <Button className="bg-brand-500 hover:bg-brand-600 text-brand-dark" asChild>
                      <Link href="/dashboard/portfolios/new">
                        <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                        {t('profile.createPortfolio')}
                      </Link>
                    </Button>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ━━━ RIGHT COLUMN ━━━ */}
          <div className="space-y-8">

            {/* ── Offline & Sync (only for creative) ── */}
            {currentRole === 'creative' && <SpotlightCard className="pt-5 pb-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('profile.offlineSync')}</h3>
                {settingsLoaded && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium text-sm">{t('profile.syncOnWifiOnly')}</Label>
                        <p className="text-xs text-muted-foreground">{t('profile.preserveMobileData')}</p>
                      </div>
                      <Switch checked={settings.syncOnWifiOnly} onCheckedChange={() => toggleSetting('syncOnWifiOnly')} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium text-sm">{t('profile.autoCompressImages')}</Label>
                        <p className="text-xs text-muted-foreground">{t('profile.saveStorageSpace')}</p>
                      </div>
                      <Switch checked={settings.autoCompressImages} onCheckedChange={() => toggleSetting('autoCompressImages')} />
                    </div>
                  </>
                )}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('profile.localStorage')}</p>
                    <span className="text-xs text-muted-foreground">{storagePercent}% {t('profile.used')}</span>
                  </div>
                  <Progress value={storagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {offlineStats.portfolioCount} {t('profile.portfoliosLabel')} &middot; {offlineStats.projectCount} {t('profile.projectsLabel')} &middot; {offlineStats.imageCount} {t('profile.imagesLabel')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30 dark:border-brand-500/30 hover:bg-brand-purple-500/10 dark:bg-brand-500/10"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                >
                  <HugeiconsIcon icon={Refresh01Icon} className={cn('w-4 h-4 mr-2', isSyncing && 'animate-spin')} />
                  {isSyncing ? t('profile.syncing') : t('profile.forceSyncNow')}
                </Button>
            </SpotlightCard>}

            {/* ── Preferences (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">{t('profile.preferences')}</h3>
              <div className="space-y-0">
                <Link href="/settings" className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{t('profile.appearance')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{themeLabel}</span>
                </Link>
                <div className="border-b border-border" />
                <Link href="/settings" className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-brand-purple-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{t('profile.privacy')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">&rarr;</span>
                </Link>
                <div className="border-b border-border" />
                <Link href="/settings" className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{t('profile.language')}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{languageLabel}</span>
                </Link>
              </div>
            </section>

            {/* ── Quick Links (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">{t('profile.quickLinks')}</h3>
              <div className="space-y-0.5">
                <Link href={dashboardUrl} className={cn('block py-2 text-sm font-medium hover:underline transition-colors', roleCfg.color)}>
                  {t('profile.goToDashboard')}
                </Link>
                {currentRole === 'creative' && (
                  <Link href="/dashboard/portfolios/new" className="block py-2 text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:underline transition-colors">
                    {t('profile.createPortfolio')}
                  </Link>
                )}
                {currentRole === 'mentor' && (
                  <Link href="/dashboard/mentor" className="block py-2 text-sm font-medium text-teal-500 hover:underline transition-colors">
                    {t('profile.manageMentees')}
                  </Link>
                )}
                {currentRole === 'employer' && (
                  <Link href="/opportunities/create" className="block py-2 text-sm font-medium text-brand-purple-600 dark:text-brand-400 hover:underline transition-colors">
                    {t('profile.postOpportunity')}
                  </Link>
                )}
                {currentRole === 'investor' && (
                  <Link href="/portfolios" className="block py-2 text-sm font-medium text-green-500 hover:underline transition-colors">
                    {t('profile.browsePortfolios')}
                  </Link>
                )}
                <div className="border-b border-border my-1" />
                <Link href="/settings" className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors">
                  {t('nav.settings')}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = statusBadgeConfig[status] || { bg: 'bg-zinc-500/10', text: 'text-zinc-400' }
  return (
    <Badge variant="outline" className={cn('text-xs capitalize border-0 flex-shrink-0', config.bg, config.text)}>
      {status}
    </Badge>
  )
}
