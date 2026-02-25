import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payments/history
 *
 * Returns all escrows and transactions for the authenticated user,
 * with joined opportunity and profile data. Works for both employers and creatives.
 */
export async function GET(request: NextRequest) {
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
    const roleFilter = role === 'employer' ? 'employer_id' : 'creative_id'

    const { data: escrows, error } = await supabase
      .from('delivery_escrows')
      .select(`
        id, status, payment_amount, payment_percentage, currency, files_released,
        agreed_amount, net_payout_amount, platform_fee, created_at,
        submission_id, opportunity_id, creative_id, employer_id,
        monime_checkout_session_id, monime_payout_id
      `)
      .eq(roleFilter, userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching payment history:', error)
      return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 })
    }

    const oppIds = [...new Set((escrows || []).map(e => e.opportunity_id).filter(Boolean))]
    const userIds = [...new Set((escrows || []).flatMap(e => [e.creative_id, e.employer_id]).filter(Boolean))]

    const [oppResult, profileResult] = await Promise.all([
      oppIds.length > 0
        ? supabase.from('opportunities').select('id, title, type, category').in('id', oppIds)
        : { data: [] },
      userIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds)
        : { data: [] },
    ])

    const oppMap: Record<string, { title: string; type: string; category: string }> = {}
    for (const o of (oppResult.data || [])) {
      oppMap[o.id] = { title: o.title, type: o.type, category: o.category }
    }

    const profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {}
    for (const p of (profileResult.data || [])) {
      profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }
    }

    const payments = (escrows || []).map(e => ({
      ...e,
      opportunity: oppMap[e.opportunity_id] || null,
      creative: profileMap[e.creative_id] || null,
      employer: profileMap[e.employer_id] || null,
    }))

    const totalPaid = payments
      .filter(p => ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed'].includes(p.status))
      .reduce((sum, p) => sum + (p.payment_amount || 0), 0)

    const totalPending = payments
      .filter(p => ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved'].includes(p.status))
      .reduce((sum, p) => sum + (p.payment_amount || 0), 0)

    const totalEarned = role === 'creative'
      ? payments
          .filter(p => ['payment_received', 'partial_payment_received', 'payout_initiated', 'completed', 'partial_payout_completed'].includes(p.status))
          .reduce((sum, p) => sum + (p.net_payout_amount || 0), 0)
      : 0

    return NextResponse.json({
      payments,
      stats: {
        total_paid: totalPaid,
        total_pending: totalPending,
        total_earned: totalEarned,
        count: payments.length,
      },
      role,
    })
  } catch (error) {
    console.error('Error in payments/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
