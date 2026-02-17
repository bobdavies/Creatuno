import { LandingAuthProvider } from '@/components/landing/landing-auth-context'
import { LandingHeader } from '@/components/landing/landing-header'
import { FooterSection } from '@/components/landing/footer-section'

export function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <LandingAuthProvider>
      <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
        <LandingHeader />
        <main className="flex-1">{children}</main>
        <FooterSection />
      </div>
    </LandingAuthProvider>
  )
}
