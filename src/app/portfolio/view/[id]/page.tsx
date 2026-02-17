// @ts-nocheck
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon, LinkSquare01Icon, UserIcon, Video01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { ImageGallery } from '@/components/portfolio/image-gallery'
import { BackButton } from './back-button'

interface PortfolioViewPageProps {
  params: Promise<{
    id: string
  }>
}

// Fetch portfolio from Supabase by ID
async function getPortfolioById(portfolioId: string) {
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
      .eq('id', portfolioId)
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

    return {
      id: portfolio.id,
      title: portfolio.title,
      tagline: portfolio.tagline,
      description: portfolio.description,
      slug: portfolio.slug,
      isPublic: portfolio.is_public,
      viewCount: portfolio.view_count || 0,
      createdAt: portfolio.created_at,
      user: {
        id: portfolio.profiles?.id || portfolio.user_id,
        fullName: portfolio.profiles?.full_name || 'Unknown User',
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
export async function generateMetadata({ params }: PortfolioViewPageProps): Promise<Metadata> {
  const { id } = await params
  const portfolio = await getPortfolioById(id)

  if (!portfolio) {
    return {
      title: 'Portfolio Not Found',
    }
  }

  const description = portfolio.description || portfolio.tagline || `${portfolio.title} by ${portfolio.user.fullName}`

  return {
    title: `${portfolio.title} | ${portfolio.user.fullName} - Creatuno`,
    description,
  }
}

export default async function PortfolioViewPage({ params }: PortfolioViewPageProps) {
  const { id } = await params
  const portfolio = await getPortfolioById(id)

  if (!portfolio) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
          <BackButton />
        </div>
      </header>

      {/* Portfolio Header */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Creator Info */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={portfolio.user.avatarUrl || undefined} />
                <AvatarFallback className="text-lg bg-brand-500 text-brand-dark">
                  {portfolio.user.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">
                  {portfolio.user.fullName}
                </h2>
                {portfolio.user.location && (
                  <p className="text-sm text-muted-foreground">
                    {portfolio.user.location}
                  </p>
                )}
                {portfolio.user.bio && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {portfolio.user.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Portfolio Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {portfolio.title}
            </h1>
            {portfolio.tagline && (
              <p className="text-xl text-muted-foreground mb-4">
                {portfolio.tagline}
              </p>
            )}
            
            {/* Description */}
            {portfolio.description && (
              <p className="text-muted-foreground max-w-2xl mb-6">
                {portfolio.description}
              </p>
            )}

            {/* Stats & Skills */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <HugeiconsIcon icon={ViewIcon} className="w-4 h-4" />
                {portfolio.viewCount} views
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="w-4 h-4" />
                {portfolio.projects.length} projects
              </div>
            </div>

            {/* Skills */}
            {portfolio.user.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {portfolio.user.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-8">Projects</h2>
          
          {portfolio.projects.length > 0 ? (
            <div className="space-y-12">
              {portfolio.projects.map((project) => (
                <article key={project.id} className="space-y-4">
                  {/* Project Images & Video Gallery */}
                  <ImageGallery 
                    images={project.images || []}
                    projectTitle={project.title}
                    videoUrl={project.videoUrl}
                  />

                  {/* Project Info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl font-semibold text-foreground">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {project.videoUrl && (
                          <Badge variant="secondary" className="text-xs">
                            <HugeiconsIcon icon={Video01Icon} className="w-3 h-3 mr-1" />
                            Video
                          </Badge>
                        )}
                        {project.externalLink && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={project.externalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <HugeiconsIcon icon={LinkSquare01Icon} className="w-4 h-4 mr-1" />
                              View
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {project.clientName && (
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={UserIcon} className="w-4 h-4" />
                          {project.clientName}
                        </span>
                      )}
                      {project.projectDate && (
                        <span className="flex items-center gap-1">
                          <HugeiconsIcon icon={Calendar01Icon} className="w-4 h-4" />
                          {new Date(project.projectDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </span>
                      )}
                    </div>
                    
                    {project.description && (
                      <p className="text-muted-foreground">
                        {project.description}
                      </p>
                    )}

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {project.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>No projects in this portfolio yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with Creatuno - Empowering Local Talent through Digital Visibility</p>
        </div>
      </footer>
    </div>
  )
}
