'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Edit01Icon, GlobeIcon, LinkSquare01Icon, LockIcon, MoreHorizontalIcon, ViewIcon } from "@hugeicons/core-free-icons";
import Link from 'next/link'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TiltedCard from '@/components/TiltedCard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface PortfolioCardProps {
  portfolio: {
    id: string
    localId?: string
    title: string
    description?: string
    slug: string
    isPublic: boolean
    viewCount: number
    projectCount: number
    thumbnailUrl?: string | null
    syncStatus?: 'pending' | 'synced' | 'conflict'
  }
  username?: string
}

export function PortfolioCard({ portfolio, username }: PortfolioCardProps) {
  const id = portfolio.localId || portfolio.id

  return (
    <SpotlightCard className="bg-card border-border hover:border-brand-500/50 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
        {portfolio.thumbnailUrl ? (
          <div className="w-full h-full [&_.tilted-card-figure]:rounded-t-lg">
            <TiltedCard
              imageSrc={portfolio.thumbnailUrl}
              altText={portfolio.title}
              captionText={portfolio.title}
              containerHeight="100%"
              containerWidth="100%"
              imageHeight="100%"
              imageWidth="100%"
              scaleOnHover={1.05}
              rotateAmplitude={10}
              showMobileWarning={false}
              showTooltip={true}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-500/20 to-brand-600/10">
            <span className="text-3xl sm:text-4xl font-bold text-brand-purple-500/50 dark:text-brand-400/50">
              {portfolio.title.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Visibility Badge */}
        <Badge
          variant={portfolio.isPublic ? 'default' : 'secondary'}
          className="absolute top-2 right-2"
        >
          {portfolio.isPublic ? (
            <>
              <HugeiconsIcon icon={GlobeIcon} className="w-3 h-3 mr-1" />
              Public
            </>
          ) : (
            <>
              <HugeiconsIcon icon={LockIcon} className="w-3 h-3 mr-1" />
              Private
            </>
          )}
        </Badge>

        {/* Sync Status */}
        {portfolio.syncStatus === 'pending' && (
          <Badge
            variant="outline"
            className="absolute top-2 left-2 text-brand-purple-600 dark:text-brand-400 border-brand-500/50 bg-background/80"
          >
            Pending sync
          </Badge>
        )}
      </div>

      <div className="pb-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground truncate">
            {portfolio.title}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <HugeiconsIcon icon={MoreHorizontalIcon} className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/portfolios/${id}/edit`}>
                  <HugeiconsIcon icon={Edit01Icon} className="w-4 h-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {portfolio.isPublic && (
                <DropdownMenuItem asChild>
                  <Link href={`/portfolio/${username || 'me'}/${portfolio.slug}`}>
                    <HugeiconsIcon icon={LinkSquare01Icon} className="w-4 h-4 mr-2" />
                    View Public
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {portfolio.description || 'No description'}
        </p>
      </div>

      <div className="pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
            {portfolio.viewCount} views
          </span>
          <span>{portfolio.projectCount} projects</span>
        </div>
      </div>
    </SpotlightCard>
  )
}
