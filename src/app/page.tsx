import dynamic from 'next/dynamic'
import { LandingAuthProvider } from '@/components/landing/landing-auth-context'
import { LandingHeader } from '@/components/landing/landing-header'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { FooterSection } from '@/components/landing/footer-section'

const CatalogSection = dynamic(() =>
  import('@/components/landing/catalog-section').then(m => m.CatalogSection)
)
const FeaturesSection = dynamic(() =>
  import('@/components/landing/features-section').then(m => m.FeaturesSection)
)
const HowItWorksSection = dynamic(() =>
  import('@/components/landing/how-it-works-section').then(m => m.HowItWorksSection)
)
const TestimonialsSection = dynamic(() =>
  import('@/components/landing/testimonials-section').then(m => m.TestimonialsSection)
)
const LandingCTA = dynamic(() =>
  import('@/components/landing/landing-cta').then(m => m.LandingCTA)
)

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
