// @ts-nocheck
import { NextResponse } from 'next/server'
import { publicCachedJson } from '@/lib/api/cache-headers'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Public endpoint — no auth required. Returns aggregate platform stats.
export async function GET() {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({
        creatives: 0,
        portfolios: 0,
        opportunities: 0,
        connections: 0,
      })
    }

    const supabase = createAdminClient()

    // Run all counts in parallel for speed
    const [
      profilesResult,
      portfoliosResult,
      opportunitiesResult,
      connectionsResult,
    ] = await Promise.all([
      // Count creative professionals (all profiles with role = 'creative')
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),

      // Count portfolios
      supabase
        .from('portfolios')
        .select('id', { count: 'exact', head: true }),

      // Count opportunities
      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true }),

      // Count successful connections (accepted mentorship requests)
      supabase
        .from('mentorship_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted'),
    ])

    return publicCachedJson({
      creatives: profilesResult.count ?? 0,
      portfolios: portfoliosResult.count ?? 0,
      opportunities: opportunitiesResult.count ?? 0,
      connections: connectionsResult.count ?? 0,
    }, 300, 600)
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json({
      creatives: 0,
      portfolios: 0,
      opportunities: 0,
      connections: 0,
    })
  }
}
