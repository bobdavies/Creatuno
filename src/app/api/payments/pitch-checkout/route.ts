import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/monime'
import { normalizeCurrency, DEFAULT_CURRENCY } from '@/lib/currency'
import { randomUUID } from 'crypto'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const PLATFORM_FEE_PERCENT = 5
const MAX_INVESTMENT_AMOUNT = 1_000_000

function isDevBypass(): boolean {
  if (process.env.MONIME_DEV_BYPASS === 'true') return true
  if (process.env.NODE_ENV === 'development' && process.env.MONIME_ACCESS_TOKEN?.startsWith('mon_test_')) return true
  return false
}

function isValidMoneyAmount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= MAX_INVESTMENT_AMOUNT
    && Math.round(value * 100) === value * 100
}

/**
 * POST /api/payments/pitch-checkout
 *
 * Creates a Monime checkout session for an investor to fund a pitch.
 * Body: { pitch_id: string, amount: number }
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
    const { pitch_id, amount } = body

    if (!pitch_id) {
      return NextResponse.json({ error: 'pitch_id is required' }, { status: 400 })
    }

    if (!isValidMoneyAmount(amount)) {
      return NextResponse.json({ error: 'A valid positive amount is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', userId)
      .single()

    if (!profile || profile.role !== 'investor') {
      return NextResponse.json({ error: 'Only investors can fund pitches' }, { status: 403 })
    }

    const { data: pitch, error: pitchError } = await supabase
      .from('pitches')
      .select('id, title, sender_id, creative_id, status, currency, funding_ask')
      .eq('id', pitch_id)
      .single()

    if (pitchError || !pitch) {
      return NextResponse.json({ error: 'Pitch not found' }, { status: 404 })
    }

    if (pitch.status !== 'live') {
      return NextResponse.json({ error: 'This pitch is not currently accepting funding' }, { status: 400 })
    }

    // Recipient is the sender_id (mentor if championed, creative if self-pitched)
    const recipientId = pitch.sender_id

    const currency = normalizeCurrency(pitch.currency) || DEFAULT_CURRENCY
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT) / 100
    const netPayout = amount - platformFee

    // Check for existing pending investment from this investor on this pitch
    const { data: existingPending } = await supabase
      .from('pitch_investments')
      .select('id, status')
      .eq('pitch_id', pitch_id)
      .eq('investor_id', userId)
      .eq('status', 'awaiting_payment')

    // Clean up stale pending investments
    if (existingPending && existingPending.length > 0) {
      await supabase
        .from('pitch_investments')
        .delete()
        .in('id', existingPending.map(e => e.id))
    }

    const { data: investment, error: investError } = await supabase
      .from('pitch_investments')
      .insert({
        pitch_id,
        investor_id: userId,
        recipient_id: recipientId,
        amount,
        currency,
        platform_fee: platformFee,
        net_payout_amount: netPayout,
        status: 'awaiting_payment',
        payout_status: 'pending',
      })
      .select()
      .single()

    if (investError || !investment) {
      console.error('Error creating pitch investment:', investError)
      return NextResponse.json({ error: 'Failed to create investment record' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const checkoutName = `Investment in "${pitch.title}"`

    // Dev bypass mode
    if (isDevBypass()) {
      console.warn('[DEV BYPASS] Simulating Monime pitch checkout — no real payment')
      const devSessionId = `dev_pitch_session_${randomUUID()}`

      await supabase
        .from('pitch_investments')
        .update({
          monime_checkout_session_id: devSessionId,
          monime_order_number: `DEV-PITCH-${Date.now()}`,
        })
        .eq('id', investment.id)

      const devRedirectUrl = `${appUrl}/api/payments/pitch-success?investment_id=${investment.id}&dev=true`

      return NextResponse.json({
        redirectUrl: devRedirectUrl,
        sessionId: devSessionId,
        investmentId: investment.id,
        amount,
        currency,
      })
    }

    // Production: create Monime checkout session
    let session
    try {
      session = await createCheckoutSession({
        name: checkoutName,
        description: `Funding pitch "${pitch.title}" by investing ${currency} ${amount}`,
        amount,
        currency,
        reference: investment.id,
        metadata: {
          pitch_investment_id: investment.id,
          pitch_id,
          investor_id: userId,
          recipient_id: recipientId,
        },
        successUrl: `${appUrl}/api/payments/pitch-success?investment_id=${investment.id}`,
        cancelUrl: `${appUrl}/pitch-stage/${pitch_id}?funding=cancelled`,
      })
    } catch (monimeError) {
      console.error('Monime pitch checkout creation failed:', monimeError)
      await supabase.from('pitch_investments').delete().eq('id', investment.id)
      return NextResponse.json(
        { error: `Payment provider error: ${monimeError instanceof Error ? monimeError.message : 'Unknown error'}` },
        { status: 502 }
      )
    }

    if (!session?.redirectUrl) {
      console.error('Monime returned no redirectUrl for pitch checkout:', session)
      await supabase.from('pitch_investments').delete().eq('id', investment.id)
      return NextResponse.json(
        { error: 'Payment provider did not return a checkout URL. Please try again.' },
        { status: 502 }
      )
    }

    await supabase
      .from('pitch_investments')
      .update({
        monime_checkout_session_id: session.id,
        monime_order_number: session.orderNumber,
      })
      .eq('id', investment.id)

    return NextResponse.json({
      redirectUrl: session.redirectUrl,
      sessionId: session.id,
      investmentId: investment.id,
      amount,
      currency,
    })
  } catch (error) {
    console.error('Error in payments/pitch-checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
