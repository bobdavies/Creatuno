// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

const MENTOR_OFFER_MARKER = '__mentor_offer__'

// GET - Fetch mentorship offers
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ offers: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const offerId = searchParams.get('id')
    const role = searchParams.get('role') || 'creative' // 'mentor' or 'creative'

    const supabase = await createServerClient()

    // Single offer fetch by ID (for offer detail page)
    if (offerId) {
      const { data: offer, error } = await supabase
        .from('mentorship_requests')
        .select(`
          *,
          mentor:mentor_id (
            full_name,
            avatar_url,
            bio,
            skills,
            location,
            mentor_expertise,
            is_available_for_mentorship,
            max_mentees
          )
        `)
        .eq('id', offerId)
        .eq('goals', MENTOR_OFFER_MARKER)
        .single()

      if (error || !offer) {
        return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
      }

      // Verify the caller is either the mentor or the creative of this offer
      if (offer.mentor_id !== userId && offer.mentee_id !== userId) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      return NextResponse.json({ offer })
    }

    // List all offers
    let query
    if (role === 'mentor') {
      // Offers the mentor has sent
      query = supabase
        .from('mentorship_requests')
        .select(`
          *,
          mentee:mentee_id (
            full_name,
            avatar_url,
            bio,
            skills,
            location
          )
        `)
        .eq('mentor_id', userId)
        .eq('goals', MENTOR_OFFER_MARKER)
    } else {
      // Offers the creative has received
      query = supabase
        .from('mentorship_requests')
        .select(`
          *,
          mentor:mentor_id (
            full_name,
            avatar_url,
            bio,
            skills,
            location,
            mentor_expertise,
            is_available_for_mentorship,
            max_mentees
          )
        `)
        .eq('mentee_id', userId)
        .eq('goals', MENTOR_OFFER_MARKER)
    }

    const { data: offers, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching mentorship offers:', error)
      return NextResponse.json({ offers: [] })
    }

    return NextResponse.json({ offers: offers || [] })
  } catch (error) {
    console.error('Error in offers GET:', error)
    return NextResponse.json({ offers: [] })
  }
}

// POST - Mentor sends a mentorship offer to a creative
export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { creative_id, message } = body

    if (!creative_id || !message) {
      return NextResponse.json(
        { error: 'Creative ID and message are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Verify caller is a mentor
    const { data: mentorProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', userId)
      .single()

    if (!mentorProfile || mentorProfile.role !== 'mentor') {
      return NextResponse.json({ error: 'Only mentors can send mentorship offers' }, { status: 403 })
    }

    // Verify creative exists
    const { data: creativeProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', creative_id)
      .single()

    if (!creativeProfile || creativeProfile.role !== 'creative') {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 })
    }

    // Check for duplicate offer
    const { data: existingOffer } = await supabase
      .from('mentorship_requests')
      .select('id')
      .eq('mentor_id', userId)
      .eq('mentee_id', creative_id)
      .eq('goals', MENTOR_OFFER_MARKER)
      .single()

    if (existingOffer) {
      return NextResponse.json(
        { error: 'You have already sent an offer to this creative' },
        { status: 400 }
      )
    }

    // Create the offer (stored as a mentorship_request with the marker)
    const { data: offer, error } = await supabase
      .from('mentorship_requests')
      .insert({
        mentor_id: userId,
        mentee_id: creative_id,
        message: message.trim(),
        goals: MENTOR_OFFER_MARKER,
        skills_to_develop: [],
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating mentorship offer:', error)
      return NextResponse.json({ error: 'Failed to send offer' }, { status: 500 })
    }

    // Create notification for the creative
    await supabase.from('notifications').insert({
      user_id: creative_id,
      type: 'mentorship_offer',
      title: 'Mentorship Offer!',
      message: `${mentorProfile.full_name || 'A mentor'} wants to offer you mentorship`,
      data: { request_id: offer.id, mentor_id: userId },
    })

    return NextResponse.json({ offer })
  } catch (error) {
    console.error('Error in offers POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Creative accepts or declines a mentorship offer
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { offer_id, status } = body

    if (!offer_id || !status) {
      return NextResponse.json({ error: 'Offer ID and status are required' }, { status: 400 })
    }

    if (!['accepted', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Status must be accepted or declined' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify this is a mentor offer and the caller is the creative
    const { data: offer } = await supabase
      .from('mentorship_requests')
      .select('id, mentor_id, mentee_id, goals')
      .eq('id', offer_id)
      .single()

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    if (offer.mentee_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    if (offer.goals !== MENTOR_OFFER_MARKER) {
      return NextResponse.json({ error: 'This is not a mentor offer' }, { status: 400 })
    }

    // Update status
    const { data: updatedOffer, error } = await supabase
      .from('mentorship_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating offer:', error)
      return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 })
    }

    // If accepted, create a mentorship row
    if (status === 'accepted') {
      await supabase.from('mentorships').insert({
        mentor_id: offer.mentor_id,
        mentee_id: userId,
        request_id: offer_id,
        status: 'active',
        started_at: new Date().toISOString(),
      }).catch((err: unknown) => {
        console.warn('Could not create mentorships record:', err)
      })
    }

    // Notify the mentor
    await supabase.from('notifications').insert({
      user_id: offer.mentor_id,
      type: 'mentorship_response',
      title: status === 'accepted' ? 'Mentorship Offer Accepted!' : 'Mentorship Offer Declined',
      message: status === 'accepted'
        ? 'A creative has accepted your mentorship offer'
        : 'A creative has declined your mentorship offer',
      data: { request_id: offer_id },
    })

    return NextResponse.json({ offer: updatedOffer })
  } catch (error) {
    console.error('Error in offers PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
