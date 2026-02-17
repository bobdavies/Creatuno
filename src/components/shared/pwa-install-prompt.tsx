'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Download01Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'

// Extend Window to include the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'creatuno_pwa_dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < DISMISS_DURATION) return
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a brief delay
      setTimeout(() => setIsVisible(true), 3000)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsVisible(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
    setIsVisible(false)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }, [])

  if (isInstalled) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[380px] z-50"
        >
          <SpotlightCard className="shadow-2xl overflow-hidden">
            {/* Gradient accent bar */}
            <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-purple-500 to-brand-600" />

            <div className="p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-purple-500/10 flex items-center justify-center">
                <HugeiconsIcon icon={SmartPhone01Icon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">
                  Install Creatuno
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Add to your home screen for a faster, offline-capable experience.
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleInstall}
                    className="h-8 px-4 text-xs font-medium bg-brand-500 hover:bg-brand-600 text-brand-dark rounded-lg"
                  >
                    <HugeiconsIcon icon={Download01Icon} className="w-3.5 h-3.5 mr-1.5" />
                    Install
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Not now
                  </Button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
              </button>
            </div>
          </SpotlightCard>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
