'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading02Icon,
  SparklesIcon,
} from '@hugeicons/core-free-icons'
import { MdAttachMoney } from 'react-icons/md'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'
import { formatCurrency } from '@/lib/currency'

const ease = [0.23, 1, 0.32, 1] as const

interface InvestmentData {
  id: string
  pitch_id: string
  amount: number
  currency: string
  net_payout_amount: number
  platform_fee: number
  status: string
  pitch: { title: string; category: string | null } | null
  recipient: { full_name: string; role: string } | null
}

export default function FundingSuccessPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'pending'
  const investmentId = searchParams.get('investment_id')

  const [investment, setInvestment] = useState<InvestmentData | null>(null)
  const [isLoading, setIsLoading] = useState(!!investmentId)
  const [pollCount, setPollCount] = useState(0)

  useEffect(() => {
    if (investmentId) {
      loadInvestment()
    }
  }, [investmentId])

  useEffect(() => {
    if (status === 'pending' && investmentId && pollCount < 10) {
      const timer = setTimeout(() => {
        loadInvestment()
        setPollCount(c => c + 1)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, investmentId, pollCount])

  const loadInvestment = async () => {
    try {
      const res = await fetch('/api/payments/investment-history')
      if (res.ok) {
        const data = await res.json()
        const found = (data.investments || []).find((i: any) => i.id === investmentId)
        if (found) setInvestment(found)
      }
    } catch { /* silent */ } finally {
      setIsLoading(false)
    }
  }

  const isSuccess = status === 'success'
  const isPending = status === 'pending'
  const isError = status === 'error'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="space-y-6"
        >
          {/* Status Icon */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex"
            >
              {isSuccess && (
                <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-14 h-14 text-green-500" />
                </div>
              )}
              {isPending && (
                <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto">
                  <HugeiconsIcon icon={Clock01Icon} className="w-14 h-14 text-orange-500" />
                </div>
              )}
              {isError && (
                <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                  <MdAttachMoney className="w-14 h-14 text-red-500" />
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ease }}
              className="mt-6"
            >
              <h1 className="text-2xl font-bold text-foreground">
                {isSuccess && 'Investment Successful!'}
                {isPending && 'Processing Investment...'}
                {isError && 'Investment Failed'}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                {isSuccess && 'Your pitch funding has been processed. The creator will receive their payout shortly.'}
                {isPending && 'Your payment is being verified. This usually takes a few seconds.'}
                {isError && 'Something went wrong with your payment. Please try again or contact support.'}
              </p>
            </motion.div>
          </div>

          {/* Investment Details */}
          {(isSuccess || isPending) && (investment || isLoading) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, ease }}
            >
              <SpotlightCard>
                <div className="p-6">
                  {isLoading && !investment ? (
                    <div className="flex items-center justify-center py-4">
                      <HugeiconsIcon icon={Loading02Icon} className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : investment ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount Invested</p>
                        <p className="text-3xl font-bold text-foreground mt-1">
                          {formatCurrency(investment.amount, investment.currency)}
                        </p>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-border/50">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Pitch</span>
                          <span className="font-medium text-foreground">{investment.pitch?.title || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Recipient</span>
                          <span className="font-medium text-foreground">{investment.recipient?.full_name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Platform Fee (5%)</span>
                          <span className="text-muted-foreground">{formatCurrency(investment.platform_fee, investment.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Creator Receives</span>
                          <span className="font-medium text-emerald-500">{formatCurrency(investment.net_payout_amount, investment.currency)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SpotlightCard>
            </motion.div>
          )}

          {/* Pending polling indicator */}
          {isPending && pollCount > 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={Loading02Icon} className="w-3 h-3 animate-spin" />
              Checking payment status...
            </div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, ease }}
            className="flex flex-col gap-3"
          >
            {isSuccess && investment?.pitch_id && (
              <Button className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-brand-dark" asChild>
                <Link href={`/pitch-stage/${investment.pitch_id}`}>
                  <HugeiconsIcon icon={SparklesIcon} className="w-4 h-4 mr-2" />
                  View Pitch
                </Link>
              </Button>
            )}

            <Button variant="outline" className="w-full rounded-xl" asChild>
              <Link href="/dashboard/investor">
                <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>

            {isSuccess && (
              <Button variant="outline" className="w-full rounded-xl text-xs" asChild>
                <Link href="/pitch-stage">Browse More Pitches</Link>
              </Button>
            )}

            {isError && (
              <Button variant="outline" className="w-full rounded-xl text-xs" asChild>
                <Link href="/pitch-stage">Try Again</Link>
              </Button>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
