import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { getCheckoutSession, createPayout, type PayoutDestination } from '@/lib/monime'
import { buildPayoutDestinationFromProfile, creditWalletForSource, maskAccount, toWalletCurrency } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COMPLETED_SESSION_STATUSES = ['completed', 'paid', 'complete', 'successful', 'captured']

function buildReturnUrl(appUrl: string, status: 'success' | 'pending' | 'error', escrowId?: string): string {
  const params = new URLSearchParams({
    flow: 'delivery',
    status,
  })
  if (escrowId) params.set('escrow_id', escrowId)
  return `${appUrl}/payment-return?${params.toString()}`
}

function redirectSeeOther(url: string): NextResponse {
  return NextResponse.redirect(url, { status: 303 })
}

function approximatelyEqual(left: number, right: number, epsilon = 0.01): boolean {
  return Math.abs(left - right) <= epsilon
}

function extractSessionAmount(session: Record<string, unknown>): number | null {
  const amountObj = session.amount as Record<string, unknown> | undefined
  const amountValue = typeof amountObj?.value === 'number' ? amountObj.value : null
  if (amountValue !== null) {
    // Monime typically returns minor units
    return amountValue / 100
  }

  const lineItems = Array.isArray(session.lineItems) ? session.lineItems as Record<string, unknown>[] : []
  const firstItem = lineItems[0]
  const price = firstItem?.price as Record<string, unknown> | undefined
  const lineValue = typeof price?.value === 'number' ? price.value : null
  if (lineValue !== null) {
    return lineValue / 100
  }

  return null
}

function extractSessionCurrency(session: Record<string, unknown>): string | null {
  const amountObj = session.amount as Record<string, unknown> | undefined
  if (typeof amountObj?.currency === 'string') return amountObj.currency

  const lineItems = Array.isArray(session.lineItems) ? session.lineItems as Record<string, unknown>[] : []
  const firstItem = lineItems[0]
  const price = firstItem?.price as Record<string, unknown> | undefined
  if (typeof price?.currency === 'string') return price.currency

  return null
}

function extractEscrowReference(session: Record<string, unknown>): string | null {
  if (typeof session.reference === 'string') return session.reference

  const metadata = session.metadata as Record<string, unknown> | undefined
  if (typeof metadata?.escrow_id === 'string') return metadata.escrow_id

  return null
}

/**
 * GET|POST /api/payments/success?escrow_id=...
 *
 * Monime redirects here after successful payment (may use GET or POST).
 * Verifies session status with Monime API and, if the webhook has not
 * yet processed the payment, applies the state mutations as a fallback.
 */
async function handleSuccess(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const escrowId = searchParams.get('escrow_id')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!escrowId || !isSupabaseConfiguredServer()) {
    return redirectSeeOther(buildReturnUrl(appUrl, 'error'))
  }

  try {
    const supabase = createAdminClient()

    const { data: escrow } = await supabase
      .from('delivery_escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (!escrow?.monime_checkout_session_id) {
      return redirectSeeOther(buildReturnUrl(appUrl, 'error', escrowId))
    }

    const alreadyProcessed = ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed'].includes(escrow.status)
    if (alreadyProcessed) {
      return redirectSeeOther(buildReturnUrl(appUrl, 'success', escrowId))
    }

    let sessionVerified = false
    try {
      const session = await getCheckoutSession(escrow.monime_checkout_session_id) as Record<string, unknown>
      const status = typeof session?.status === 'string' ? session.status.toLowerCase() : null
      const sessionAmount = session ? extractSessionAmount(session) : null
      const sessionCurrency = session ? extractSessionCurrency(session) : null
      const reference = session ? extractEscrowReference(session) : null

      const statusValid = !!status && COMPLETED_SESSION_STATUSES.includes(status)
      const amountValid = typeof sessionAmount === 'number' &&
        approximatelyEqual(sessionAmount, Number(escrow.payment_amount))
      const currencyValid = typeof sessionCurrency === 'string' &&
        sessionCurrency.toUpperCase() === String(escrow.currency || 'SLE').toUpperCase()
      const referenceValid = reference === escrowId

      sessionVerified = statusValid && amountValid && currencyValid && referenceValid
    } catch (err) {
      console.error('[Payment Success] Checkout session verification failed:', err)
    }

    if (sessionVerified) {
      await processCompletedPayment(supabase, escrow)
      return redirectSeeOther(buildReturnUrl(appUrl, 'success', escrowId))
    }

    return redirectSeeOther(buildReturnUrl(appUrl, 'pending', escrowId))
  } catch {
    return redirectSeeOther(buildReturnUrl(appUrl, 'error', escrowId))
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
      monime_checkout_session_id: escrow.monime_checkout_session_id,
      payment_type: paymentType,
      escrow_id: escrowId,
      status: 'completed',
    })
  }

  const creativeId = escrow.creative_id as string

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_provider, payment_provider_id, payment_account, payout_mode')
    .eq('user_id', creativeId)
    .single()

  let payoutFlow: 'wallet' | 'auto' | 'none' = 'none'
  if (profile?.payout_mode === 'wallet') {
    const walletCurrency = toWalletCurrency((escrow.currency as string) || 'SLE')
    try {
      await creditWalletForSource(
        supabase,
        creativeId,
        walletCurrency,
        Number(escrow.net_payout_amount),
        'delivery_escrow',
        escrowId,
        { source: 'success_fallback', is_full_payment: isFullPayment }
      )

      await supabase
        .from('delivery_escrows')
        .update({ status: isFullPayment ? 'completed' : 'partial_payout_completed' })
        .eq('id', escrowId)

      await supabase.from('notifications').insert({
        user_id: creativeId,
        type: 'wallet_credited',
        title: 'Wallet Credited',
        message: `Your Creatuno wallet has been credited with ${walletCurrency} ${Number(escrow.net_payout_amount).toFixed(2)}.`,
        data: { escrow_id: escrowId, amount: escrow.net_payout_amount, currency: walletCurrency },
      })
      payoutFlow = 'wallet'
    } catch (error) {
      console.error('Wallet credit failed in success route:', error)
    }
  } else if (!profile?.payment_provider || !profile?.payment_provider_id || !profile?.payment_account) {
    await supabase.from('notifications').insert({
      user_id: creativeId,
      type: 'payout_action_required',
      title: 'Payment Method Required',
      message: 'You have a pending payout but no payment method configured. Please add your payment details in Settings.',
      data: { escrow_id: escrowId },
    })
    payoutFlow = 'none'
  } else {
    const destination = buildPayoutDestinationFromProfile(profile) as PayoutDestination | null
    if (!destination) {
      payoutFlow = 'none'
    } else {
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

        await supabase.from('notifications').insert({
          user_id: creativeId,
          type: 'payout_initiated',
          title: 'Payout Initiated',
          message: `Your payout has been initiated to ${profile.payment_provider?.toUpperCase()} ${maskAccount(profile.payment_account)}.`,
          data: { escrow_id: escrowId, monime_payout_id: payout.id, amount: escrow.net_payout_amount, currency: escrow.currency },
        })
        payoutFlow = 'auto'
      } catch (err) {
        console.error('Payout initiation failed in success route:', err)
      }
    }
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
        ? `The employer has paid for your work on "${oppTitle}". ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`
        : `You have received 50% compensation for your time on "${oppTitle}". ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`,
      data: { escrow_id: escrowId, submission_id: escrow.submission_id, amount: escrow.net_payout_amount },
    },
  ])
}

export async function GET(request: NextRequest) {
  return handleSuccess(request)
}

export async function POST(request: NextRequest) {
  return handleSuccess(request)
}
