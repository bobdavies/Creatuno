'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon, CloudIcon, CloudLoadingIcon, Edit01Icon, GlobeIcon, Loading02Icon, LockIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import Link from 'next/link'
import SpotlightCard from '@/components/SpotlightCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { offlineDB } from '@/lib/offline/indexed-db'
import { formatDistanceToNow } from '@/lib/format-date'
import { useSession } from '@/components/providers/user-session-provider'
import type { OfflinePortfolio } from '@/types'

interface DisplayPortfolio {
  localId: string
  serverId?: string
  title: string
  tagline?: string
  description?: string
  isPublic: boolean
  updatedAt: string
  isSynced: boolean
}

// Transform OfflinePortfolio to display format
function transformOfflinePortfolio(p: OfflinePortfolio): DisplayPortfolio {
  const data = p.data as Record<string, unknown>
  return {
    localId: p.localId,
    serverId: p.id && !p.id.startsWith('local_') ? p.id : undefined,
    title: (data.title as string) || 'Untitled Portfolio',
    tagline: data.tagline as string | undefined,
    description: data.description as string | undefined,
    isPublic: (data.is_public as boolean) ?? true,
    updatedAt: (data.updated_at as string) || new Date(p.lastModified).toISOString(),
    isSynced: p.syncStatus === 'synced',
  }
}

interface ServerPortfolio {
  id: string
  title: string
  tagline?: string
  description?: string
  is_public: boolean
  updated_at: string
  slug: string
  view_count: number
}

function transformServerPortfolio(p: ServerPortfolio): DisplayPortfolio {
  return {
    localId: p.slug || p.id,
    serverId: p.id,
    title: p.title || 'Untitled Portfolio',
    tagline: p.tagline,
    description: p.description,
    isPublic: p.is_public ?? true,
    updatedAt: p.updated_at,
    isSynced: true,
  }
}

export function RecentPortfolios() {
  const { userId } = useSession()
  const [portfolios, setPortfolios] = useState<DisplayPortfolio[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadPortfolios() {
      if (!userId) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch from both sources in parallel
        const [offlinePortfolios, serverResponse] = await Promise.all([
          offlineDB.getPortfoliosByUser(userId).catch(() => [] as OfflinePortfolio[]),
          fetch('/api/portfolios').then(r => r.ok ? r.json() : { portfolios: [] }).catch(() => ({ portfolios: [] })),
        ])

        const serverPortfolios: ServerPortfolio[] = serverResponse.portfolios || []

        // Transform both sources
        const offlineItems = offlinePortfolios.map(transformOfflinePortfolio)
        const serverItems = serverPortfolios.map(transformServerPortfolio)

        // Merge: prefer server version when both exist (by serverId match)
        const mergedMap = new Map<string, DisplayPortfolio>()

        // Add offline items first
        for (const item of offlineItems) {
          mergedMap.set(item.serverId || item.localId, item)
        }

        // Overwrite with server items (they're more up to date / synced)
        for (const item of serverItems) {
          const existing = mergedMap.get(item.serverId || item.localId)
          if (existing) {
            // Keep localId from offline for edit links, mark as synced
            mergedMap.set(item.serverId || item.localId, {
              ...item,
              localId: existing.localId,
              isSynced: true,
            })
          } else {
            mergedMap.set(item.serverId || item.localId, item)
          }
        }

        // Sort by most recent first, take top 3
        const sorted = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 3)

        setPortfolios(sorted)
      } catch (error) {
        console.error('Error loading portfolios:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPortfolios()
  }, [userId])

  if (isLoading) {
    return (
      <SpotlightCard className="bg-card border-border">
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-lg">Your Portfolios</h3>
        </div>
        <div>
          <div className="flex items-center justify-center py-8">
            <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-brand-purple-600 dark:text-brand-400" />
          </div>
        </div>
      </SpotlightCard>
    )
  }

  if (portfolios.length === 0) {
    return (
      <SpotlightCard className="bg-card border-border">
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-lg">Your Portfolios</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/portfolios">
              View All
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
        <div>
          <div className="text-center py-8">
            <HugeiconsIcon icon={ViewIcon} className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No portfolios yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first portfolio to showcase your work
            </p>
            <Button className="bg-brand-500 hover:bg-brand-600" asChild>
              <Link href="/dashboard/portfolios/new">
                <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
                Create Portfolio
              </Link>
            </Button>
          </div>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <SpotlightCard className="bg-card border-border">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-lg">Your Portfolios</h3>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/portfolios">
            View All ({portfolios.length})
            <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
      <div>
        <div className="space-y-3">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.serverId || portfolio.localId}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">
                    {portfolio.title}
                  </h4>
                  {portfolio.isPublic ? (
                    <HugeiconsIcon icon={GlobeIcon} className="w-3 h-3 text-green-500 flex-shrink-0" />
                  ) : (
                    <HugeiconsIcon icon={LockIcon} className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  )}
                  {portfolio.isSynced ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-500 border-green-500/30">
                      <HugeiconsIcon icon={CloudIcon} className="w-2.5 h-2.5 mr-0.5" />
                      Synced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30">
                      <HugeiconsIcon icon={CloudLoadingIcon} className="w-2.5 h-2.5 mr-0.5" />
                      Local
                    </Badge>
                  )}
                </div>
                {portfolio.tagline && (
                  <p className="text-sm text-muted-foreground truncate">
                    {portfolio.tagline}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {formatDistanceToNow(portfolio.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/portfolios/${portfolio.localId}/edit`}>
                    <HugeiconsIcon icon={Edit01Icon} className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/portfolio/preview/${portfolio.localId}`}>
                    <HugeiconsIcon icon={ViewIcon} className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <Button className="w-full bg-brand-500 hover:bg-brand-600" asChild>
            <Link href="/dashboard/portfolios/new">
              <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 mr-2" />
              Create New Portfolio
            </Link>
          </Button>
        </div>
      </div>
    </SpotlightCard>
  )
}
