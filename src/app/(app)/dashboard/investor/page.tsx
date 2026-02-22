'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon, ArrowRight01Icon, Bookmark01Icon, BookmarkCheck01Icon, Briefcase01Icon, Loading02Icon, Message01Icon, Refresh01Icon, Search01Icon, Settings01Icon, StarIcon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MdAttachMoney } from 'react-icons/md'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useSession } from '@/components/providers/user-session-provider'
import { formatDistanceToNow } from '@/lib/format-date'
import { cn } from '@/lib/utils'

interface BookmarkedPortfolio {
  id: string
  created_at: string
  portfolio: {
    id: string
    title: string
    description: string
    tagline: string
    slug: string
    is_public: boolean
    view_count: number
    user_id: string
    updated_at: string
    profiles: {
      full_name: string
      avatar_url: string | null
      skills: string[]
    }
  }
}

interface Opportunity {
  id: string
  title: string
  type: string
  category: string
  budgetMin: number
  budgetMax: number
  currency: string
  createdAt: string
}

export default function InvestorDashboardPage() {
  const { userId, role, isLoading: sessionLoading } = useSession()
  
  const [isLoading, setIsLoading] = useState(true)
  const [bookmarks, setBookmarks] = useState<BookmarkedPortfolio[]>([])
  const [investmentOpps, setInvestmentOpps] = useState<Opportunity[]>([])
  const [messageCount, setMessageCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (userId && role === 'investor') {
      loadInvestorData()
    }
  }, [userId, role])

  const loadInvestorData = async () => {
    setIsLoading(true)
    try {
      const [bookmarksRes, oppsRes, messagesRes] = await Promise.all([
        fetch('/api/bookmarks').then(r => r.ok ? r.json() : { bookmarks: [] }).catch(() => ({ bookmarks: [] })),
        fetch('/api/opportunities?type=investment').then(r => r.ok ? r.json() : { opportunities: [] }).catch(() => ({ opportunities: [] })),
        fetch('/api/messages?count_only=true').then(r => r.ok ? r.json() : { count: 0 }).catch(() => ({ count: 0 })),
      ])

      setBookmarks(bookmarksRes.bookmarks || [])
      setInvestmentOpps(oppsRes.opportunities || [])
      setMessageCount(messagesRes.count || 0)
    } catch (error) {
      console.error('Error loading investor data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveBookmark = async (portfolioId: string) => {
    try {
      const response = await fetch(`/api/bookmarks?portfolio_id=${portfolioId}`, { method: 'DELETE' })
      if (response.ok) {
        setBookmarks(bookmarks.filter(b => b.portfolio?.id !== portfolioId))
        toast.success('Bookmark removed')
      }
    } catch (error) {
      console.error('Error removing bookmark:', error)
      toast.error('Failed to remove bookmark')
    }
  }

  if (sessionLoading || (role !== 'investor' && !sessionLoading)) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Investor Dashboard</h1>
          <p className="text-muted-foreground">Discover and invest in creative talent</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={loadInvestorData} disabled={isLoading}>
            <HugeiconsIcon icon={Refresh01Icon} className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <HugeiconsIcon icon={Settings01Icon} className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <SpotlightCard className="mb-6">
        <div className="p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search for creative portfolios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="bg-brand-500 hover:bg-brand-600" asChild>
              <Link href={`/search?q=${encodeURIComponent(searchQuery)}`}>
                Search
              </Link>
            </Button>
          </div>
        </div>
      </SpotlightCard>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SpotlightCard>
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={BookmarkCheck01Icon} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {isLoading ? <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin" /> : bookmarks.length}
                </p>
                <p className="text-xs text-muted-foreground">Saved Portfolios</p>
              </div>
            </div>
          </div>
        </SpotlightCard>
        <SpotlightCard>
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Message01Icon} className="w-8 h-8 text-brand-purple-600 dark:text-brand-400" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {isLoading ? <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin" /> : messageCount}
                </p>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </div>
            </div>
          </div>
        </SpotlightCard>
        <SpotlightCard>
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={Briefcase01Icon} className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {isLoading ? <HugeiconsIcon icon={Loading02Icon} className="w-5 h-5 animate-spin" /> : investmentOpps.length}
                </p>
                <p className="text-xs text-muted-foreground">Investment Opps</p>
              </div>
            </div>
          </div>
        </SpotlightCard>
        <SpotlightCard>
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <MdAttachMoney className="w-8 h-8 text-brand-purple-600 dark:text-brand-400" />
              <div>
                <p className="text-sm font-bold text-muted-foreground">Coming Soon</p>
                <p className="text-xs text-muted-foreground">Total Invested</p>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link href="/portfolios">
            <HugeiconsIcon icon={ViewIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
            <span>Browse Portfolios</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link href="/feed">
            <HugeiconsIcon icon={AnalyticsUpIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
            <span>Village Square</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
          <Link href="/opportunities/create">
            <MdAttachMoney className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
            <span>Post Investment Opportunity</span>
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="saved" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <HugeiconsIcon icon={Bookmark01Icon} className="w-4 h-4" />
            Saved Portfolios
            {bookmarks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-brand-500 text-brand-dark">
                {bookmarks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <HugeiconsIcon icon={Briefcase01Icon} className="w-4 h-4" />
            Investments
          </TabsTrigger>
        </TabsList>

        {/* Saved Portfolios Tab */}
        <TabsContent value="saved">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
            </div>
          ) : bookmarks.length > 0 ? (
            <div className="space-y-4">
              {bookmarks.map((bookmark) => {
                const portfolio = bookmark.portfolio
                if (!portfolio) return null
                const profile = portfolio.profiles as unknown as { full_name: string; avatar_url: string | null; skills: string[] }
                return (
                  <SpotlightCard key={bookmark.id}>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-brand-500 text-brand-dark">
                              {profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{portfolio.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              by {profile?.full_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {portfolio.description || portfolio.tagline || 'No description'}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <HugeiconsIcon icon={ViewIcon} className="w-3 h-3" />
                                {portfolio.view_count} views
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Saved {formatDistanceToNow(bookmark.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/portfolios`}>
                              View
                              <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500"
                            onClick={() => handleRemoveBookmark(portfolio.id)}
                          >
                            <HugeiconsIcon icon={StarIcon} className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                )
              })}
            </div>
          ) : (
            <SpotlightCard>
              <div className="py-16 px-6 text-center">
                <HugeiconsIcon icon={Bookmark01Icon} className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No saved portfolios</h3>
                <p className="text-muted-foreground mb-4">Browse portfolios and bookmark the ones you like</p>
                <Button variant="outline" asChild>
                  <Link href="/portfolios">Browse Portfolios</Link>
                </Button>
              </div>
            </SpotlightCard>
          )}
        </TabsContent>

        {/* Investment Opportunities Tab */}
        <TabsContent value="opportunities">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
            </div>
          ) : investmentOpps.length > 0 ? (
            <div className="space-y-4">
              {investmentOpps.map((opp) => (
                <SpotlightCard key={opp.id}>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{opp.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{opp.category}</Badge>
                          <Badge variant="secondary" className="bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 border-brand-purple-500/30">
                            Investment
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Budget: {opp.currency} {opp.budgetMin?.toLocaleString()} - {opp.budgetMax?.toLocaleString()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/opportunities/${opp.id}`}>
                          Details
                          <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          ) : (
            <SpotlightCard>
              <div className="py-16 px-6 text-center">
                <HugeiconsIcon icon={Briefcase01Icon} className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No investment opportunities</h3>
                <p className="text-muted-foreground mb-4">Post an investment opportunity to find creative talent</p>
                <Button className="bg-brand-500 hover:bg-brand-600" asChild>
                  <Link href="/opportunities/create">Post Investment Opportunity</Link>
                </Button>
              </div>
            </SpotlightCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
