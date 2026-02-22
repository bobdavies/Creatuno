'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Calendar01Icon, Edit01Icon, LinkSquare01Icon, Loading02Icon, UserIcon, Video01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getPortfolioOffline, getProjectsByPortfolio } from '@/lib/offline'
import { getOfflineImageUrl } from '@/lib/offline/image-compressor'
const ImageGallery = dynamic(
  () => import('@/components/portfolio/image-gallery').then(mod => mod.ImageGallery),
  { ssr: false }
)
import type { OfflinePortfolio, OfflineProject } from '@/types'

export default function PortfolioPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const portfolioId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [portfolio, setPortfolio] = useState<OfflinePortfolio | null>(null)
  const [projects, setProjects] = useState<OfflineProject[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const portfolioData = await getPortfolioOffline(portfolioId)
        if (portfolioData) {
          setPortfolio(portfolioData)
          const projectsData = await getProjectsByPortfolio(portfolioId)
          setProjects(projectsData)
        } else {
          router.push('/dashboard/portfolios')
        }
      } catch (error) {
        console.error('Error loading portfolio:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [portfolioId, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  if (!portfolio) {
    return null
  }

  const portfolioData = portfolio.data as Record<string, unknown>

  return (
    <div className="min-h-screen bg-background">
      {/* Preview Banner */}
      <div className="bg-brand-500 text-brand-dark py-2 px-4 text-center text-sm">
        <span className="font-medium">Preview Mode</span> - This is how your portfolio will look to others
        <Button
          variant="ghost"
          size="sm"
          className="ml-4 text-brand-dark hover:text-brand-dark hover:bg-brand-600"
          asChild
        >
          <Link href={`/dashboard/portfolios/${portfolioId}/edit`}>
            <HugeiconsIcon icon={Edit01Icon} className="w-4 h-4 mr-1" />
            Back to Editor
          </Link>
        </Button>
      </div>

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
        </div>
      </header>

      {/* Portfolio Header */}
      <div className="bg-gradient-to-b from-muted/50 to-background border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Creator Info */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-lg bg-brand-500 text-brand-dark">
                  U
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">You</h2>
                <p className="text-sm text-muted-foreground">Preview</p>
              </div>
            </div>

            {/* Portfolio Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {portfolioData.title as string}
            </h1>
            {portfolioData.tagline && (
              <p className="text-xl text-muted-foreground mb-4">
                {portfolioData.tagline as string}
              </p>
            )}
            
            {/* Description */}
            {portfolioData.description && (
              <p className="text-muted-foreground max-w-2xl mb-6">
                {portfolioData.description as string}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <HugeiconsIcon icon={ViewIcon} className="w-4 h-4" />
                {(portfolioData.view_count as number) || 0} views
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <HugeiconsIcon icon={Calendar01Icon} className="w-4 h-4" />
                {projects.length} projects
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-8">Projects</h2>
          
          {projects.length > 0 ? (
            <div className="space-y-12">
              {projects.map((project) => (
                <ProjectDisplay key={project.localId} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>No projects yet. Add some projects to see them here!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProjectDisplay({ project }: { project: OfflineProject }) {
  const projectData = project.data as Record<string, unknown>
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const videoUrl = projectData.video_url as string | undefined

  useEffect(() => {
    const urls = project.images.map(img => getOfflineImageUrl(img))
    setImageUrls(urls)
  }, [project.images])

  return (
    <article className="space-y-4">
      {/* Project Images & Video Gallery */}
      <ImageGallery 
        images={imageUrls}
        projectTitle={projectData.title as string || 'Project'}
        videoUrl={videoUrl}
      />

      {/* Project Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold text-foreground">
            {projectData.title as string}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {videoUrl && (
              <Badge variant="secondary" className="text-xs">
                <HugeiconsIcon icon={Video01Icon} className="w-3 h-3 mr-1" />
                Video
              </Badge>
            )}
            {projectData.external_link && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href={projectData.external_link as string}
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
          {projectData.client_name && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={UserIcon} className="w-4 h-4" />
              {projectData.client_name as string}
            </span>
          )}
          {projectData.project_date && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Calendar01Icon} className="w-4 h-4" />
              {new Date(projectData.project_date as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
        
        {projectData.description && (
          <p className="text-muted-foreground">
            {projectData.description as string}
          </p>
        )}

        {/* Tags */}
        {(projectData.tags as string[])?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {(projectData.tags as string[]).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
