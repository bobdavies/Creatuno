import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { getCheckoutSession, createPayout, type PayoutDestination } from '@/lib/monime'

/**
 * GET /api/payments/success?escrow_id=...
 *
 * Monime redirects here after successful payment.
 * Verifies session status with Monime API and, if the webhook has not
 * yet processed the payment, applies the state mutations as a fallback.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const escrowId = searchParams.get('escrow_id')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!escrowId || !isSupabaseConfiguredServer()) {
    return NextResponse.redirect(`${appUrl}/dashboard/employer/applications?payment=error`)
  }

  try {
    const supabase = createAdminClient()

    const { data: escrow } = await supabase
      .from('delivery_escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (!escrow?.monime_checkout_session_id) {
      return NextResponse.redirect(`${appUrl}/dashboard/employer/applications?payment=error`)
    }

    const alreadyProcessed = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed'].includes(escrow.status)
    if (alreadyProcessed) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/employer/applications?payment=success&escrow_id=${escrowId}`
      )
    }

    try {
      const session = await getCheckoutSession(escrow.monime_checkout_session_id)

      if (session?.status === 'completed') {
        await processCompletedPayment(supabase, escrow)
        return NextResponse.redirect(
          `${appUrl}/dashboard/employer/applications?payment=success&escrow_id=${escrowId}`
        )
      }
    } catch (err) {
      console.error('Checkout session verification failed:', err)
    }

    return NextResponse.redirect(
      `${appUrl}/dashboard/employer/applications?payment=pending&escrow_id=${escrowId}`
    )
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/employer/applications?payment=error`)
  }
}

/**
 * Fallback processor: updates escrow, releases files, creates transaction,
 * and triggers payout when the webhook has not yet arrived.
 * Idempotent -- skips if escrow is already past awaiting_payment.
 */
async function processCompletedPayment(
  supabase: ReturnType<typeof createAdminClient>,
  escrow: Record<string, unknown>
) {
  const escrowId = escrow.id as string
  const isFullPayment = escrow.payment_percentage === 100

  const { data: freshEscrow } = await supabase
    .from('delivery_escrows')
    .select('status')
    .eq('id', escrowId)
    .single()

  const pendingStatuses = ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved']
  if (!freshEscrow || !pendingStatuses.includes(freshEscrow.status)) {
    return
  }

  await supabase
    .from('delivery_escrows')
    .update({
      status: isFullPayment ? 'payment_received' : 'partial_payment_received',
      files_released: isFullPayment,
    })
    .eq('id', escrowId)

  if (isFullPayment) {
    await supabase
      .from('work_submissions')
      .update({ status: 'approved' })
      .eq('id', escrow.submission_id as string)
  }

  await supabase.from('transactions').insert({
    opportunity_id: escrow.opportunity_id,
    application_id: escrow.application_id,
    payer_id: escrow.employer_id,
    payee_id: escrow.creative_id,
    amount: escrow.payment_amount,
    currency: escrow.currency,
    platform_fee: escrow.platform_fee,
    net_amount: escrow.net_payout_amount,
    monime_checkout_session_id: escrow.monime_checkout_session_id,
    payment_type: isFullPayment ? 'full' : 'partial_50',
    escrow_id: escrowId,
    status: 'completed',
  })

  const creativeId = escrow.creative_id as string

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_provider, payment_provider_id, payment_account')
    .eq('user_id', creativeId)
    .single()

  if (!profile?.payment_provider || !profile?.payment_provider_id || !profile?.payment_account) {
    await supabase.from('notifications').insert({
      user_id: creativeId,
      type: 'payout_action_required',
      title: 'Payment Method Required',
      message: 'You have a pending payout but no payment method configured. Please add your payment details in Settings.',
      data: { escrow_id: escrowId },
    })
    return
  }

  const destination: PayoutDestination = {
    type: profile.payment_provider as 'momo' | 'bank' | 'wallet',
    providerId: profile.payment_provider_id,
  }

  if (profile.payment_provider === 'momo') {
    destination.phoneNumber = profile.payment_account
  } else if (profile.payment_provider === 'bank') {
    destination.accountNumber = profile.payment_account
  } else if (profile.payment_provider === 'wallet') {
    destination.walletId = profile.payment_account
  }

  try {
    const payout = await createPayout({
      amount: escrow.net_payout_amount as number,
      currency: (escrow.currency as string) || 'SLE',
      destination,
      metadata: { escrow_id: escrowId, creative_id: creativeId },
    })

    await supabase
      .from('delivery_escrows')
      .update({
        monime_payout_id: payout.id,
        status: isFullPayment ? 'payout_initiated' : 'partial_payment_received',
      })
      .eq('id', escrowId)
  } catch (err) {
    console.error('Payout initiation failed in success route:', err)
  }

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('title')
    .eq('id', escrow.opportunity_id as string)
    .single()

  const oppTitle = opportunity?.title || 'a project'

  await supabase.from('notifications').insert([
    {
      user_id: escrow.employer_id,
      type: 'payment_completed',
      title: 'Payment Successful',
      message: isFullPayment
        ? `Your payment for "${oppTitle}" is complete. You now have full access to the delivered files.`
        : `Your 50% compensation payment for "${oppTitle}" is complete.`,
      data: { escrow_id: escrowId, submission_id: escrow.submission_id },
    },
    {
      user_id: creativeId,
      type: 'payment_received',
      title: isFullPayment ? 'Payment Received!' : '50% Compensation Received',
      message: isFullPayment
        ? `The employer has paid for your work on "${oppTitle}". Payout is being processed.`
        : `You have received 50% compensation for your time on "${oppTitle}". Payout is being processed.`,
      data: { escrow_id: escrowId, submission_id: escrow.submission_id, amount: escrow.net_payout_amount },
    },
  ])
}
