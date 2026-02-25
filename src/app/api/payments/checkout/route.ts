import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/monime'
import { normalizeCurrency, DEFAULT_CURRENCY } from '@/lib/currency'
import { randomUUID } from 'crypto'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PLATFORM_FEE_PERCENT = 5
const MAX_PAYMENT_AMOUNT = 1_000_000

function isDevBypass(): boolean {
  if (process.env.MONIME_DEV_BYPASS === 'true') return true
  if (process.env.NODE_ENV === 'development' && process.env.MONIME_ACCESS_TOKEN?.startsWith('mon_test_')) return true
  return false
}

function isValidMoneyAmount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_PAYMENT_AMOUNT
    && Math.round(value * 100) === value * 100
}

/**
 * POST /api/payments/checkout
 *
 * Creates a Monime checkout session for an employer to pay a creative.
 * Body: { submission_id: string, payment_percentage: 100 | 50 }
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { submission_id, payment_percentage = 100 } = body

    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })
    }

    if (![100, 50].includes(payment_percentage)) {
      return NextResponse.json({ error: 'payment_percentage must be 100 or 50' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch submission with application and opportunity
    const { data: submission, error: subError } = await supabase
      .from('work_submissions')
      .select(`
        id, employer_id, creative_id, application_id, opportunity_id, status,
        applications:application_id (
          id, proposed_budget,
          opportunities:opportunity_id (
            id, title, currency
          )
        )
      `)
      .eq('id', submission_id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (submission.employer_id !== userId) {
      return NextResponse.json({ error: 'Only the employer can initiate payment' }, { status: 403 })
    }

    const application = submission.applications as unknown as {
      id: string
      proposed_budget: number
      opportunities: { id: string; title: string; currency: string }
    }

    if (!application?.proposed_budget) {
      return NextResponse.json({ error: 'No proposed budget found on application' }, { status: 400 })
    }

    // Check for existing escrows on this submission
    const { data: existingEscrows } = await supabase
      .from('delivery_escrows')
      .select('id, status, monime_checkout_session_id')
      .eq('submission_id', submission_id)

    const completedStatuses = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed']
    const completedEscrow = existingEscrows?.find(e => completedStatuses.includes(e.status))
    if (completedEscrow) {
      return NextResponse.json(
        { error: 'A payment is already completed for this submission' },
        { status: 409 }
      )
    }

    // Clean up any stale/pending escrows so a fresh one can be created
    const staleStatuses = ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved']
    const staleEscrows = existingEscrows?.filter(e => staleStatuses.includes(e.status)) || []
    if (staleEscrows.length > 0) {
      await supabase
        .from('delivery_escrows')
        .delete()
        .in('id', staleEscrows.map(e => e.id))
    }

    const agreedAmount = Number(application.proposed_budget)
    const paymentAmount = agreedAmount * (payment_percentage / 100)
    if (!isValidMoneyAmount(paymentAmount)) {
      return NextResponse.json({ error: 'Calculated payment amount is invalid' }, { status: 400 })
    }
    const platformFee = Math.round(paymentAmount * PLATFORM_FEE_PERCENT) / 100
    const netPayout = paymentAmount - platformFee
    const currency = normalizeCurrency(application.opportunities?.currency) || DEFAULT_CURRENCY
    const oppTitle = application.opportunities?.title || 'Creative Work'

    // Create escrow record
    const escrowStatus = payment_percentage === 100
      ? 'awaiting_payment'
      : 'revision_exhausted_awaiting_payment'

    const { data: escrow, error: escrowError } = await supabase
      .from('delivery_escrows')
      .insert({
        submission_id,
        application_id: submission.application_id,
        opportunity_id: submission.opportunity_id,
        creative_id: submission.creative_id,
        employer_id: submission.employer_id,
        agreed_amount: agreedAmount,
        payment_amount: paymentAmount,
        payment_percentage,
        currency,
        platform_fee: platformFee,
        net_payout_amount: netPayout,
        status: escrowStatus,
      })
      .select()
      .single()

    if (escrowError || !escrow) {
      console.error('Error creating escrow:', escrowError)
      return NextResponse.json({ error: 'Failed to create payment escrow' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const checkoutName = payment_percentage === 100
      ? `Payment for "${oppTitle}"`
      : `50% Compensation for "${oppTitle}"`

    // --- Dev bypass: simulate checkout locally without calling Monime ---
    if (isDevBypass()) {
      console.warn('[DEV BYPASS] Simulating Monime checkout session — no real payment will occur')
      const devSessionId = `dev_session_${randomUUID()}`

      await supabase
        .from('delivery_escrows')
        .update({
          monime_checkout_session_id: devSessionId,
          monime_order_number: `DEV-${Date.now()}`,
        })
        .eq('id', escrow.id)

      const devRedirectUrl = `${appUrl}/api/payments/dev-success?escrow_id=${escrow.id}`

      return NextResponse.json({
        redirectUrl: devRedirectUrl,
        sessionId: devSessionId,
        escrowId: escrow.id,
        paymentAmount,
        currency,
      })
    }

    // --- Production: create real Monime checkout session ---
    let session
    try {
      session = await createCheckoutSession({
        name: checkoutName,
        description: payment_percentage === 100
          ? `Full payment for creative work on "${oppTitle}"`
          : `Mandatory 50% compensation for creative's time on "${oppTitle}"`,
        amount: paymentAmount,
        currency,
        reference: escrow.id,
        metadata: {
          escrow_id: escrow.id,
          submission_id,
          creative_id: submission.creative_id,
          employer_id: submission.employer_id,
          payment_percentage: String(payment_percentage),
        },
        successUrl: `${appUrl}/api/payments/success?escrow_id=${escrow.id}`,
        cancelUrl: `${appUrl}/dashboard/employer/deliverables?payment=cancelled`,
      })
    } catch (monimeError) {
      console.error('Monime checkout session creation failed:', monimeError)
      await supabase.from('delivery_escrows').delete().eq('id', escrow.id)
      return NextResponse.json(
        { error: `Payment provider error: ${monimeError instanceof Error ? monimeError.message : 'Unknown error'}` },
        { status: 502 }
      )
    }

    if (!session?.redirectUrl) {
      console.error('Monime returned no redirectUrl:', session)
      await supabase.from('delivery_escrows').delete().eq('id', escrow.id)
      return NextResponse.json(
        { error: 'Payment provider did not return a checkout URL. Please try again.' },
        { status: 502 }
      )
    }

    await supabase
      .from('delivery_escrows')
      .update({
        monime_checkout_session_id: session.id,
        monime_order_number: session.orderNumber,
      })
      .eq('id', escrow.id)

    return NextResponse.json({
      redirectUrl: session.redirectUrl,
      sessionId: session.id,
      escrowId: escrow.id,
      paymentAmount,
      currency,
    })
  } catch (error) {
    console.error('Error in payments/checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
