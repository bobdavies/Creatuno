import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { isCashoutEligibleRole, toWalletCurrency } from '@/lib/wallet'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!isCashoutEligibleRole(profile.role)) {
    return NextResponse.json({ error: 'Wallet cashout is only available to creatives and mentors' }, { status: 403 })
  }

  const currency = toWalletCurrency('SLE')
  let backfill = { applied_count: 0, applied_amount: 0, error: null as string | null }

  const { data: backfillRows, error: backfillError } = await supabase.rpc('wallet_backfill_receivables', {
    p_user_id: userId,
    p_currency: currency,
  })

  if (backfillError) {
    // Do not block wallet summary if backfill function isn't available yet.
    console.warn('wallet_backfill_receivables failed:', backfillError.message)
    backfill.error = backfillError.message
  } else if (Array.isArray(backfillRows) && backfillRows.length > 0) {
    const row = backfillRows[0] as { applied_count?: number; applied_amount?: number }
    backfill = {
      applied_count: Number(row.applied_count || 0),
      applied_amount: Number(row.applied_amount || 0),
      error: null,
    }
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

  const [{ data: recentLedger }, { data: recentCashouts }] = await Promise.all([
    supabase
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('cashout_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    wallet,
    backfill,
    recent_ledger: recentLedger || [],
    recent_cashouts: recentCashouts || [],
  })
}
