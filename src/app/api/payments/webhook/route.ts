import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, createPayout, type PayoutDestination } from '@/lib/monime'
import { applyWalletMutation, creditWalletForSource, maskAccount, toWalletCurrency } from '@/lib/wallet'

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
  const webhookSecret = process.env.MONIME_WEBHOOK_SECRET
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && !webhookSecret) {
    console.error('Webhook rejected: MONIME_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

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

  // Idempotency guard for webhook replays
  if (payload.event?.id) {
    const { error: eventInsertError } = await supabase
      .from('payment_webhook_events')
      .insert({
        provider: 'monime',
        event_id: payload.event.id,
        event_name: eventName || 'unknown',
        object_id: payload.object?.id || null,
        payload: payload as unknown as Record<string, unknown>,
      })

    if (eventInsertError) {
      // Unique violation => already processed, return idempotent success.
      if ((eventInsertError as { code?: string }).code === '23505') {
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.error('Failed to record webhook event:', eventInsertError)
      return NextResponse.json({ error: 'Failed to persist webhook event' }, { status: 500 })
    }
  }

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

// ─── Checkout Completed ──────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { data: Record<string, unknown>; object: { id: string } }
) {
  const sessionId = payload.object?.id
  const metadata = (payload.data?.metadata || {}) as Record<string, string>

  // Route to pitch investment handler if metadata contains pitch_investment_id
  if (metadata.pitch_investment_id) {
    await handlePitchInvestmentCheckout(supabase, sessionId, metadata)
    return
  }

  const escrowId = metadata.escrow_id

  if (!escrowId) {
    console.error('No escrow_id in checkout session metadata:', sessionId)
    return
  }

  const { data: escrow, error } = await supabase
    .from('delivery_escrows')
    .select('*')
    .eq('id', escrowId)
    .single()

  if (error || !escrow) {
    console.error('Escrow not found for checkout:', escrowId, error)
    return
  }

  if (['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed'].includes(escrow.status)) {
    console.log('Escrow already processed:', escrowId)
    return
  }

  const isFullPayment = escrow.payment_percentage === 100

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
      .eq('id', escrow.submission_id)
  }

  const paymentType = isFullPayment ? 'full' : 'partial_50'
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('escrow_id', escrowId)
    .eq('payment_type', paymentType)
    .limit(1)
    .maybeSingle()

  if (!existingTx) {
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
      payment_type: paymentType,
      escrow_id: escrowId,
      status: 'completed',
    })
  }

  const payoutFlow = await triggerRecipientPayout(supabase, escrow.creative_id, escrow.net_payout_amount as number, (escrow.currency as string) || 'SLE', {
    escrow_id: escrowId,
    creative_id: escrow.creative_id,
  }, 'delivery_escrows', escrowId, escrow.payment_percentage === 100)

  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('title')
    .eq('id', escrow.opportunity_id)
    .single()

  const oppTitle = opportunity?.title || 'a project'

  await supabase.from('notifications').insert({
    user_id: escrow.employer_id,
    type: 'payment_completed',
    title: 'Payment Successful',
    message: isFullPayment
      ? `Your payment for "${oppTitle}" is complete. You now have full access to the delivered files.`
      : `Your 50% compensation payment for "${oppTitle}" is complete.`,
    data: { escrow_id: escrowId, submission_id: escrow.submission_id },
  })

  await supabase.from('notifications').insert({
    user_id: escrow.creative_id,
    type: 'payment_received',
    title: isFullPayment ? 'Payment Received!' : '50% Compensation Received',
    message: isFullPayment
      ? `The employer has paid for your work on "${oppTitle}". ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`
      : `You have received 50% compensation for your time on "${oppTitle}". ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`,
    data: { escrow_id: escrowId, submission_id: escrow.submission_id, amount: escrow.net_payout_amount },
  })
}

// ─── Pitch Investment Checkout ───────────────────────────────────────────────

async function handlePitchInvestmentCheckout(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  metadata: Record<string, string>
) {
  const investmentId = metadata.pitch_investment_id

  const { data: investment, error } = await supabase
    .from('pitch_investments')
    .select('*')
    .eq('id', investmentId)
    .single()

  if (error || !investment) {
    console.error('Pitch investment not found for checkout:', investmentId, error)
    return
  }

  if (['payment_received', 'payout_initiated', 'completed'].includes(investment.status)) {
    console.log('Pitch investment already processed:', investmentId)
    return
  }

  await supabase
    .from('pitch_investments')
    .update({ status: 'payment_received' })
    .eq('id', investmentId)

  // Update pitch total_funded
  const { data: pitch } = await supabase
    .from('pitches')
    .select('id, title, total_funded')
    .eq('id', investment.pitch_id)
    .single()

  if (pitch) {
    const { error: fundingError } = await supabase.rpc('increment_pitch_total_funded', {
      p_pitch_id: pitch.id,
      p_amount: Number(investment.amount),
    })
    if (fundingError) {
      console.error('Failed to increment pitch total_funded:', fundingError)
    }
  }

  // Create transaction record
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('pitch_investment_id', investmentId)
    .limit(1)
    .maybeSingle()

  if (!existingTx) {
    await supabase.from('transactions').insert({
      payer_id: investment.investor_id,
      payee_id: investment.recipient_id,
      amount: investment.amount,
      currency: investment.currency,
      platform_fee: investment.platform_fee,
      net_amount: investment.net_payout_amount,
      monime_checkout_session_id: sessionId,
      payment_type: 'pitch_investment',
      pitch_investment_id: investmentId,
      status: 'completed',
    })
  }

  // Trigger payout to recipient
  const payoutFlow = await triggerRecipientPayout(supabase, investment.recipient_id, Number(investment.net_payout_amount), investment.currency || 'SLE', {
    pitch_investment_id: investmentId,
    recipient_id: investment.recipient_id,
  }, 'pitch_investments', investmentId, true)

  const pitchTitle = pitch?.title || 'a pitch'

  // Notify investor
  await supabase.from('notifications').insert({
    user_id: investment.investor_id,
    type: 'investment_completed',
    title: 'Investment Successful!',
    message: `Your investment of ${investment.currency} ${investment.amount} in "${pitchTitle}" has been processed.`,
    data: { pitch_investment_id: investmentId, pitch_id: investment.pitch_id },
  })

  // Notify recipient
  await supabase.from('notifications').insert({
    user_id: investment.recipient_id,
    type: 'funding_received',
    title: 'Pitch Funding Received!',
    message: `An investor has funded "${pitchTitle}" with ${investment.currency} ${investment.amount}. ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`,
    data: { pitch_investment_id: investmentId, pitch_id: investment.pitch_id, amount: investment.net_payout_amount },
  })
}

// ─── Shared Payout Trigger ───────────────────────────────────────────────────

async function triggerRecipientPayout(
  supabase: ReturnType<typeof createAdminClient>,
  recipientId: string,
  payoutAmount: number,
  currency: string,
  payoutMetadata: Record<string, string>,
  tableName: 'delivery_escrows' | 'pitch_investments',
  recordId: string,
  isFullPayment: boolean
): Promise<'wallet' | 'auto' | 'none'> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_provider, payment_provider_id, payment_account, payout_mode')
    .eq('user_id', recipientId)
    .single()

  if (profile?.payout_mode === 'wallet') {
    try {
      const walletCurrency = toWalletCurrency(currency)
      await creditWalletForSource(
        supabase,
        recipientId,
        walletCurrency,
        payoutAmount,
        tableName === 'delivery_escrows' ? 'delivery_escrow' : 'pitch_investment',
        recordId,
        { table: tableName, record_id: recordId }
      )

      if (tableName === 'delivery_escrows') {
        await supabase
          .from('delivery_escrows')
          .update({
            status: isFullPayment ? 'completed' : 'partial_payout_completed',
          })
          .eq('id', recordId)
      } else {
        await supabase
          .from('pitch_investments')
          .update({
            status: 'completed',
            payout_status: 'completed',
          })
          .eq('id', recordId)
      }

      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'wallet_credited',
        title: 'Wallet Credited',
        message: `Your Creatuno wallet has been credited with ${walletCurrency} ${payoutAmount.toFixed(2)}.`,
        data: { record_id: recordId, table: tableName, amount: payoutAmount, currency: walletCurrency },
      })
      return 'wallet'
    } catch (error) {
      console.error('Wallet credit failed:', error)
      return 'none'
    }
  }

  if (!profile?.payment_provider || !profile?.payment_provider_id || !profile?.payment_account) {
    console.error('Recipient has no payment method configured:', recipientId)

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'payout_action_required',
      title: 'Payment Method Required',
      message: 'You have a pending payout but no payment method configured. Please add your payment details in Settings.',
      data: { record_id: recordId, table: tableName },
    })

    if (tableName === 'delivery_escrows') {
      const { data: esc } = await supabase
        .from('delivery_escrows')
        .select('employer_id')
        .eq('id', recordId)
        .single()
      if (esc?.employer_id) {
        await supabase.from('notifications').insert({
          user_id: esc.employer_id,
          type: 'payout_pending_action',
          title: 'Creative Payout Pending Setup',
          message: 'Payment succeeded, but creative payout is pending until the creative adds a valid payout account.',
          data: { escrow_id: recordId },
        })
      }
    }
    return 'none'
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

  console.info('Initiating payout', {
    recipientId,
    tableName,
    recordId,
    provider: profile.payment_provider,
    providerId: profile.payment_provider_id,
    accountMasked: maskAccount(profile.payment_account),
  })

  try {
    const payout = await createPayout({
      amount: payoutAmount,
      currency,
      destination,
      metadata: payoutMetadata,
    })

    if (tableName === 'delivery_escrows') {
      await supabase
        .from('delivery_escrows')
        .update({
          monime_payout_id: payout.id,
          status: isFullPayment ? 'payout_initiated' : 'partial_payment_received',
        })
        .eq('id', recordId)
      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'payout_initiated',
        title: 'Payout Initiated',
        message: `Your payout has been initiated to ${profile.payment_provider?.toUpperCase()} ${maskAccount(profile.payment_account)}.`,
        data: { escrow_id: recordId, monime_payout_id: payout.id, amount: payoutAmount, currency },
      })
    } else {
      await supabase
        .from('pitch_investments')
        .update({
          monime_payout_id: payout.id,
          status: 'payout_initiated',
          payout_status: 'initiated',
        })
        .eq('id', recordId)
      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'payout_initiated',
        title: 'Payout Initiated',
        message: `Your payout has been initiated to ${profile.payment_provider?.toUpperCase()} ${maskAccount(profile.payment_account)}.`,
        data: { pitch_investment_id: recordId, monime_payout_id: payout.id, amount: payoutAmount, currency },
      })
    }
    return 'auto'
  } catch (err) {
    console.error('Payout creation failed:', err)
    return 'none'
  }
}

// ─── Payout Completed ────────────────────────────────────────────────────────

async function handlePayoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { object: { id: string } }
) {
  const payoutId = payload.object?.id

  // Wallet cashout completion has highest priority for payout matching.
  const { data: cashout } = await supabase
    .from('cashout_requests')
    .select('*')
    .eq('monime_payout_id', payoutId)
    .single()

  if (cashout) {
    await applyWalletMutation(supabase, {
      userId: cashout.user_id,
      currency: cashout.currency || 'SLE',
      availableDelta: 0,
      pendingDelta: -Number(cashout.amount),
      entryType: 'debit',
      amount: Number(cashout.amount),
      sourceType: 'cashout_request',
      sourceId: cashout.id,
      idempotencyKey: `cashout:finalize:${cashout.id}`,
      metadata: { monime_payout_id: payoutId },
    })

    await supabase
      .from('cashout_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', cashout.id)

    await supabase.from('notifications').insert({
      user_id: cashout.user_id,
      type: 'cashout_completed',
      title: 'Cashout Complete',
      message: `Your cashout of ${cashout.currency} ${Number(cashout.amount).toFixed(2)} has been completed.`,
      data: { cashout_request_id: cashout.id, monime_payout_id: payoutId },
    })
    return
  }

  // Try escrow first
  const { data: escrow } = await supabase
    .from('delivery_escrows')
    .select('*')
    .eq('monime_payout_id', payoutId)
    .single()

  if (escrow) {
    const finalStatus = escrow.payment_percentage === 100 ? 'completed' : 'partial_payout_completed'

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
    return
  }

  // Try pitch investment
  const { data: investment } = await supabase
    .from('pitch_investments')
    .select('*')
    .eq('monime_payout_id', payoutId)
    .single()

  if (investment) {
    await supabase
      .from('pitch_investments')
      .update({ status: 'completed', payout_status: 'completed' })
      .eq('id', investment.id)

    await supabase.from('notifications').insert({
      user_id: investment.recipient_id,
      type: 'payout_completed',
      title: 'Payout Complete!',
      message: `Your pitch funding payout of ${investment.currency} ${investment.net_payout_amount} has been sent to your account.`,
      data: { pitch_investment_id: investment.id, amount: investment.net_payout_amount },
    })
    return
  }

  console.error('No escrow or pitch investment found for payout:', payoutId)
}

// ─── Payout Failed ───────────────────────────────────────────────────────────

async function handlePayoutFailed(
  supabase: ReturnType<typeof createAdminClient>,
  payload: { object: { id: string }; data: Record<string, unknown> }
) {
  const payoutId = payload.object?.id
  const failureDetail = payload.data?.failureDetail as { code?: string; message?: string } | undefined

  console.error('Payout failed:', payoutId, failureDetail)

  const { data: cashout } = await supabase
    .from('cashout_requests')
    .select('*')
    .eq('monime_payout_id', payoutId)
    .single()

  if (cashout) {
    await applyWalletMutation(supabase, {
      userId: cashout.user_id,
      currency: cashout.currency || 'SLE',
      availableDelta: Number(cashout.amount),
      pendingDelta: -Number(cashout.amount),
      entryType: 'release',
      amount: Number(cashout.amount),
      sourceType: 'cashout_request',
      sourceId: cashout.id,
      idempotencyKey: `cashout:rollback:${cashout.id}`,
      metadata: {
        monime_payout_id: payoutId,
        failure_code: failureDetail?.code || null,
        failure_message: failureDetail?.message || null,
      },
    })

    await supabase
      .from('cashout_requests')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: failureDetail?.message || failureDetail?.code || 'Payout failed',
      })
      .eq('id', cashout.id)

    await supabase.from('notifications').insert({
      user_id: cashout.user_id,
      type: 'cashout_failed',
      title: 'Cashout Failed',
      message: `Your cashout of ${cashout.currency} ${Number(cashout.amount).toFixed(2)} failed. Funds were returned to your wallet.`,
      data: {
        cashout_request_id: cashout.id,
        failure_code: failureDetail?.code,
        failure_message: failureDetail?.message,
      },
    })
    return
  }

  // Try escrow first
  const { data: escrow } = await supabase
    .from('delivery_escrows')
    .select('id, creative_id, net_payout_amount, currency')
    .eq('monime_payout_id', payoutId)
    .single()

  if (escrow) {
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
    return
  }

  // Try pitch investment
  const { data: investment } = await supabase
    .from('pitch_investments')
    .select('id, recipient_id, net_payout_amount, currency')
    .eq('monime_payout_id', payoutId)
    .single()

  if (investment) {
    await supabase
      .from('pitch_investments')
      .update({ payout_status: 'failed' })
      .eq('id', investment.id)

    await supabase.from('notifications').insert({
      user_id: investment.recipient_id,
      type: 'payout_failed',
      title: 'Payout Failed',
      message: `Your pitch funding payout of ${investment.currency} ${investment.net_payout_amount} failed. Please check your payment settings or contact support.`,
      data: {
        pitch_investment_id: investment.id,
        failure_code: failureDetail?.code,
        failure_message: failureDetail?.message,
      },
    })
  }
}
