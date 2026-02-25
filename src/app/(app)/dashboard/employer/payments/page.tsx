'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading02Icon,
  Search01Icon,
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

interface Payment {
  id: string
  status: string
  payment_amount: number
  payment_percentage: number
  currency: string
  files_released: boolean
  agreed_amount: number
  net_payout_amount: number
  created_at: string
  opportunity: { title: string; type: string; category: string } | null
  creative: { full_name: string; avatar_url: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  revision_exhausted_awaiting_payment: { label: 'Pending (Revision)', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  review_approved: { label: 'Review Approved', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  payment_received: { label: 'Payment Received', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial_payment_received: { label: 'Partial Received', color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/20' },
  payout_initiated: { label: 'Payout Sent', color: 'text-brand-purple-600 dark:text-brand-400', bg: 'bg-brand-purple-500/10 border-brand-purple-500/20' },
  completed: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial_payout_completed: { label: 'Partial Complete', color: 'text-teal-600', bg: 'bg-teal-500/10 border-teal-500/20' },
}

type FilterStatus = 'all' | 'pending' | 'completed'

export default function EmployerPaymentsPage() {
  const { userId, role } = useSession()
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState({ total_paid: 0, total_pending: 0, count: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    if (userId && role === 'employer') loadPayments()
  }, [userId, role])

  const loadPayments = async () => {
    try {
      const res = await fetch('/api/payments/history')
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
        setStats(data.stats || { total_paid: 0, total_pending: 0, count: 0 })
      }
    } catch { /* silent */ } finally {
      setIsLoading(false)
    }
  }

  const completedStatuses = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed']
  const pendingStatuses = ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved']

  const filtered = payments.filter(p => {
    if (filter === 'completed' && !completedStatuses.includes(p.status)) return false
    if (filter === 'pending' && !pendingStatuses.includes(p.status)) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.opportunity?.title?.toLowerCase().includes(q) || p.creative?.full_name?.toLowerCase().includes(q))
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
              <Link href="/dashboard/employer"><HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
              <p className="text-sm text-muted-foreground">Track all your payments to creatives</p>
            </div>
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
                { label: 'Total Paid', value: `Le ${stats.total_paid.toLocaleString()}`, icon: CheckmarkCircle01Icon, color: 'text-emerald-500' },
                { label: 'Pending', value: `Le ${stats.total_pending.toLocaleString()}`, icon: Clock01Icon, color: 'text-orange-500' },
                { label: 'Transactions', value: String(stats.count), icon: MdAttachMoney, color: 'text-brand-purple-600 dark:text-brand-400' },
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
              placeholder="Search by project or creative..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'completed', 'pending'] as FilterStatus[]).map(f => (
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
                {f === 'all' ? 'All' : f === 'completed' ? 'Completed' : 'Pending'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <SpotlightCard className="py-16 text-center">
              <MdAttachMoney className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No payments found</p>
            </SpotlightCard>
          ) : (
            filtered.map((p, i) => {
              const cfg = STATUS_CONFIG[p.status] || { label: p.status, color: 'text-muted-foreground', bg: 'bg-muted border-border' }
              const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4, ease }}
                >
                  <SpotlightCard className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={p.creative?.avatar_url || undefined} />
                        <AvatarFallback className="bg-brand-purple-500/10 text-brand-purple-600 dark:text-brand-400 text-xs font-bold">
                          {p.creative?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{p.opportunity?.title || 'Unknown Project'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          to {p.creative?.full_name || 'Unknown'} &middot; {date}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{p.currency || 'SLE'} {p.payment_amount?.toLocaleString()}</p>
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
