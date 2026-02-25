'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  Loading02Icon,
  Search01Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MdAttachMoney } from 'react-icons/md'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import SpotlightCard from '@/components/SpotlightCard'
import { useSession } from '@/components/providers/user-session-provider'
import { cn } from '@/lib/utils'

const ease = [0.23, 1, 0.32, 1] as const

interface EarningItem {
  id: string
  type: 'work' | 'pitch_funding'
  status: string
  amount: number
  net_payout_amount: number
  currency: string
  created_at: string
  title: string
  from_name: string
  from_avatar: string | null
  source_label: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  revision_exhausted_awaiting_payment: { label: 'Pending', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  payment_received: { label: 'Payment Received', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial_payment_received: { label: 'Partial Received', color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/20' },
  payout_initiated: { label: 'Payout Sent', color: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500/10 border-brand-purple-500/20' },
  completed: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial_payout_completed: { label: 'Partial Complete', color: 'text-teal-600', bg: 'bg-teal-500/10 border-teal-500/20' },
  failed: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
}

const completedStatuses = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed']
const pendingStatuses = ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved']

type FilterStatus = 'all' | 'received' | 'pending'

export default function CreativeEarningsPage() {
  const { userId, role } = useSession()
  const [earnings, setEarnings] = useState<EarningItem[]>([])
  const [stats, setStats] = useState({ total_earned: 0, total_pending: 0, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    if (userId) loadEarnings()
  }, [userId])

  const loadEarnings = async () => {
    try {
      const [workRes, pitchRes] = await Promise.all([
        fetch('/api/payments/history').then(r => r.ok ? r.json() : { payments: [], stats: {} }).catch(() => ({ payments: [], stats: {} })),
        fetch('/api/payments/investment-history').then(r => r.ok ? r.json() : { investments: [], stats: {} }).catch(() => ({ investments: [], stats: {} })),
      ])

      const workItems: EarningItem[] = (workRes.payments || []).map((p: any) => ({
        id: `work_${p.id}`,
        type: 'work' as const,
        status: p.status,
        amount: p.payment_amount,
        net_payout_amount: p.net_payout_amount || p.payment_amount,
        currency: p.currency || 'SLE',
        created_at: p.created_at,
        title: p.opportunity?.title || 'Creative Work',
        from_name: p.employer?.full_name || 'Unknown',
        from_avatar: p.employer?.avatar_url || null,
        source_label: 'Work Payment',
      }))

      const pitchItems: EarningItem[] = (pitchRes.investments || []).map((inv: any) => ({
        id: `pitch_${inv.id}`,
        type: 'pitch_funding' as const,
        status: inv.status,
        amount: inv.amount,
        net_payout_amount: inv.net_payout_amount || inv.amount,
        currency: inv.currency || 'SLE',
        created_at: inv.created_at,
        title: inv.pitch?.title || 'Pitch Funding',
        from_name: inv.investor?.full_name || 'Investor',
        from_avatar: inv.investor?.avatar_url || null,
        source_label: 'Pitch Funding',
      }))

      const combined = [...workItems, ...pitchItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setEarnings(combined)

      const workEarned = workRes.stats?.total_earned || 0
      const pitchReceived = pitchRes.stats?.total_received || 0
      const workPending = workRes.stats?.total_pending || 0
      const pitchPending = pitchRes.stats?.total_pending || 0

      setStats({
        total_earned: workEarned + pitchReceived,
        total_pending: workPending + pitchPending,
        count: combined.length,
      })
    } catch { /* silent */ } finally {
      setIsLoading(false)
    }
  }

  const filtered = earnings.filter(p => {
    if (filter === 'received' && !completedStatuses.includes(p.status)) return false
    if (filter === 'pending' && !pendingStatuses.includes(p.status)) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.title?.toLowerCase().includes(q) || p.from_name?.toLowerCase().includes(q))
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link href="/dashboard"><HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
              <p className="text-sm text-muted-foreground">Your income from projects and pitch funding</p>
            </div>
            {(role === 'creative' || role === 'mentor') && (
              <Button variant="outline" size="sm" className="ml-auto" asChild>
                <Link href="/dashboard/wallet">Wallet & Cashout</Link>
              </Button>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease }}
        >
          <SpotlightCard>
            <div className="grid grid-cols-3 divide-x divide-border/50">
              {[
                { label: 'Total Earned', value: `Le ${stats.total_earned.toLocaleString()}`, color: 'text-emerald-500' },
                { label: 'Pending', value: `Le ${stats.total_pending.toLocaleString()}`, color: 'text-orange-500' },
                { label: 'Payments', value: String(stats.count), color: 'text-brand-purple-600 dark:text-brand-400' },
              ].map(stat => (
                <div key={stat.label} className="p-4 sm:p-6 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{stat.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by project or payer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'received', 'pending'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                  filter === f
                    ? 'bg-brand-500 text-brand-dark'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Pending'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <SpotlightCard className="py-16 text-center">
              <HugeiconsIcon icon={SparklesIcon} className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No earnings yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Complete projects and deliver great work to start earning. Your payments will appear here.
              </p>
            </SpotlightCard>
          ) : (
            filtered.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status] || { label: p.status, color: 'text-muted-foreground', bg: 'bg-muted border-border' }
              const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              const isCompleted = completedStatuses.includes(p.status)

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * Math.min(i, 10), duration: 0.4, ease }}
                >
                  <SpotlightCard className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={p.from_avatar || undefined} />
                        <AvatarFallback className={cn(
                          'text-xs font-bold',
                          p.type === 'pitch_funding'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400'
                        )}>
                          {p.from_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                          {p.type === 'pitch_funding' && (
                            <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20 flex-shrink-0">
                              Pitch
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          from {p.from_name} &middot; {date}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={cn('text-sm font-bold', isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
                          {isCompleted ? '+' : ''}{p.currency || 'SLE'} {(p.net_payout_amount || p.amount)?.toLocaleString()}
                        </p>
                        <Badge variant="outline" className={cn('text-[10px] mt-1', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
