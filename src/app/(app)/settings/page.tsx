'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, Logout01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { offlineDB } from '@/lib/offline/indexed-db'
import { useSettings, type ThemeMode, type Language } from '@/hooks/use-settings'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

const roleColors: Record<string, { color: string; bg: string; border: string }> = {
  creative: { color: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500/10 dark:bg-brand-500/10', border: 'border-brand-purple-500/30 dark:border-brand-500/30' },
  mentor: { color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  employer: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  investor: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' },
}

export default function SettingsPage() {
  const { user } = useUser()
  const { handleSignOut, role } = useSession()
  const { settings, isLoaded, toggleSetting, updateSetting } = useSettings()
  const { setTheme } = useTheme()
  const { t, setLanguage } = useTranslation()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)

  useEffect(() => {
    if (isLoaded && settings.theme) {
      setTheme(settings.theme)
    }
  }, [isLoaded, settings.theme, setTheme])

  const handleThemeChange = (value: ThemeMode) => {
    updateSetting('theme', value)
    setTheme(value)
    toast.success('Setting updated')
  }

  const handleLanguageChange = (value: Language) => {
    updateSetting('language', value)
    setLanguage(value)
    toast.success('Setting updated')
  }

  const handleToggle = (key: 'notifications' | 'emailNotifications' | 'syncOnWifiOnly' | 'autoCompressImages') => {
    toggleSetting(key)
    toast.success('Setting updated')
  }

  const onSignOut = async () => {
    setIsSigningOut(true)
    try { await handleSignOut() } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    } finally { setIsSigningOut(false) }
  }

  const handleClearCache = async () => {
    setIsClearingCache(true)
    try {
      await offlineDB.clearAllOfflineData()
      toast.success('Cache cleared successfully')
    } catch (error) {
      console.error('Clear cache error:', error)
      toast.error('Failed to clear cache')
    } finally { setIsClearingCache(false) }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  const currentRole = role || 'creative'
  const roleCfg = roleColors[currentRole] || roleColors.creative
  const roleLabel = t(`roles.${currentRole}`)
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`

  return (
    <div className="pb-24 md:pb-8">

      {/* ━━━ PROFILE SUMMARY ━━━ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="w-16 h-16 sm:w-20 sm:h-20 ring-2 ring-border shadow-md flex-shrink-0">
            <AvatarImage src={user?.imageUrl} alt={user?.fullName || 'User'} />
            <AvatarFallback className="bg-brand-500 text-brand-dark text-lg sm:text-xl">
              {initials || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{user?.fullName || t('common.user')}</h1>
              <Badge variant="outline" className={cn('text-xs', roleCfg.bg, roleCfg.color, roleCfg.border)}>
                {roleLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <Button variant="outline" size="sm" className="flex-shrink-0 hidden sm:flex" asChild>
            <Link href="/profile/edit">{t('settings.editProfile')}</Link>
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full mb-6 sm:hidden" asChild>
          <Link href="/profile/edit">{t('settings.editProfile')}</Link>
        </Button>

        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-8">{t('settings.title')}</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-10">

          {/* ━━━ LEFT COLUMN ━━━ */}
          <div className="space-y-10">

            {/* ── Account (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                {t('settings.account')}
              </h3>
              <a
                href="/user-profile"
                className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className="text-sm font-medium">{t('settings.manageAccountSecurity')}</span>
                <span className="text-sm text-muted-foreground">&rarr;</span>
              </a>
            </section>

            {/* ── Appearance & Language (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                {t('settings.appearance')} & {t('settings.languageTitle')}
              </h3>
              <div className="pt-4 space-y-6">
                {/* Theme Selector */}
                <div>
                  <Label className="font-medium text-sm">{t('settings.appearance')}</Label>
                  <p className="text-xs text-muted-foreground mb-3">{t('settings.appearanceDesc')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
                      const isActive = settings.theme === mode
                      const label = mode === 'light' ? t('settings.light')
                        : mode === 'dark' ? t('settings.dark')
                        : t('settings.system')
                      return (
                        <button
                          key={mode}
                          onClick={() => handleThemeChange(mode)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer',
                            isActive
                              ? 'border-brand-500 bg-brand-purple-500/10 dark:bg-brand-500/10'
                              : 'border-border hover:border-muted-foreground/30'
                          )}
                        >
                          <div className={cn(
                            'w-full h-10 rounded-md border',
                            mode === 'light' ? 'bg-white border-zinc-200' :
                            mode === 'dark' ? 'bg-zinc-900 border-zinc-700' :
                            'bg-gradient-to-r from-white to-zinc-900 border-zinc-400'
                          )} />
                          <span className={cn(
                            'text-xs font-medium',
                            isActive ? 'text-brand-purple-600 dark:text-brand-400' : 'text-muted-foreground'
                          )}>
                            {label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                {/* Language Selector */}
                <div>
                  <Label className="font-medium text-sm">{t('settings.languageTitle')}</Label>
                  <p className="text-xs text-muted-foreground mb-3">{t('settings.languageDesc')}</p>
                  <Select value={settings.language} onValueChange={(v) => handleLanguageChange(v as Language)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t('settings.english')}</SelectItem>
                      <SelectItem value="krio">{t('settings.krio')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ── Notifications (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                {t('settings.notifications')}
              </h3>
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications" className="font-medium text-sm">{t('settings.pushNotifications')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.pushNotificationsDesc')}</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.notifications}
                    onCheckedChange={() => handleToggle('notifications')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications" className="font-medium text-sm">{t('settings.emailNotifications')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.emailNotificationsDesc')}</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={settings.emailNotifications}
                    onCheckedChange={() => handleToggle('emailNotifications')}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ━━━ RIGHT COLUMN ━━━ */}
          <div className="space-y-10">

            {/* ── Data & Storage (open section) ── */}
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                {t('settings.dataStorage')}
              </h3>
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="syncOnWifiOnly" className="font-medium text-sm">{t('settings.syncOnWifiOnly')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.syncOnWifiOnlyDesc')}</p>
                  </div>
                  <Switch
                    id="syncOnWifiOnly"
                    checked={settings.syncOnWifiOnly}
                    onCheckedChange={() => handleToggle('syncOnWifiOnly')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoCompressImages" className="font-medium text-sm">{t('settings.autoCompressImages')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.autoCompressImagesDesc')}</p>
                  </div>
                  <Switch
                    id="autoCompressImages"
                    checked={settings.autoCompressImages}
                    onCheckedChange={() => handleToggle('autoCompressImages')}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">{t('settings.offlineStorage')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.offlineStorageDesc')}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                  >
                    {isClearingCache ? (
                      <>
                        <HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />
                        {t('settings.clearing')}
                      </>
                    ) : (
                      t('settings.clearCache')
                    )}
                  </Button>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* ── Sign Out ── */}
        <div className="mt-10 mb-4">
          <Button
            variant="outline"
            className="w-full text-red-500 hover:text-red-500 hover:bg-red-500/10"
            onClick={onSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <><HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" />{t('settings.signingOut')}</>
            ) : (
              <><HugeiconsIcon icon={Logout01Icon} className="w-4 h-4 mr-2" />{t('settings.signOut')}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
