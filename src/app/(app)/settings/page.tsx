'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Loading02Icon, Logout01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const { handleSignOut, role, userId } = useSession()
  const { settings, isLoaded, toggleSetting, updateSetting } = useSettings()
  const { setTheme } = useTheme()
  const { t, setLanguage } = useTranslation()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)

  // Payment method state
  const [paymentProvider, setPaymentProvider] = useState<string>('')
  const [paymentProviderId, setPaymentProviderId] = useState<string>('')
  const [paymentAccount, setPaymentAccount] = useState<string>('')
  const [payoutMode, setPayoutMode] = useState<'auto' | 'wallet'>('auto')
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [paymentLoaded, setPaymentLoaded] = useState(false)

  useEffect(() => {
    if (isLoaded && settings.theme) {
      setTheme(settings.theme)
    }
  }, [isLoaded, settings.theme, setTheme])

  useEffect(() => {
    if (userId && (role === 'creative' || role === 'mentor') && !paymentLoaded) {
      loadPaymentSettings()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role])

  const loadPaymentSettings = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const data = await res.json()
        const profile = data.profile
        if (profile) {
          setPaymentProvider(profile.payment_provider || '')
          setPaymentProviderId(profile.payment_provider_id || '')
          setPaymentAccount(profile.payment_account || '')
          setPayoutMode(profile.payout_mode === 'wallet' ? 'wallet' : 'auto')
        }
        setPaymentLoaded(true)
      }
    } catch {
      // Silently fail
    }
  }

  const providerOptions: { value: string; label: string; providerId: string }[] = [
    { value: 'momo', label: 'Orange Money', providerId: 'm17' },
    { value: 'momo', label: 'Afrimoney', providerId: 'm18' },
    { value: 'wallet', label: 'SafulPay (Vault)', providerId: 'dw001' },
    { value: 'bank', label: 'Sierra Leone Commercial Bank', providerId: 'slb001' },
    { value: 'bank', label: 'Rokel Commercial Bank', providerId: 'slb004' },
    { value: 'bank', label: 'Zenith Bank SL', providerId: 'slb007' },
  ]

  const handlePaymentProviderChange = (providerId: string) => {
    const option = providerOptions.find(o => o.providerId === providerId)
    if (option) {
      setPaymentProvider(option.value)
      setPaymentProviderId(option.providerId)
    }
  }

  const handleSavePayment = async () => {
    if (payoutMode === 'auto' && (!paymentProvider || !paymentProviderId || !paymentAccount)) {
      toast.error('Auto payout requires full payment account details')
      return
    }
    setIsSavingPayment(true)
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_provider: paymentProvider || null,
          payment_provider_id: paymentProviderId || null,
          payment_account: paymentAccount || null,
          payout_mode: payoutMode,
        }),
      })
      if (res.ok) {
        toast.success('Payment method saved')
      } else {
        const payload = await res.json().catch(() => null)
        const reason = payload?.error || 'Failed to save payment method'
        const detail = payload?.detail || payload?.hint || ''
        toast.error(detail ? `${reason}: ${detail}` : reason)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save payment method')
    } finally {
      setIsSavingPayment(false)
    }
  }

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

            {/* ── Payment Method (creatives and mentors) ── */}
            {(currentRole === 'creative' || currentRole === 'mentor') && (
              <section>
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                  Payment Method
                </h3>
                <div className="pt-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Set up your payment method to receive payouts. {currentRole === 'mentor' ? 'This is required to receive pitch funding from investors.' : 'This is required before you can receive payments from employers or pitch funding from investors.'}
                  </p>

                  <div>
                    <Label className="font-medium text-sm">Payout Mode</Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPayoutMode('auto')}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                          payoutMode === 'auto'
                            ? 'border-brand-purple-500 bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Auto payout
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayoutMode('wallet')}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                          payoutMode === 'wallet'
                            ? 'border-brand-purple-500 bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Wallet first
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Auto payout sends funds directly to your provider. Wallet first credits your Creatuno wallet so you cash out manually.
                    </p>
                  </div>

                  <div>
                    <Label className="font-medium text-sm">Payment Provider</Label>
                    <Select value={paymentProviderId} onValueChange={handlePaymentProviderChange}>
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder="Select your payment provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((opt) => (
                          <SelectItem key={opt.providerId} value={opt.providerId}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-medium text-sm">
                      {paymentProvider === 'bank' ? 'Account Number' : 'Phone Number'}
                    </Label>
                    <Input
                      className="mt-1.5"
                      placeholder={paymentProvider === 'bank' ? 'Enter your bank account number' : 'e.g. +23278123456'}
                      value={paymentAccount}
                      onChange={(e) => setPaymentAccount(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {paymentProvider === 'momo'
                        ? 'The mobile money number linked to your account'
                        : paymentProvider === 'wallet'
                        ? 'Your SafulPay (Vault) phone number or wallet ID'
                        : paymentProvider === 'bank'
                        ? 'Your bank account number'
                        : 'Select a provider first'}
                    </p>
                  </div>

                  <Button
                    className="w-full rounded-lg bg-brand-purple-600 hover:bg-brand-purple-700 text-white"
                    onClick={handleSavePayment}
                    disabled={isSavingPayment || (payoutMode === 'auto' && (!paymentProvider || !paymentAccount))}
                  >
                    {isSavingPayment ? (
                      <><HugeiconsIcon icon={Loading02Icon} className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      'Save Payment Method'
                    )}
                  </Button>

                  {paymentLoaded && paymentProvider && paymentAccount && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-xs font-medium text-emerald-500">
                        Payment method configured
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {providerOptions.find(o => o.providerId === paymentProviderId)?.label} — {paymentAccount}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

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
