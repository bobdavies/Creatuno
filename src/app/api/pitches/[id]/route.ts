// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson, publicCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfiguredServer()) {
    return publicCachedJson({ pitch: null })
  }

  try {
    const { id } = await params
    const supabase = await createServerClient()

    const { data: pitch, error } = await supabase
      .from('pitches')
      .select(`
        *,
        sender:sender_id ( user_id, full_name, avatar_url, bio, skills, role ),
        creative:creative_id ( user_id, full_name, avatar_url, bio, skills, location ),
        portfolio:portfolio_id ( id, title, slug, tagline, description )
      `)
      .eq('id', id)
      .single()

    if (error || !pitch) {
      return NextResponse.json({ pitch: null }, { status: 404 })
    }

    if (pitch.status === 'live') {
      await supabase
        .from('pitches')
        .update({ view_count: (pitch.view_count || 0) + 1 })
        .eq('id', id)
    }

    let hasExpressedInterest = false
    const { userId } = await auth()
    if (userId) {
      const { data: interest } = await supabase
        .from('pitch_interests')
        .select('id')
        .eq('pitch_id', id)
        .eq('investor_id', userId)
        .maybeSingle()
      hasExpressedInterest = !!interest
    }

    let interests: any[] = []
    if (userId && (pitch.sender_id === userId || pitch.creative_id === userId)) {
      const { data } = await supabase
        .from('pitch_interests')
        .select(`
          *,
          investor:investor_id ( user_id, full_name, avatar_url )
        `)
        .eq('pitch_id', id)
        .order('created_at', { ascending: false })
      interests = data || []
    }

    return publicCachedJson({
      pitch: { ...pitch, view_count: (pitch.view_count || 0) + 1 },
      hasExpressedInterest,
      interests,
    }, 10, 30)
  } catch (error) {
    console.error('Pitch GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch pitch' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerClient()

    const { data: pitch } = await supabase
      .from('pitches')
      .select('*')
      .eq('id', id)
      .eq('sender_id', userId)
      .single()

    if (!pitch) {
      return NextResponse.json({ error: 'Pitch not found or not yours' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, any> = {}

    const allowedFields = ['title', 'tagline', 'description', 'category', 'funding_ask', 'currency', 'cover_image', 'video_url', 'skills', 'portfolio_id']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['live'],
        live: ['closed', 'funded'],
        closed: [],
        funded: [],
      }

      if (!validTransitions[pitch.status]?.includes(body.status)) {
        return NextResponse.json({ error: `Cannot change status from ${pitch.status} to ${body.status}` }, { status: 400 })
      }

      if (body.status === 'live') {
        const title = updates.title || pitch.title
        const description = updates.description || pitch.description
        if (!title?.trim() || !description?.trim()) {
          return NextResponse.json({ error: 'Title and description are required to publish' }, { status: 400 })
        }
      }

      updates.status = body.status

      if (body.status === 'live' && pitch.sender_id !== pitch.creative_id) {
        await supabase.from('notifications').insert({
          user_id: pitch.creative_id,
          type: 'pitch_published',
          title: 'Your mentor championed you on The Pitch Stage!',
          message: `A pitch titled "${pitch.title}" has been published on your behalf.`,
          data: { pitch_id: id },
          is_read: false,
        })
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('pitches')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pitch: updated })
  } catch (error) {
    console.error('Pitch PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update pitch' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerClient()

    const { data: pitch } = await supabase
      .from('pitches')
      .select('status')
      .eq('id', id)
      .eq('sender_id', userId)
      .single()

    if (!pitch) {
      return NextResponse.json({ error: 'Pitch not found or not yours' }, { status: 404 })
    }

    if (!['draft', 'closed'].includes(pitch.status)) {
      return NextResponse.json({ error: 'Can only delete draft or closed pitches' }, { status: 400 })
    }

    const { error } = await supabase
      .from('pitches')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pitch DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete pitch' }, { status: 500 })
  }
}
