import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { OfflineIndicator } from '@/components/shared/offline-indicator'
import { PWAInstallPrompt } from '@/components/shared/pwa-install-prompt'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav />
      <OfflineIndicator />
      <PWAInstallPrompt />
    </div>
  )
}
