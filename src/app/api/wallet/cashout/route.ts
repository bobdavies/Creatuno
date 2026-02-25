import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createPayout } from '@/lib/monime'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import {
  applyWalletMutation,
  buildPayoutDestinationFromProfile,
  isCashoutEligibleRole,
  maskAccount,
  toWalletCurrency,
} from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { amount?: number; currency?: string; idempotency_key?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const amount = Number(body.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }

  const currency = toWalletCurrency(body.currency || 'SLE')
  const requestIdempotencyKey = body.idempotency_key || request.headers.get('x-idempotency-key') || randomUUID()

  const supabase = createAdminClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, payment_provider, payment_provider_id, payment_account')
    .eq('user_id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!isCashoutEligibleRole(profile.role)) {
    return NextResponse.json({ error: 'Cashout is only available for creatives and mentors' }, { status: 403 })
  }

  const payoutDestination = buildPayoutDestinationFromProfile(profile)
  if (!payoutDestination || !profile.payment_account) {
    return NextResponse.json({ error: 'Payment method not configured. Add payout details in settings first.' }, { status: 400 })
  }

  const { data: existingRequest } = await supabase
    .from('cashout_requests')
    .select('*')
    .eq('idempotency_key', requestIdempotencyKey)
    .maybeSingle()

  if (existingRequest) {
    return NextResponse.json({ cashout: existingRequest, deduplicated: true })
  }

  let wallet = (
    await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .single()
  ).data

  if (!wallet) {
    const { data: inserted } = await supabase
      .from('user_wallets')
      .insert({ user_id: userId, currency, available_balance: 0, pending_balance: 0 })
      .select('*')
      .single()
    wallet = inserted || null
  }

  if (!wallet || Number(wallet.available_balance || 0) < amount) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
  }

  const { data: cashout, error: cashoutError } = await supabase
    .from('cashout_requests')
    .insert({
      user_id: userId,
      wallet_id: wallet.id,
      currency,
      amount,
      provider: profile.payment_provider!,
      provider_id: profile.payment_provider_id!,
      account_masked: maskAccount(profile.payment_account),
      status: 'pending',
      idempotency_key: requestIdempotencyKey,
      metadata: { flow: 'wallet_cashout' },
    })
    .select('*')
    .single()

  if (cashoutError || !cashout) {
    return NextResponse.json({ error: 'Failed to create cashout request' }, { status: 500 })
  }

  try {
    await applyWalletMutation(supabase, {
      userId,
      currency,
      availableDelta: -amount,
      pendingDelta: amount,
      entryType: 'hold',
      amount,
      sourceType: 'cashout_request',
      sourceId: cashout.id,
      idempotencyKey: `cashout:hold:${cashout.id}`,
      metadata: { cashout_request_id: cashout.id },
    })

    const payout = await createPayout({
      amount,
      currency,
      destination: payoutDestination,
      idempotencyKey: `cashout:monime:${cashout.id}`,
      metadata: {
        flow: 'wallet_cashout',
        cashout_request_id: cashout.id,
        user_id: userId,
      },
    })

    const { data: updatedCashout, error: updateError } = await supabase
      .from('cashout_requests')
      .update({
        monime_payout_id: payout.id,
        status: 'initiated',
        initiated_at: new Date().toISOString(),
      })
      .eq('id', cashout.id)
      .select('*')
      .single()

    if (updateError || !updatedCashout) {
      throw new Error('Failed to update cashout after payout creation')
    }

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'cashout_initiated',
      title: 'Cashout Initiated',
      message: `Your cashout of ${currency} ${amount.toFixed(2)} was initiated to ${profile.payment_provider?.toUpperCase()} ${maskAccount(profile.payment_account)}.`,
      data: { cashout_request_id: cashout.id, monime_payout_id: payout.id, amount, currency },
    })

    return NextResponse.json({ cashout: updatedCashout })
  } catch (error) {
    // Roll back held funds if provider payout could not be initiated.
    await applyWalletMutation(supabase, {
      userId,
      currency,
      availableDelta: amount,
      pendingDelta: -amount,
      entryType: 'release',
      amount,
      sourceType: 'cashout_request',
      sourceId: cashout.id,
      idempotencyKey: `cashout:release:${cashout.id}`,
      metadata: { reason: 'payout_init_failed' },
    }).catch(() => null)

    await supabase
      .from('cashout_requests')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_reason: error instanceof Error ? error.message : 'Payout initiation failed',
      })
      .eq('id', cashout.id)

    return NextResponse.json({ error: 'Cashout failed to start. Funds were restored to your wallet.' }, { status: 500 })
  }
}
