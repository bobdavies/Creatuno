'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Download01Icon,
  Loading02Icon,
  LockIcon,
  PackageIcon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'

interface EscrowData {
  escrow: {
    id: string
    status: string
    payment_amount: number
    payment_percentage: number
    currency: string
    files_released: boolean
    agreed_amount: number
    creative_id: string
    employer_id: string
    submission_id: string
    opportunity_id: string
    created_at: string
  } | null
  payment_status: string
  files_released: boolean
  payment_amount?: number
  payment_percentage?: number
  currency?: string
}

const ease = [0.23, 1, 0.32, 1] as const
const COMPLETED_STATUSES = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed']

function ConfettiPiece({ delay, x }: { delay: number; x: number }) {
  const colors = ['#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#ec4899', '#f97316']
  const color = useMemo(() => colors[Math.floor(Math.random() * colors.length)], [])
  const size = useMemo(() => 6 + Math.random() * 8, [])
  const rotation = useMemo(() => Math.random() * 360, [])

  return (
    <motion.div
      initial={{ y: -20, x, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: 600, opacity: 0, rotate: rotation + 720, scale: 0.3 }}
      transition={{ duration: 2.5 + Math.random() * 1.5, delay, ease: 'easeOut' }}
      className="absolute top-0 pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
    />
  )
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentStatus = searchParams.get('payment')
  const escrowId = searchParams.get('escrow_id')

  const [escrowData, setEscrowData] = useState<EscrowData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showUnlock, setShowUnlock] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [resolvedSuccess, setResolvedSuccess] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSuccess = paymentStatus === 'success' || resolvedSuccess
  const isPending = paymentStatus === 'pending' && !resolvedSuccess
  const isError = paymentStatus === 'error'

  const fetchEscrowData = useCallback(async () => {
    if (!escrowId) return null
    try {
      const res = await fetch(`/api/payments/status?escrow_id=${escrowId}`)
      if (res.ok) {
        const data: EscrowData = await res.json()
        setEscrowData(data)
        return data
      }
    } catch { /* silent */ }
    return null
  }, [escrowId])

  useEffect(() => {
    if (escrowId) {
      fetchEscrowData().then(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [escrowId, fetchEscrowData])

  useEffect(() => {
    if (!isPending || !escrowId) return

    const poll = async () => {
      const data = await fetchEscrowData()
      if (data?.escrow && COMPLETED_STATUSES.includes(data.escrow.status)) {
        setResolvedSuccess(true)
        return
      }
      setPollCount(c => c + 1)
      if (pollCount < 10) {
        pollRef.current = setTimeout(poll, 3000)
      }
    }

    pollRef.current = setTimeout(poll, 3000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [isPending, escrowId, pollCount, fetchEscrowData])

  useEffect(() => {
    if (isSuccess && !isLoading) {
      setShowConfetti(true)
      const unlockTimer = setTimeout(() => setShowUnlock(true), 1200)
      const confettiTimer = setTimeout(() => setShowConfetti(false), 4000)
      return () => { clearTimeout(unlockTimer); clearTimeout(confettiTimer) }
    }
  }, [isSuccess, isLoading])

  const confettiPieces = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.8,
      x: -50 + Math.random() * 400,
    })),
    []
  )

  const escrow = escrowData?.escrow
  const paidDate = escrow?.created_at
    ? new Date(escrow.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 animate-spin text-brand-purple-600 dark:text-brand-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">

      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
            {confettiPieces.map(p => (
              <ConfettiPiece key={p.id} delay={p.delay} x={p.x} />
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease }}
        className="w-full max-w-md"
      >
        {isSuccess && (
          <SpotlightCard className="overflow-hidden">
            <div className="p-6 sm:p-8 text-center">

              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center"
              >
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-10 h-10 text-emerald-500" />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                Payment Complete!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-sm text-muted-foreground mb-6"
              >
                The creative has been notified and files are now available for download.
              </motion.p>

              {escrow && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="p-4 rounded-xl bg-muted/30 border border-border/30 mb-6 text-left space-y-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center mb-3">Transaction Receipt</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-bold text-foreground">
                      {escrow.currency || 'SLE'} {escrow.payment_amount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Type</span>
                    <span className="text-foreground">
                      {escrow.payment_percentage === 100 ? 'Full Payment' : `${escrow.payment_percentage}% Partial`}
                    </span>
                  </div>
                  {paidDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="text-foreground text-xs">{paidDate}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-emerald-500 font-semibold text-xs">Completed</span>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="mb-6"
              >
                <AnimatePresence mode="wait">
                  {!showUnlock ? (
                    <motion.div
                      key="locked"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="p-5 rounded-xl bg-muted/20 border border-border/50"
                    >
                      <HugeiconsIcon icon={LockIcon} className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">Unlocking files...</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="unlocked"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
                    >
                      <motion.div initial={{ rotate: -10 }} animate={{ rotate: 0 }} transition={{ type: 'spring', stiffness: 200 }}>
                        <HugeiconsIcon icon={PackageIcon} className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                      </motion.div>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Files Unlocked!</p>
                      <p className="text-xs text-muted-foreground">
                        Original files are now available for download on the deliverables page.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-2" asChild>
                  <Link href="/dashboard/employer/deliverables">
                    <HugeiconsIcon icon={Download01Icon} className="w-4 h-4" />
                    View Deliverables
                  </Link>
                </Button>
                <Button variant="outline" className="flex-1 rounded-lg" asChild>
                  <Link href="/dashboard/employer/payments">
                    <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4 mr-1" />
                    Payment History
                  </Link>
                </Button>
              </motion.div>
            </div>
          </SpotlightCard>
        )}

        {isPending && (
          <SpotlightCard className="overflow-hidden">
            <div className="p-6 sm:p-8 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 mx-auto mb-5 rounded-full bg-brand-500/10 flex items-center justify-center"
              >
                <HugeiconsIcon icon={Loading02Icon} className="w-8 h-8 text-brand-500" />
              </motion.div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Payment Processing</h1>
              <p className="text-sm text-muted-foreground mb-2">
                Your payment is being verified. This usually takes just a moment.
              </p>
              {pollCount > 0 && (
                <p className="text-xs text-muted-foreground/60 mb-6">
                  Checking status... ({pollCount}/10)
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                {pollCount >= 10 && (
                  <Button
                    onClick={() => { setPollCount(0) }}
                    className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark gap-2"
                  >
                    <HugeiconsIcon icon={Refresh01Icon} className="w-4 h-4" />
                    Retry
                  </Button>
                )}
                <Button variant="outline" className="flex-1 rounded-lg" asChild>
                  <Link href="/dashboard/employer/deliverables">
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
                    Back to Deliverables
                  </Link>
                </Button>
              </div>
            </div>
          </SpotlightCard>
        )}

        {isError && (
          <SpotlightCard className="overflow-hidden">
            <div className="p-6 sm:p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-3xl">!</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Payment Issue</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Something went wrong with your payment. Please check your deliverables page for the current status.
              </p>
              <Button className="rounded-lg bg-brand-500 hover:bg-brand-600 text-brand-dark" asChild>
                <Link href="/dashboard/employer/deliverables">
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
                  Back to Deliverables
                </Link>
              </Button>
            </div>
          </SpotlightCard>
        )}

        {!isSuccess && !isPending && !isError && (
          <SpotlightCard className="overflow-hidden">
            <div className="p-6 sm:p-8 text-center">
              <h1 className="text-xl font-bold text-foreground mb-2">Nothing to show</h1>
              <p className="text-sm text-muted-foreground mb-6">No payment information found.</p>
              <Button variant="outline" className="rounded-lg" asChild>
                <Link href="/dashboard/employer/deliverables">Back to Deliverables</Link>
              </Button>
            </div>
          </SpotlightCard>
        )}
      </motion.div>
    </div>
  )
}
