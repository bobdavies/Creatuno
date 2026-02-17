// @ts-nocheck
import { HugeiconsIcon } from "@hugeicons/react";
import { Layers01Icon, Location01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { PortfolioThumbnail } from '@/components/portfolio/portfolio-thumbnail'
import { BackButton } from './back-button'

interface PageProps {
  params: Promise<{ userId: string }>
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function getCreativeProfile(userId: string) {
  if (!isSupabaseConfiguredServer()) return null

  try {
    const supabase = await createServerClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, bio, location, skills, role')
      .eq('user_id', userId)
      .single()

    if (error || !profile) return null
    return profile
  } catch {
    return null
  }
}

async function getPortfoliosForUser(userId: string) {
  if (!isSupabaseConfiguredServer()) return []

  try {
    const supabase = await createServerClient()

    // Fetch all public portfolios for this user
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('id, title, tagline, description, slug, view_count, is_featured, created_at')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error || !portfolios) return []

    // Get projects for thumbnail images and counts
    const portfolioIds = portfolios.map((p) => p.id)
    if (portfolioIds.length === 0) return []

    const { data: projects } = await supabase
      .from('projects')
      .select('portfolio_id, images')
      .in('portfolio_id', portfolioIds)
      .order('display_order', { ascending: true })

    // Build a map: portfolio_id → { firstImage, projectCount }
    const pMap = new Map<string, { firstImage: string | null; projectCount: number }>()
    portfolioIds.forEach((id) => pMap.set(id, { firstImage: null, projectCount: 0 }))

    projects?.forEach((proj) => {
      const entry = pMap.get(proj.portfolio_id)
      if (entry) {
        entry.projectCount++
        if (!entry.firstImage && proj.images?.length > 0) {
          entry.firstImage = proj.images[0]
        }
      }
    })

    return portfolios.map((p) => {
      const data = pMap.get(p.id) || { firstImage: null, projectCount: 0 }
      return {
        id: p.id,
        title: p.title,
        tagline: p.tagline,
        viewCount: p.view_count || 0,
        createdAt: p.created_at,
        firstImage: data.firstImage,
        projectCount: data.projectCount,
      }
    })
  } catch {
    return []
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params
  const profile = await getCreativeProfile(userId)

  if (!profile) {
    return { title: 'Creative Not Found' }
  }

  return {
    title: `${profile.full_name}'s Portfolios | Creatuno`,
    description: profile.bio || `Browse ${profile.full_name}'s creative portfolios on Creatuno`,
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CreativePortfoliosPage({ params }: PageProps) {
  const { userId } = await params
  const profile = await getCreativeProfile(userId)

  if (!profile) {
    notFound()
  }

  const portfolios = await getPortfoliosForUser(userId)
  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U'

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

      {/* Profile Banner */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b border-border">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-5">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-2 ring-border flex-shrink-0">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-xl sm:text-2xl bg-muted text-muted-foreground font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {profile.full_name}
              </h1>

              {profile.location && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <HugeiconsIcon icon={Location01Icon} className="w-3.5 h-3.5 flex-shrink-0" />
                  {profile.location}
                </p>
              )}

              {profile.bio && (
                <p className="text-muted-foreground text-sm mt-2 max-w-xl line-clamp-3">
                  {profile.bio}
                </p>
              )}

              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {profile.skills.slice(0, 8).map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {profile.skills.length > 8 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{profile.skills.length - 8} more
                    </Badge>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-3">
                {portfolios.length} {portfolios.length === 1 ? 'portfolio' : 'portfolios'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolios Grid */}
      <div className="container mx-auto px-4 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto">
          {portfolios.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {portfolios.map((portfolio) => (
                <Link
                  key={portfolio.id}
                  href={`/portfolio/view/${portfolio.id}`}
                  className="group block"
                >
                  <div className="rounded-xl overflow-hidden border border-border bg-card hover:border-foreground/20 hover:shadow-lg transition-all duration-300">
                    {/* Thumbnail */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      {portfolio.firstImage ? (
                        <div className="absolute inset-0">
                          <PortfolioThumbnail
                            imageSrc={portfolio.firstImage}
                            altText={portfolio.title}
                            className="absolute inset-0"
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-muted" />
                      )}
                      {/* Bottom gradient */}
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
                      {/* Project count badge */}
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium">
                        <HugeiconsIcon icon={Layers01Icon} className="w-3 h-3" />
                        {portfolio.projectCount} {portfolio.projectCount === 1 ? 'project' : 'projects'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3.5 sm:p-4">
                      <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1 group-hover:text-brand-purple-600 dark:text-brand-400 transition-colors">
                        {portfolio.title}
                      </h3>
                      {portfolio.tagline && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {portfolio.tagline}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
                        <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
                        {portfolio.viewCount} views
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <HugeiconsIcon icon={Layers01Icon} className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No public portfolios yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {profile.full_name} hasn&apos;t published any portfolios yet. Check back later.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with Creatuno — Empowering Local Talent through Digital Visibility</p>
        </div>
      </footer>
    </div>
  )
}
