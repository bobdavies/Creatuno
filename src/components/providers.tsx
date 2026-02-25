'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider, useTheme } from 'next-themes'
import { UserSessionProvider } from '@/components/providers/user-session-provider'
import { LanguageProvider } from '@/lib/i18n/context'
import { NetworkAwareProvider } from '@/components/providers/network-aware-provider'

interface ProvidersProps {
  children: React.ReactNode
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
          formButtonPrimary: 'h-11 bg-brand-500 hover:bg-brand-600 text-brand-dark font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          cardBox: 'w-full',
          card: isDark
            ? 'bg-[#261838]/95 border-[#3D2D54] shadow-2xl shadow-black/30 backdrop-blur'
            : 'bg-white/95 border-[#E8E2EF] shadow-xl shadow-brand-purple-900/10 backdrop-blur',
          formFieldRow: 'gap-y-1.5',
          formFieldLabelRow: 'mb-1',
          headerTitle: isDark ? 'text-[#FBFCFE]' : 'text-[#1B0F28]',
          headerSubtitle: isDark ? 'text-[#A098AE]' : 'text-[#6B6B7B]',
          socialButtonsBlockButton: isDark
            ? 'h-11 bg-[#322148] border-[#3D2D54] text-[#FBFCFE] hover:bg-[#3D2D54] transition-colors'
            : 'h-11 bg-[#F5F1FA] border-[#E8E2EF] text-[#1B0F28] hover:bg-[#EBE4F5] transition-colors',
          formFieldLabel: isDark ? 'text-[#C0A8D9]' : 'text-[#6B6B7B]',
          formFieldInput: isDark
            ? 'h-11 bg-[#322148] border-[#3D2D54] text-[#FBFCFE] placeholder:text-[#8F86A3] transition-colors focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/30'
            : 'h-11 bg-white border-[#E8E2EF] text-[#1B0F28] placeholder:text-[#A098AE] transition-colors focus:border-brand-purple-400 focus:ring-2 focus:ring-brand-purple-300/40',
          formFieldInputShowPasswordButton: isDark
            ? 'text-[#C0A8D9] hover:text-[#FBFCFE]'
            : 'text-[#7E5DA7] hover:text-[#6B4E90]',
          formFieldHintText: isDark ? 'text-[#9B92AF]' : 'text-[#7A7389]',
          formFieldErrorText: isDark ? 'text-[#F5B6C0]' : 'text-[#BE2541]',
          formResendCodeLink: 'text-brand-purple-600 dark:text-brand-purple-300 hover:text-brand-purple-500 dark:hover:text-brand-purple-200',
          otpCodeFieldInput: isDark
            ? 'h-11 bg-[#322148] border-[#3D2D54] text-[#FBFCFE] focus:border-brand-500/70'
            : 'h-11 bg-white border-[#E8E2EF] text-[#1B0F28] focus:border-brand-purple-400',
          formFieldAction: 'text-brand-purple-600 dark:text-brand-purple-300 hover:text-brand-purple-500 dark:hover:text-brand-purple-200',
          identityPreviewText: isDark ? 'text-[#A098AE]' : 'text-[#6B6B7B]',
          dividerLine: isDark ? 'bg-[#3D2D54]' : 'bg-[#E8E2EF]',
          dividerText: isDark ? 'text-[#A098AE]' : 'text-[#6B6B7B]',
          footerActionText: isDark ? 'text-[#A098AE]' : 'text-[#6B6B7B]',
          footerActionLink: 'text-brand-purple-600 dark:text-brand-400 hover:text-brand-purple-500 dark:hover:text-brand-400',
        },
      }}
    >
      <UserSessionProvider>
        <NetworkAwareProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </NetworkAwareProvider>
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
      <ThemeAwareProviders>{children}</ThemeAwareProviders>
    </ThemeProvider>
  )
}
