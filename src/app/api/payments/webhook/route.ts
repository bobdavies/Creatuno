import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, createPayout, type PayoutDestination } from '@/lib/monime'

/**
 * POST /api/payments/webhook
 *
 * Handles Monime webhook events. This is the authoritative source
 * for payment state transitions.
 *
 * Events handled:
 *  - checkout_session.completed -> mark payment received, release files, trigger payout
 *  - payout.completed          -> mark payout complete, notify creative
 *  - payout.failed             -> log error, notify admin
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-monime-signature') || ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('Webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    event: { name: string; id: string }
    object: { id: string; type: string }
    data: Record<string, unknown>
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = payload.event?.name
  const supabase = createAdminClient()

  try {
    switch (eventName) {
      case 'checkout_session.completed':
        await handleCheckoutCompleted(supabase, payload)
        break
      case 'payout.completed':
        await handlePayoutCompleted(supabase, payload)
        break
      case 'payout.failed':
        await handlePayoutFailed(supabase, payload)
        break
      case 'payout.delayed':
        console.warn('Payout delayed:', payload.object?.id)
        break
      default:
        console.log('Unhandled webhook event:', eventName)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { data: Record<string, unknown>; object: { id: string } }
) {
  const sessionId = payload.object?.id
  const metadata = (payload.data?.metadata || {}) as Record<string, string>
  const escrowId = metadata.escrow_id

  if (!escrowId) {
    console.error('No escrow_id in checkout session metadata:', sessionId)
    return
  }

  // Look up escrow
  const { data: escrow, error } = await supabase
    .from('delivery_escrows')
    .select('*')
    .eq('id', escrowId)
    .single()

  if (error || !escrow) {
    console.error('Escrow not found for checkout:', escrowId, error)
    return
  }

  // Prevent double-processing
  if (['payment_received', 'payout_initiated', 'completed'].includes(escrow.status)) {
    console.log('Escrow already processed:', escrowId)
    return
  }

  const isFullPayment = escrow.payment_percentage === 100

  // Update escrow status
  await supabase
    .from('delivery_escrows')
    .update({
      status: isFullPayment ? 'payment_received' : 'partial_payment_received',
      files_released: isFullPayment,
    })
    .eq('id', escrowId)

  // Update work submission status
  if (isFullPayment) {
    await supabase
      .from('work_submissions')
      .update({ status: 'approved' })
      .eq('id', escrow.submission_id)
  }

  // Create transaction record
  await supabase.from('transactions').insert({
    opportunity_id: escrow.opportunity_id,
    application_id: escrow.application_id,
    payer_id: escrow.employer_id,
    payee_id: escrow.creative_id,
    amount: escrow.payment_amount,
    currency: escrow.currency,
    platform_fee: escrow.platform_fee,
    net_amount: escrow.net_payout_amount,
    monime_checkout_session_id: sessionId,
    payment_type: isFullPayment ? 'full' : 'partial_50',
    escrow_id: escrowId,
    status: 'completed',
  })

  // Trigger payout to creative
  await triggerCreativePayout(supabase, escrow)

  // Notify both parties
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('title')
    .eq('id', escrow.opportunity_id)
    .single()

  const oppTitle = opportunity?.title || 'a project'

  // Notify employer
  await supabase.from('notifications').insert({
    user_id: escrow.employer_id,
    type: 'payment_completed',
    title: 'Payment Successful',
    message: isFullPayment
      ? `Your payment for "${oppTitle}" is complete. You now have full access to the delivered files.`
      : `Your 50% compensation payment for "${oppTitle}" is complete.`,
    data: { escrow_id: escrowId, submission_id: escrow.submission_id },
  })

  // Notify creative
  await supabase.from('notifications').insert({
    user_id: escrow.creative_id,
    type: 'payment_received',
    title: isFullPayment ? 'Payment Received!' : '50% Compensation Received',
    message: isFullPayment
      ? `The employer has paid for your work on "${oppTitle}". Payout is being processed.`
      : `You have received 50% compensation for your time on "${oppTitle}". Payout is being processed.`,
    data: { escrow_id: escrowId, submission_id: escrow.submission_id, amount: escrow.net_payout_amount },
  })
}

async function triggerCreativePayout(
  supabase: ReturnType<typeof createAdminClient>,
  escrow: Record<string, unknown>
) {
  const creativeId = escrow.creative_id as string
  const escrowId = escrow.id as string

  // Get creative's payment method
  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_provider, payment_provider_id, payment_account')
    .eq('user_id', creativeId)
    .single()

  if (!profile?.payment_provider || !profile?.payment_provider_id || !profile?.payment_account) {
    console.error('Creative has no payment method configured:', creativeId)
    // Still mark as payout_initiated but log the issue
    await supabase
      .from('delivery_escrows')
      .update({ status: escrow.payment_percentage === 100 ? 'payment_received' : 'partial_payment_received' })
      .eq('id', escrowId)

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
      metadata: {
        escrow_id: escrowId,
        creative_id: creativeId,
      },
    })

    await supabase
      .from('delivery_escrows')
      .update({
        monime_payout_id: payout.id,
        status: escrow.payment_percentage === 100 ? 'payout_initiated' : 'partial_payment_received',
      })
      .eq('id', escrowId)
  } catch (err) {
    console.error('Payout creation failed:', err)
  }
}

async function handlePayoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { object: { id: string } }
) {
  const payoutId = payload.object?.id

  const { data: escrow } = await supabase
    .from('delivery_escrows')
    .select('*')
    .eq('monime_payout_id', payoutId)
    .single()

  if (!escrow) {
    console.error('Escrow not found for payout:', payoutId)
    return
  }

  const finalStatus = escrow.payment_percentage === 100
    ? 'completed'
    : 'partial_payout_completed'

  await supabase
    .from('delivery_escrows')
    .update({ status: finalStatus })
    .eq('id', escrow.id)

  await supabase.from('notifications').insert({
    user_id: escrow.creative_id,
    type: 'payout_completed',
    title: 'Payout Complete!',
    message: `Your payout of ${escrow.currency} ${escrow.net_payout_amount} has been sent to your account.`,
    data: { escrow_id: escrow.id, amount: escrow.net_payout_amount },
  })
}

async function handlePayoutFailed(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { object: { id: string }; data: Record<string, unknown> }
) {
  const payoutId = payload.object?.id
  const failureDetail = payload.data?.failureDetail as { code?: string; message?: string } | undefined

  console.error('Payout failed:', payoutId, failureDetail)

  const { data: escrow } = await supabase
    .from('delivery_escrows')
    .select('id, creative_id, net_payout_amount, currency')
    .eq('monime_payout_id', payoutId)
    .single()

  if (!escrow) return

  await supabase.from('notifications').insert({
    user_id: escrow.creative_id,
    type: 'payout_failed',
    title: 'Payout Failed',
    message: `Your payout of ${escrow.currency} ${escrow.net_payout_amount} failed. Please check your payment settings or contact support.`,
    data: {
      escrow_id: escrow.id,
      failure_code: failureDetail?.code,
      failure_message: failureDetail?.message,
    },
  })
}
