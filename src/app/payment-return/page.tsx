import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

type FlowType = 'delivery' | 'pitch'
type ReturnStatus = 'success' | 'pending' | 'error'

function normalizeStatus(value: string | undefined): ReturnStatus {
  if (value === 'success' || value === 'pending' || value === 'error') return value
  return 'pending'
}

function normalizeFlow(value: string | undefined): FlowType {
  if (value === 'pitch') return 'pitch'
  return 'delivery'
}

function buildDestination(flow: FlowType, status: ReturnStatus, escrowId?: string, investmentId?: string): string {
  if (flow === 'pitch') {
    const qs = new URLSearchParams({ status })
    if (investmentId) qs.set('investment_id', investmentId)
    return `/pitch-stage/funding-success?${qs.toString()}`
  }

  const qs = new URLSearchParams({ payment: status })
  if (escrowId) qs.set('escrow_id', escrowId)
  return `/dashboard/employer/deliverables/success?${qs.toString()}`
}

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const status = normalizeStatus(typeof params.status === 'string' ? params.status : undefined)
  const flow = normalizeFlow(typeof params.flow === 'string' ? params.flow : undefined)
  const escrowId = typeof params.escrow_id === 'string' ? params.escrow_id : undefined
  const investmentId = typeof params.investment_id === 'string' ? params.investment_id : undefined

  const destination = buildDestination(flow, status, escrowId, investmentId)
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(destination)}`
  const { userId } = await auth()

  // When the user already has a valid session, continue directly to the intended screen.
  if (userId) {
    redirect(destination)
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">Payment Update</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your payment result has been received. Sign in to continue and finalize what you should see next.
        </p>

        <div className="space-y-2 text-sm mb-6">
          <p><span className="font-semibold text-foreground">Flow:</span> {flow}</p>
          <p><span className="font-semibold text-foreground">Status:</span> {status}</p>
          {escrowId && <p><span className="font-semibold text-foreground">Escrow ID:</span> {escrowId}</p>}
          {investmentId && <p><span className="font-semibold text-foreground">Investment ID:</span> {investmentId}</p>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={signInHref}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-600"
          >
            Sign In And Continue
          </Link>
          <Link
            href={destination}
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40"
          >
            Continue Without Sign In
          </Link>
        </div>
      </section>
    </main>
  )
}
