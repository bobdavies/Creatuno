import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/monime'

const PLATFORM_FEE_PERCENT = 5

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

    const supabase = await createServerClient()

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

    // Check if there's already an active escrow awaiting payment
    const { data: existingEscrow } = await supabase
      .from('delivery_escrows')
      .select('id, status, monime_checkout_session_id')
      .eq('submission_id', submission_id)
      .in('status', ['awaiting_payment', 'payment_received', 'payout_initiated', 'completed'])
      .limit(1)
      .maybeSingle()

    if (existingEscrow) {
      return NextResponse.json(
        { error: 'A payment is already in progress or completed for this submission' },
        { status: 409 }
      )
    }

    const agreedAmount = Number(application.proposed_budget)
    const paymentAmount = agreedAmount * (payment_percentage / 100)
    const platformFee = Math.round(paymentAmount * PLATFORM_FEE_PERCENT) / 100
    const netPayout = paymentAmount - platformFee
    const currency = application.opportunities?.currency || 'SLE'
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

    // Create Monime Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const checkoutName = payment_percentage === 100
      ? `Payment for "${oppTitle}"`
      : `50% Compensation for "${oppTitle}"`

    const session = await createCheckoutSession({
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
      cancelUrl: `${appUrl}/dashboard/employer/applications?payment=cancelled`,
    })

    // Update escrow with checkout session ID
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
