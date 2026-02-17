// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch creative profiles for talent scouting
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ creatives: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const supabase = await createServerClient()

    let query = supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, bio, skills, location')
      .eq('role', 'creative')

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,bio.ilike.%${search}%,location.ilike.%${search}%`)
    }

    const { data: profiles, error } = await query
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching creatives:', error)
      return NextResponse.json({ creatives: [] })
    }

    const creatives = profiles?.map(p => ({
      user_id: p.user_id,
      fullName: p.full_name || 'Unknown',
      avatarUrl: p.avatar_url,
      bio: p.bio || '',
      skills: p.skills || [],
      location: p.location || '',
    })) || []

    return NextResponse.json({ creatives })
  } catch (error) {
    console.error('Error in creatives GET:', error)
    return NextResponse.json({ creatives: [] })
  }
}
