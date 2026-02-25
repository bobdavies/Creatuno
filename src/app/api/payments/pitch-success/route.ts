import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { getCheckoutSession, createPayout, type PayoutDestination } from '@/lib/monime'
import { buildPayoutDestinationFromProfile, creditWalletForSource, maskAccount, toWalletCurrency } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const COMPLETED_SESSION_STATUSES = ['completed', 'paid', 'complete', 'successful', 'captured']

function buildReturnUrl(appUrl: string, status: 'success' | 'pending' | 'error', investmentId?: string): string {
  const params = new URLSearchParams({
    flow: 'pitch',
    status,
  })
  if (investmentId) params.set('investment_id', investmentId)
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
  if (amountValue !== null) return amountValue / 100

  const lineItems = Array.isArray(session.lineItems) ? session.lineItems as Record<string, unknown>[] : []
  const firstItem = lineItems[0]
  const price = firstItem?.price as Record<string, unknown> | undefined
  const lineValue = typeof price?.value === 'number' ? price.value : null
  if (lineValue !== null) return lineValue / 100

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

function extractInvestmentReference(session: Record<string, unknown>): string | null {
  if (typeof session.reference === 'string') return session.reference

  const metadata = session.metadata as Record<string, unknown> | undefined
  if (typeof metadata?.pitch_investment_id === 'string') return metadata.pitch_investment_id

  return null
}

/**
 * GET /api/payments/pitch-success?investment_id=...
 *
 * Monime redirects here after successful pitch funding payment.
 * Verifies session status and applies state mutations as fallback
 * if the webhook hasn't arrived yet.
 */
async function handlePitchSuccess(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const investmentId = searchParams.get('investment_id')
  const isDev = searchParams.get('dev') === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!investmentId || !isSupabaseConfiguredServer()) {
    return redirectSeeOther(buildReturnUrl(appUrl, 'error'))
  }

  try {
    const supabase = createAdminClient()

    const { data: investment } = await supabase
      .from('pitch_investments')
      .select('*')
      .eq('id', investmentId)
      .single()

    if (!investment) {
      return redirectSeeOther(buildReturnUrl(appUrl, 'error', investmentId))
    }

    const alreadyProcessed = ['payment_received', 'payout_initiated', 'completed'].includes(investment.status)
    if (alreadyProcessed) {
      return redirectSeeOther(buildReturnUrl(appUrl, 'success', investmentId))
    }

    let sessionVerified = false

    if (isDev) {
      sessionVerified = true
    } else if (investment.monime_checkout_session_id) {
      try {
        const session = await getCheckoutSession(investment.monime_checkout_session_id) as Record<string, unknown>
        const status = typeof session?.status === 'string' ? session.status.toLowerCase() : null
        const sessionAmount = session ? extractSessionAmount(session) : null
        const sessionCurrency = session ? extractSessionCurrency(session) : null
        const reference = session ? extractInvestmentReference(session) : null

        const statusValid = !!status && COMPLETED_SESSION_STATUSES.includes(status)
        const amountValid = typeof sessionAmount === 'number' &&
          approximatelyEqual(sessionAmount, Number(investment.amount))
        const currencyValid = typeof sessionCurrency === 'string' &&
          sessionCurrency.toUpperCase() === String(investment.currency || 'SLE').toUpperCase()
        const referenceValid = reference === investmentId

        sessionVerified = statusValid && amountValid && currencyValid && referenceValid
      } catch (err) {
        console.error('[Pitch Success] Checkout verification failed:', err)
      }
    }

    if (sessionVerified) {
      await processCompletedPitchInvestment(supabase, investment)
      return redirectSeeOther(buildReturnUrl(appUrl, 'success', investmentId))
    }

    return redirectSeeOther(buildReturnUrl(appUrl, 'pending', investmentId))
  } catch {
    return redirectSeeOther(buildReturnUrl(appUrl, 'error', investmentId))
  }
}

async function processCompletedPitchInvestment(
  supabase: ReturnType<typeof createAdminClient>,
  investment: Record<string, unknown>
) {
  const investmentId = investment.id as string

  const { data: fresh } = await supabase
    .from('pitch_investments')
    .select('status')
    .eq('id', investmentId)
    .single()

  if (!fresh || fresh.status !== 'awaiting_payment') {
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
    .eq('id', investment.pitch_id as string)
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

  // Create transaction record (idempotent)
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
      monime_checkout_session_id: investment.monime_checkout_session_id,
      payment_type: 'pitch_investment',
      pitch_investment_id: investmentId,
      status: 'completed',
    })
  }

  // Trigger payout to recipient
  const recipientId = investment.recipient_id as string

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_provider, payment_provider_id, payment_account, payout_mode')
    .eq('user_id', recipientId)
    .single()

  let payoutFlow: 'wallet' | 'auto' | 'none' = 'none'
  if (profile?.payout_mode === 'wallet') {
    const walletCurrency = toWalletCurrency((investment.currency as string) || 'SLE')
    try {
      await creditWalletForSource(
        supabase,
        recipientId,
        walletCurrency,
        Number(investment.net_payout_amount),
        'pitch_investment',
        investmentId,
        { source: 'pitch_success_fallback' }
      )

      await supabase
        .from('pitch_investments')
        .update({ status: 'completed', payout_status: 'completed' })
        .eq('id', investmentId)

      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'wallet_credited',
        title: 'Wallet Credited',
        message: `Your Creatuno wallet has been credited with ${walletCurrency} ${Number(investment.net_payout_amount).toFixed(2)}.`,
        data: { pitch_investment_id: investmentId, amount: investment.net_payout_amount, currency: walletCurrency },
      })
      payoutFlow = 'wallet'
    } catch (error) {
      console.error('Wallet credit failed in pitch success route:', error)
    }
  } else if (!profile?.payment_provider || !profile?.payment_provider_id || !profile?.payment_account) {
    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'payout_action_required',
      title: 'Payment Method Required',
      message: 'You have a pending pitch funding payout but no payment method configured. Please add your payment details in Settings.',
      data: { pitch_investment_id: investmentId },
    })
    payoutFlow = 'none'
  } else {
    const destination = buildPayoutDestinationFromProfile(profile) as PayoutDestination | null
    if (!destination) {
      payoutFlow = 'none'
    } else {
      try {
        const payout = await createPayout({
          amount: investment.net_payout_amount as number,
          currency: (investment.currency as string) || 'SLE',
          destination,
          metadata: { pitch_investment_id: investmentId, recipient_id: recipientId },
        })

        await supabase
          .from('pitch_investments')
          .update({ monime_payout_id: payout.id, status: 'payout_initiated', payout_status: 'initiated' })
          .eq('id', investmentId)

        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'payout_initiated',
          title: 'Payout Initiated',
          message: `Your payout has been initiated to ${profile.payment_provider?.toUpperCase()} ${maskAccount(profile.payment_account)}.`,
          data: { pitch_investment_id: investmentId, monime_payout_id: payout.id, amount: investment.net_payout_amount, currency: investment.currency },
        })
        payoutFlow = 'auto'
      } catch (err) {
        console.error('Pitch payout initiation failed in success route:', err)
      }
    }
  }

  const pitchTitle = pitch?.title || 'a pitch'

  await supabase.from('notifications').insert([
    {
      user_id: investment.investor_id as string,
      type: 'investment_completed',
      title: 'Investment Successful!',
      message: `Your investment in "${pitchTitle}" has been processed.`,
      data: { pitch_investment_id: investmentId, pitch_id: investment.pitch_id },
    },
    {
      user_id: recipientId,
      type: 'funding_received',
      title: 'Pitch Funding Received!',
      message: `An investor has funded "${pitchTitle}". ${payoutFlow === 'wallet' ? 'Funds were credited to your Creatuno wallet.' : 'Payout is being processed.'}`,
      data: { pitch_investment_id: investmentId, pitch_id: investment.pitch_id, amount: investment.net_payout_amount },
    },
  ])
}

export async function GET(request: NextRequest) {
  return handlePitchSuccess(request)
}

export async function POST(request: NextRequest) {
  return handlePitchSuccess(request)
}
