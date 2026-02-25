'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Loading02Icon, Wallet01Icon } from '@hugeicons/core-free-icons'
import { useSession } from '@/components/providers/user-session-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type WalletSummary = {
  wallet: {
    id: string
    currency: string
    available_balance: number
    pending_balance: number
  } | null
  recent_cashouts: Array<{
    id: string
    amount: number
    currency: string
    status: 'pending' | 'initiated' | 'completed' | 'failed'
    created_at: string
  }>
  backfill?: {
    applied_count: number
    applied_amount: number
    error: string | null
  }
}

export default function WalletPage() {
  const { role } = useSession()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [amount, setAmount] = useState('')

  const canUseWallet = role === 'creative' || role === 'mentor'

  const available = useMemo(() => Number(summary?.wallet?.available_balance || 0), [summary])
  const currency = summary?.wallet?.currency || 'SLE'

  async function loadSummary() {
    setLoading(true)
    try {
      const res = await fetch('/api/wallet/summary', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load wallet')
      setSummary(data)
      if (data?.backfill?.error) {
        toast.error(`Wallet sync warning: ${data.backfill.error}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load wallet')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canUseWallet) loadSummary()
    else setLoading(false)
  }, [canUseWallet])

  async function submitCashout() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid cashout amount')
      return
    }
    if (value > available) {
      toast.error('Cashout amount exceeds available balance')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({ amount: value, currency }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Cashout failed')
      toast.success('Cashout initiated')
      setAmount('')
      await loadSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cashout failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <HugeiconsIcon icon={Loading02Icon} className="h-8 w-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  if (!canUseWallet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Wallet cashout is available only for creative and mentor users.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          <p className="text-sm text-muted-foreground">Cash out earnings to bank, Orange Money, or Afrimoney</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Available balance</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{currency} {available.toLocaleString()}</p>
          <p className="mt-2 text-xs text-muted-foreground">Pending: {currency} {Number(summary?.wallet?.pending_balance || 0).toLocaleString()}</p>
          {!!summary?.backfill?.applied_count && (
            <p className="mt-2 text-xs text-emerald-500">
              Synced {summary.backfill.applied_count} receivable payment(s): +{currency} {Number(summary.backfill.applied_amount || 0).toLocaleString()}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Earnings and wallet are different views: wallet shows what is currently available to cash out.
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <div className="mb-3 flex items-center gap-2">
            <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5 text-brand-purple-600 dark:text-brand-400" />
            <p className="font-semibold">Cashout</p>
          </div>
          <Input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
          <Button className="mt-3 w-full" onClick={submitCashout} disabled={submitting}>
            {submitting ? 'Processing...' : 'Cash Out Now'}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">Ensure payout account is set in Settings before cashing out.</p>
        </div>
      </div>

      <div className="rounded-xl border p-5">
        <h2 className="mb-3 font-semibold">Recent Cashouts</h2>
        <div className="space-y-2">
          {(summary?.recent_cashouts || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No cashouts yet.</p>
          ) : (
            summary!.recent_cashouts.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{item.currency} {Number(item.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <Badge variant="outline">{item.status}</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
