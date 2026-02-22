// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson, publicCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return publicCachedJson({ pitches: [], nextCursor: null })
  }

  try {
    const { searchParams } = new URL(request.url)
    const mine = searchParams.get('mine') === 'true'
    const category = searchParams.get('category')
    const status = searchParams.get('status') || 'live'
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest'
    const cursor = searchParams.get('cursor')
    const rawLimit = parseInt(searchParams.get('limit') ?? '12', 10)
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 12 : rawLimit), 50)

    const supabase = await createServerClient()

    if (mine) {
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data, error } = await supabase
        .from('pitches')
        .select(`
          *,
          sender:sender_id ( full_name, avatar_url ),
          creative:creative_id ( full_name, avatar_url, skills ),
          portfolio:portfolio_id ( title, slug )
        `)
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return privateCachedJson({ pitches: data || [] })
    }

    let query = supabase
      .from('pitches')
      .select(`
        *,
        sender:sender_id ( user_id, full_name, avatar_url ),
        creative:creative_id ( user_id, full_name, avatar_url, skills ),
        portfolio:portfolio_id ( id, title, slug )
      `)
      .eq('status', status)

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,tagline.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (sort === 'most-interest') {
      query = query.order('interest_count', { ascending: false })
    } else if (sort === 'highest-ask') {
      query = query.order('funding_ask', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    query = query.limit(limit + 1)

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []
    const hasMore = rows.length > limit
    const pitches = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore
      ? pitches[pitches.length - 1]?.created_at ?? null
      : null

    return publicCachedJson({ pitches, nextCursor }, 30, 60)
  } catch (error) {
    console.error('Pitches GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch pitches' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (!profile || !['creative', 'mentor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only creatives and mentors can create pitches' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, category, tagline, portfolio_id, funding_ask, currency, cover_image, video_url, skills, creative_id } = body

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    let resolvedCreativeId = userId

    if (profile.role === 'mentor' && creative_id) {
      const { data: mentorship } = await supabase
        .from('mentorships')
        .select('id')
        .eq('mentor_id', userId)
        .eq('mentee_id', creative_id)
        .eq('status', 'active')
        .single()

      if (!mentorship) {
        return NextResponse.json({ error: 'You can only pitch for your active mentees' }, { status: 403 })
      }
      resolvedCreativeId = creative_id
    }

    const { data: pitch, error } = await supabase
      .from('pitches')
      .insert({
        sender_id: userId,
        creative_id: resolvedCreativeId,
        portfolio_id: portfolio_id || null,
        title: title.trim(),
        tagline: tagline?.trim() || null,
        description: description.trim(),
        category: category || null,
        funding_ask: funding_ask ? parseFloat(funding_ask) : null,
        currency: currency || 'USD',
        cover_image: cover_image || null,
        video_url: video_url || null,
        skills: skills || [],
        status: 'draft',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pitch }, { status: 201 })
  } catch (error) {
    console.error('Pitches POST error:', error)
    return NextResponse.json({ error: 'Failed to create pitch' }, { status: 500 })
  }
}
