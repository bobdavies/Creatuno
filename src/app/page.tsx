import { LandingAuthProvider } from '@/components/landing/landing-auth-context'
import { LandingHeader } from '@/components/landing/landing-header'
import { LandingCTA } from '@/components/landing/landing-cta'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { StatsSection } from '@/components/landing/stats-section'
import { CatalogSection } from '@/components/landing/catalog-section'
import { TestimonialsSection } from '@/components/landing/testimonials-section'
import { FooterSection } from '@/components/landing/footer-section'

export default function HomePage() {
  return (
    <LandingAuthProvider>
      <div className="min-h-screen bg-background overflow-x-hidden">
        <LandingHeader />
        <HeroSection />
        <StatsSection />
        <CatalogSection />
        <div id="features">
          <FeaturesSection />
        </div>
        <HowItWorksSection />
        <TestimonialsSection />
        <LandingCTA />
        <FooterSection />
      </div>
    </LandingAuthProvider>
  )
}
