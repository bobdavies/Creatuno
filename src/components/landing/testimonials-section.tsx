'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import BlurText from '@/components/BlurText'
import Carousel from '@/components/Carousel'

const testimonials = [
  {
    id: 1,
    name: 'Aminata Sesay',
    role: 'Graphic Designer',
    location: 'Freetown',
    initials: 'AS',
    text: 'I built my portfolio on my phone during a power outage and got my first international client within a week of sharing the link.',
  },
  {
    id: 2,
    name: 'Ibrahim Kamara',
    role: 'Photographer',
    location: 'Kenema',
    initials: 'IK',
    text: 'I work in areas with limited connectivity and I can still update my portfolio. When I get signal, everything syncs perfectly.',
  },
  {
    id: 3,
    name: 'Fatmata Conteh',
    role: 'UI/UX Designer',
    location: 'Bo',
    initials: 'FC',
    text: 'Found my mentor through Creatuno and landed a remote design role within months. This platform actually gets what we need.',
  },
  {
    id: 4,
    name: 'Mohamed Bangura',
    role: 'Web Developer',
    location: 'Makeni',
    initials: 'MB',
    text: 'I\'ve collaborated on three projects I found through the platform. The mobile experience just works.',
  },
  {
    id: 5,
    name: 'Mariama Jalloh',
    role: 'Illustrator',
    location: 'Freetown',
    initials: 'MJ',
    text: 'Clients always comment on how clean my portfolio looks. The image compression means my work loads fast even on slow networks.',
  },
  {
    id: 6,
    name: 'David Koroma',
    role: 'Filmmaker',
    location: 'Freetown',
    initials: 'DK',
    text: 'Three new clients since joining. The mentorship program connected me with industry veterans I never thought I\'d reach.',
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Header */}
      <div className="container mx-auto px-4 sm:px-6 pt-16 sm:pt-24 md:pt-32 pb-8 sm:pb-12">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-brand-purple-600 dark:text-brand-400 text-xs sm:text-sm font-medium tracking-widest uppercase mb-2 sm:mb-3">
            From the community
          </p>
          <BlurText
            text="Real people. Real stories."
            className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground leading-tight"
            delay={100}
            animateBy="words"
            direction="bottom"
          />
          <p className="text-muted-foreground text-sm sm:text-base mt-4 max-w-lg mx-auto">
            Hear from creatives who are building their futures on Creatuno.
          </p>
        </div>
      </div>

      {/* Carousel */}
      <div className="flex justify-center px-4 sm:px-6 pb-16 sm:pb-24">
        <Carousel
          items={testimonials}
          baseWidth={700}
          autoplay
          autoplayDelay={5000}
          pauseOnHover
          loop
          renderItem={(item) => (
            <div className="rounded-xl bg-card p-6 sm:p-8">
              {/* Quote mark */}
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 text-brand-purple-500/20 mb-4"
                fill="currentColor"
                viewBox="0 0 32 32"
              >
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z" />
              </svg>

              {/* Quote text */}
              <p className="text-foreground/90 text-base sm:text-lg leading-relaxed mb-6">
                &ldquo;{item.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 sm:w-11 sm:h-11">
                  <AvatarFallback className="bg-brand-purple-500/15 text-brand-purple-600 dark:text-brand-300 text-sm font-semibold">
                    {item.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {item.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.role}, {item.location}
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </section>
  )
}
