// @ts-nocheck
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Calendar01Icon, Layers01Icon, LinkSquare01Icon, Location01Icon, UserIcon, Video01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { ImageGallery } from '@/components/portfolio/image-gallery'
import { ContactCreatorButton } from '@/components/portfolio/contact-creator-button'
import { FadeIn, ProjectCard } from '@/components/portfolio/portfolio-detail-client'

interface PortfolioPageProps {
  params: Promise<{
    username: string
    slug: string
  }>
}

// Fetch portfolio from Supabase
async function getPortfolio(username: string, slug: string) {
  if (!isSupabaseConfiguredServer()) {
    return null
  }

  try {
    const supabase = await createServerClient()

    const { data: portfolio, error } = await supabase
      .from('portfolios')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          bio,
          location,
          skills
        )
      `)
      .eq('slug', slug)
      .eq('is_public', true)
      .single()

    if (error || !portfolio) {
      console.error('Portfolio not found:', error)
      return null
    }

    // Fetch projects for this portfolio
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('display_order', { ascending: true })

    // Increment view count
    await supabase
      .from('portfolios')
      .update({ view_count: (portfolio.view_count || 0) + 1 })
      .eq('id', portfolio.id)

    return {
      id: portfolio.id,
      title: portfolio.title,
      tagline: portfolio.tagline,
      description: portfolio.description,
      slug: portfolio.slug,
      isPublic: portfolio.is_public,
      viewCount: (portfolio.view_count || 0) + 1,
      createdAt: portfolio.created_at,
      user: {
        id: portfolio.profiles?.id || portfolio.user_id,
        fullName: portfolio.profiles?.full_name || 'Unknown User',
        username: username,
        avatarUrl: portfolio.profiles?.avatar_url || null,
        bio: portfolio.profiles?.bio || '',
        location: portfolio.profiles?.location || '',
        skills: portfolio.profiles?.skills || [],
      },
      projects: (projects || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        clientName: p.client_name,
        projectDate: p.project_date,
        externalLink: p.external_link,
        videoUrl: p.video_url,
        tags: p.tags || [],
        images: p.images || [],
      })),
    }
  } catch (error) {
    console.error('Error fetching portfolio:', error)
    return null
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PortfolioPageProps): Promise<Metadata> {
  const { username, slug } = await params
  const portfolio = await getPortfolio(username, slug)

  if (!portfolio) {
    return { title: 'Portfolio Not Found' }
  }

  const description = portfolio.description || portfolio.tagline || `${portfolio.title} by ${portfolio.user.fullName}`
  const firstImage = portfolio.projects[0]?.images?.[0]

  return {
    title: `${portfolio.title} | ${portfolio.user.fullName} - Creatuno`,
    description,
    keywords: [portfolio.title, portfolio.user.fullName, 'portfolio', 'creative', ...portfolio.user.skills].filter(Boolean),
    authors: [{ name: portfolio.user.fullName }],
    openGraph: {
      title: `${portfolio.title} | ${portfolio.user.fullName}`,
      description,
      type: 'website',
      siteName: 'Creatuno',
      images: firstImage ? [{ url: firstImage, width: 1200, height: 630, alt: portfolio.title }] : [],
    },
    twitter: {
      card: firstImage ? 'summary_large_image' : 'summary',
      title: `${portfolio.title} | ${portfolio.user.fullName}`,
      description,
      images: firstImage ? [firstImage] : [],
    },
    robots: { index: true, follow: true },
  }
}

export default async function PublicPortfolioPage({ params }: PortfolioPageProps) {
  const { username, slug } = await params
  const portfolio = await getPortfolio(username, slug)

  if (!portfolio) {
    notFound()
  }

  const portfolioPath = `/portfolio/${username}/${slug}`

  return (
    <div className="min-h-screen bg-background">
      {/* ━━━ TOP NAV ━━━ */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/branding/logo-horizontal-dark.svg"
                alt="Creatuno"
                width={130}
                height={18}
                className="h-5 w-auto dark:hidden"
                priority
              />
              <Image
                src="/branding/logo-horizontal-bright.svg"
                alt="Creatuno"
                width={130}
                height={18}
                className="h-5 w-auto hidden dark:block"
                priority
              />
            </Link>
            <span className="hidden sm:block w-px h-5 bg-border/60" />
            <Link
              href="/portfolios"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-3.5 h-3.5" />
              Back to Portfolios
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs rounded-full" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" className="text-xs rounded-full bg-brand-500 hover:bg-brand-600" asChild>
              <Link href="/sign-up">Join Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ━━━ HERO BANNER ━━━ */}
      <div className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/15 via-brand-purple-500/8 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <FadeIn>
            {/* Creator Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-brand-500/20 shadow-xl shadow-brand-purple-500/10 dark:shadow-brand-500/10">
                <AvatarImage src={portfolio.user.avatarUrl || undefined} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-brand-purple-500 to-brand-500 text-brand-dark">
                  {portfolio.user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{portfolio.user.fullName}</h2>
                {portfolio.user.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <HugeiconsIcon icon={Location01Icon} className="w-3 h-3" />
                    {portfolio.user.location}
                  </p>
                )}
                {portfolio.user.bio && (
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 max-w-lg">{portfolio.user.bio}</p>
                )}
              </div>
            </div>

            {/* Portfolio Title */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
              {portfolio.title}
            </h1>
            {portfolio.tagline && (
              <p className="text-base sm:text-lg text-muted-foreground mb-3">{portfolio.tagline}</p>
            )}
            {portfolio.description && (
              <p className="text-sm text-muted-foreground max-w-2xl mb-6 leading-relaxed">{portfolio.description}</p>
            )}

            {/* Stats + Skills */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5" />
                {portfolio.viewCount} views
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Layers01Icon} className="w-3.5 h-3.5" />
                {portfolio.projects.length} project{portfolio.projects.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-6">
              {portfolio.user.skills.map((skill) => (
                <Badge key={skill} variant="outline" className="text-[10px] px-2 py-0.5 border-brand-500/20 text-muted-foreground bg-brand-500/5">
                  {skill}
                </Badge>
              ))}
            </div>

            {/* Contact CTA (desktop only shown here; mobile uses fixed bar) */}
            <ContactCreatorButton
              creatorName={portfolio.user.fullName}
              creatorUsername={portfolio.user.username}
              portfolioPath={portfolioPath}
            />
          </FadeIn>
        </div>
      </div>

      {/* ━━━ PROJECTS ━━━ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <FadeIn delay={0.15}>
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Projects</h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-0.5 rounded-full">
              {portfolio.projects.length}
            </span>
          </div>
        </FadeIn>

        <div className="space-y-14">
          {portfolio.projects.map((project, index) => (
            <ProjectCard key={project.id} index={index}>
              <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden hover:border-brand-500/20 transition-all duration-300">
                {/* Gallery */}
                <div className="relative">
                  <ImageGallery
                    images={project.images || []}
                    projectTitle={project.title}
                    videoUrl={project.videoUrl}
                  />
                </div>

                {/* Project Info */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {project.videoUrl && (
                        <Badge variant="secondary" className="text-[10px] px-2">
                          <HugeiconsIcon icon={Video01Icon} className="w-3 h-3 mr-1" />
                          Video
                        </Badge>
                      )}
                      {project.externalLink && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs rounded-full" asChild>
                          <a href={project.externalLink} target="_blank" rel="noopener noreferrer">
                            <HugeiconsIcon icon={LinkSquare01Icon} className="w-3.5 h-3.5 mr-1" />
                            View
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {project.clientName && (
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={UserIcon} className="w-3.5 h-3.5" />
                        {project.clientName}
                      </span>
                    )}
                    {project.projectDate && (
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon icon={Calendar01Icon} className="w-3.5 h-3.5" />
                        {new Date(project.projectDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                  )}

                  {/* Tags */}
                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {project.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0.5 border-border/50 text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ProjectCard>
          ))}
        </div>
      </div>

      {/* ━━━ CTA FOOTER ━━━ */}
      <div className="relative overflow-hidden mt-8">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 via-brand-purple-500/5 to-brand-600/10" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Want to showcase your work?
          </h3>
          <p className="text-muted-foreground mb-8 text-sm sm:text-base">
            Join Creatuno and create your portfolio to reach clients, employers, and collaborators.
          </p>
          <Button size="lg" className="bg-brand-500 hover:bg-brand-600 rounded-full px-8 shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20" asChild>
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>
      </div>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="border-t border-border/50 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Creatuno. Empowering Local Talent through Digital Visibility.</p>
        </div>
      </footer>
    </div>
  )
}
