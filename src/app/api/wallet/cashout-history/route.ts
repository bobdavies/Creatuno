import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'
import { isCashoutEligibleRole } from '@/lib/wallet'

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (!profile || !isCashoutEligibleRole(profile.role)) {
    return NextResponse.json({ error: 'Wallet cashout is only available to creatives and mentors' }, { status: 403 })
  }

  const { data: cashouts, error } = await supabase
    .from('cashout_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch cashout history' }, { status: 500 })
  }

  const stats = (cashouts || []).reduce(
    (acc, item) => {
      const amount = Number(item.amount || 0)
      if (item.status === 'completed') acc.total_completed += amount
      if (item.status === 'initiated' || item.status === 'pending') acc.total_in_flight += amount
      if (item.status === 'failed') acc.total_failed += amount
      acc.count += 1
      return acc
    },
    { total_completed: 0, total_in_flight: 0, total_failed: 0, count: 0 }
  )

  return NextResponse.json({
    cashouts: cashouts || [],
    stats,
  })
}
