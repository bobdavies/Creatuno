// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { publicCachedJson } from '@/lib/api/cache-headers'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch available mentors
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ mentors: [] })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const availableOnly = searchParams.get('available') === 'true'

    const supabase = await createServerClient()

    let query = supabase
      .from('profiles')
      .select('*')
      .or('is_mentor.eq.true,role.eq.mentor')

    if (availableOnly) {
      query = query.eq('is_available_for_mentorship', true)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,bio.ilike.%${search}%`)
    }

    const { data: profiles, error } = await query
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching mentors:', error)
      return NextResponse.json({ mentors: [] })
    }

    // Transform data for frontend
    const mentors = profiles?.map(p => ({
      id: p.id,
      user_id: p.user_id,
      fullName: p.full_name || 'Unknown',
      avatarUrl: p.avatar_url,
      bio: p.bio || '',
      location: p.location || '',
      skills: p.skills || [],
      mentorExpertise: p.mentor_expertise || [],
      maxMentees: p.max_mentees || 5,
      isAvailableForMentorship: p.is_available_for_mentorship || false,
    })) || []

    return publicCachedJson({ mentors }, 120, 300)
  } catch (error) {
    console.error('Error in mentors GET:', error)
    return NextResponse.json({ mentors: [] })
  }
}
