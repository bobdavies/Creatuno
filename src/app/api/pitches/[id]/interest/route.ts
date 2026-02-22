// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export async function POST(
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

    const supabase = await createServerClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', userId)
      .single()

    if (!profile || profile.role !== 'investor') {
      return NextResponse.json({ error: 'Only investors can express interest' }, { status: 403 })
    }

    const { id: pitchId } = await params
    const body = await request.json().catch(() => ({}))

    const { data: pitch } = await supabase
      .from('pitches')
      .select('id, title, sender_id, creative_id, status')
      .eq('id', pitchId)
      .eq('status', 'live')
      .single()

    if (!pitch) {
      return NextResponse.json({ error: 'Pitch not found or not live' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('pitch_interests')
      .select('id')
      .eq('pitch_id', pitchId)
      .eq('investor_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You have already expressed interest' }, { status: 409 })
    }

    const { data: interest, error } = await supabase
      .from('pitch_interests')
      .insert({
        pitch_id: pitchId,
        investor_id: userId,
        message: body.message?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    await supabase
      .from('pitches')
      .update({ interest_count: (pitch as any).interest_count ? (pitch as any).interest_count + 1 : 1 })
      .eq('id', pitchId)

    const notificationTargets = new Set([pitch.sender_id, pitch.creative_id])
    for (const targetId of notificationTargets) {
      if (targetId !== userId) {
        await supabase.from('notifications').insert({
          user_id: targetId,
          type: 'pitch_interest_received',
          title: 'An investor is interested in your pitch!',
          message: `${profile.full_name} expressed interest in "${pitch.title}".`,
          data: { pitch_id: pitchId, investor_id: userId },
          is_read: false,
        })
      }
    }

    return NextResponse.json({ interest }, { status: 201 })
  } catch (error) {
    console.error('Pitch interest POST error:', error)
    return NextResponse.json({ error: 'Failed to express interest' }, { status: 500 })
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

    const { id: pitchId } = await params
    const supabase = await createServerClient()

    const { data: interest } = await supabase
      .from('pitch_interests')
      .select('id')
      .eq('pitch_id', pitchId)
      .eq('investor_id', userId)
      .maybeSingle()

    if (!interest) {
      return NextResponse.json({ error: 'No interest found to withdraw' }, { status: 404 })
    }

    const { error } = await supabase
      .from('pitch_interests')
      .delete()
      .eq('pitch_id', pitchId)
      .eq('investor_id', userId)

    if (error) throw error

    await supabase.rpc('decrement_interest_count', { pitch_uuid: pitchId }).catch(() => {
      supabase
        .from('pitches')
        .select('interest_count')
        .eq('id', pitchId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('pitches')
              .update({ interest_count: Math.max(0, (data.interest_count || 1) - 1) })
              .eq('id', pitchId)
          }
        })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pitch interest DELETE error:', error)
    return NextResponse.json({ error: 'Failed to withdraw interest' }, { status: 500 })
  }
}
