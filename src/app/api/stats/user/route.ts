// @ts-nocheck
import { NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch stats specific to the current authenticated user
export async function GET() {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({
      portfolioViews: 0,
      activeApplications: 0,
      totalEarnings: 0,
    })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServerClient()

    // Run all queries in parallel
    const [viewsResult, applicationsResult, earningsResult] = await Promise.all([
      // Sum of view_count from user's portfolios
      supabase
        .from('portfolios')
        .select('view_count')
        .eq('user_id', userId),

      // Count of active applications (pending or reviewing)
      supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_id', userId)
        .in('status', ['pending', 'reviewing']),

      // Sum of earnings from transactions where user is payee
      supabase
        .from('transactions')
        .select('amount, platform_fee')
        .eq('payee_id', userId)
        .eq('status', 'completed'),
    ])

    // Calculate total portfolio views
    const portfolioViews = viewsResult.data?.reduce(
      (sum, p) => sum + (p.view_count || 0),
      0
    ) ?? 0

    // Active applications count
    const activeApplications = applicationsResult.count ?? 0

    // Calculate total earnings (amount - platform_fee)
    const totalEarnings = earningsResult.data?.reduce(
      (sum, t) => sum + ((t.amount || 0) - (t.platform_fee || 0)),
      0
    ) ?? 0

    return privateCachedJson({
      portfolioViews,
      activeApplications,
      totalEarnings,
    })
  } catch (error) {
    console.error('User stats API error:', error)
    return privateCachedJson({
      portfolioViews: 0,
      activeApplications: 0,
      totalEarnings: 0,
    })
  }
}
