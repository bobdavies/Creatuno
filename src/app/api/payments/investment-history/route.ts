import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payments/investment-history
 *
 * Returns all pitch investments for the authenticated user.
 * Works for investors (as funder) and for creatives/mentors (as recipient).
 */
export async function GET() {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single()

    const role = profile?.role || 'creative'
    const isInvestor = role === 'investor'
    const roleFilter = isInvestor ? 'investor_id' : 'recipient_id'

    const { data: investments, error } = await supabase
      .from('pitch_investments')
      .select(`
        id, pitch_id, investor_id, recipient_id, amount, currency,
        platform_fee, net_payout_amount, status, payout_status,
        monime_checkout_session_id, monime_payout_id, created_at
      `)
      .eq(roleFilter, userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching investment history:', error)
      return NextResponse.json({ error: 'Failed to fetch investment history' }, { status: 500 })
    }

    const pitchIds = [...new Set((investments || []).map(i => i.pitch_id).filter(Boolean))]
    const userIds = [...new Set((investments || []).flatMap(i => [i.investor_id, i.recipient_id]).filter(Boolean))]

    const [pitchResult, profileResult] = await Promise.all([
      pitchIds.length > 0
        ? supabase.from('pitches').select('id, title, category, status, funding_ask, currency, total_funded').in('id', pitchIds)
        : { data: [] },
      userIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, avatar_url, role').in('user_id', userIds)
        : { data: [] },
    ])

    const pitchMap: Record<string, { title: string; category: string | null; status: string; funding_ask: number | null; currency: string; total_funded: number }> = {}
    for (const p of (pitchResult.data || [])) {
      pitchMap[p.id] = { title: p.title, category: p.category, status: p.status, funding_ask: p.funding_ask, currency: p.currency, total_funded: p.total_funded }
    }

    const profileMap: Record<string, { full_name: string; avatar_url: string | null; role: string }> = {}
    for (const p of (profileResult.data || [])) {
      profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url, role: p.role }
    }

    const enriched = (investments || []).map(inv => ({
      ...inv,
      pitch: pitchMap[inv.pitch_id] || null,
      investor: profileMap[inv.investor_id] || null,
      recipient: profileMap[inv.recipient_id] || null,
    }))

    const completedStatuses = ['payment_received', 'payout_initiated', 'completed']
    const pendingStatuses = ['awaiting_payment']

    const totalInvested = enriched
      .filter(i => completedStatuses.includes(i.status))
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    const totalPending = enriched
      .filter(i => pendingStatuses.includes(i.status))
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    const totalReceived = !isInvestor
      ? enriched
          .filter(i => completedStatuses.includes(i.status))
          .reduce((sum, i) => sum + (i.net_payout_amount || 0), 0)
      : 0

    return NextResponse.json({
      investments: enriched,
      stats: {
        total_invested: totalInvested,
        total_pending: totalPending,
        total_received: totalReceived,
        count: enriched.length,
        funded_count: enriched.filter(i => completedStatuses.includes(i.status)).length,
      },
      role,
    })
  } catch (error) {
    console.error('Error in payments/investment-history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
