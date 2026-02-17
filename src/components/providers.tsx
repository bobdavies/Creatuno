'use client'

import { useEffect } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider, useTheme } from 'next-themes'
import { UserSessionProvider } from '@/components/providers/user-session-provider'
import { LanguageProvider } from '@/lib/i18n/context'

interface ProvidersProps {
  children: React.ReactNode
}

/* ── Register Service Worker once on mount ── */
function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered, scope:', registration.scope)
          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('New service worker activated')
                }
              })
            }
          })
        })
        .catch((err) => {
          console.warn('SW registration failed:', err)
        })
    }
  }, [])
  return null
}

/* ── Inner wrapper that reads the resolved theme for Clerk + Toaster ── */
function ThemeAwareProviders({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#FEC714',
          colorBackground: isDark ? '#1B0F28' : '#FBFCFE',
          colorInputBackground: isDark ? '#261838' : '#F5F1FA',
          colorInputText: isDark ? '#FBFCFE' : '#1B0F28',
          colorText: isDark ? '#FBFCFE' : '#1B0F28',
          colorTextSecondary: isDark ? '#A098AE' : '#6B6B7B',
        },
        elements: {
          formButtonPrimary: 'bg-brand-500 hover:bg-brand-600 text-brand-dark',
          card: isDark ? 'bg-[#261838] border-[#3D2D54]' : 'bg-white border-[#E8E2EF]',
          headerTitle: isDark ? 'text-[#FBFCFE]' : 'text-[#1B0F28]',
          headerSubtitle: isDark ? 'text-[#A098AE]' : 'text-[#6B6B7B]',
          socialButtonsBlockButton: isDark
            ? 'bg-[#322148] border-[#3D2D54] text-[#FBFCFE] hover:bg-[#3D2D54]'
            : 'bg-[#F5F1FA] border-[#E8E2EF] text-[#1B0F28] hover:bg-[#EBE4F5]',
          formFieldLabel: isDark ? 'text-[#C0A8D9]' : 'text-[#6B6B7B]',
          formFieldInput: isDark
            ? 'bg-[#322148] border-[#3D2D54] text-[#FBFCFE]'
            : 'bg-white border-[#E8E2EF] text-[#1B0F28]',
          footerActionLink: 'text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400',
        },
      }}
    >
      <UserSessionProvider>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </UserSessionProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: isDark ? '#261838' : '#FBFCFE',
            border: isDark ? '1px solid #3D2D54' : '1px solid #E8E2EF',
            color: isDark ? '#FBFCFE' : '#1B0F28',
          },
        }}
      />
    </ClerkProvider>
  )
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ServiceWorkerRegistration />
      <ThemeAwareProviders>{children}</ThemeAwareProviders>
    </ThemeProvider>
  )
}
