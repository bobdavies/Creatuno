// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch user's mentorship requests
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ requests: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'mentee' // 'mentee' or 'mentor'
    const status = searchParams.get('status') // Optional status filter

    const supabase = await createServerClient()

    let query
    if (role === 'mentor') {
      // Fetch requests where user is the mentor
      query = supabase
        .from('mentorship_requests')
        .select(`
          *,
          mentee:mentee_id (
            full_name,
            avatar_url,
            bio,
            role,
            skills
          )
        `)
        .eq('mentor_id', userId)
    } else {
      // Fetch requests where user is the mentee
      query = supabase
        .from('mentorship_requests')
        .select(`
          *,
          mentor:mentor_id (
            full_name,
            avatar_url,
            bio,
            role,
            skills
          )
        `)
        .eq('mentee_id', userId)
    }

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status)
    }

    // Order by created_at
    query = query.order('created_at', { ascending: false })

    const { data: requests, error } = await query

    if (error) {
      console.error('Error fetching mentorship requests:', error)
      return NextResponse.json({ requests: [] })
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error('Error in mentorship GET:', error)
    return NextResponse.json({ requests: [] })
  }
}

// POST - Submit a mentorship request
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
    const { mentor_id, message, goals, skills_to_develop, portfolio_id } = body

    if (!mentor_id || !message || !goals) {
      return NextResponse.json(
        { error: 'Mentor ID, message, and goals are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Check if already requested
    const { data: existingRequest } = await supabase
      .from('mentorship_requests')
      .select('id')
      .eq('mentor_id', mentor_id)
      .eq('mentee_id', userId)
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You have already sent a request to this mentor' },
        { status: 400 }
      )
    }

    // Create request
    const { data: mentorshipRequest, error } = await supabase
      .from('mentorship_requests')
      .insert({
        mentor_id,
        mentee_id: userId,
        message,
        goals,
        skills_to_develop: skills_to_develop || [],
        portfolio_id: portfolio_id || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating mentorship request:', error)
      return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
    }

    // Create notification for mentor
    await supabase
      .from('notifications')
      .insert({
        user_id: mentor_id,
        type: 'mentorship_request',
        title: 'New Mentorship Request',
        message: 'Someone wants you to be their mentor',
        data: { request_id: mentorshipRequest.id },
      })

    return NextResponse.json({ request: mentorshipRequest })
  } catch (error) {
    console.error('Error in mentorship POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update mentorship request status (for mentors)
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
    const { id, request_id, status, feedback } = body

    // Accept both 'id' and 'request_id' for flexibility
    const requestId = id || request_id

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'Request ID and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'accepted', 'declined']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership (must be the mentor)
    const { data: existingRequest } = await supabase
      .from('mentorship_requests')
      .select('mentor_id, mentee_id')
      .eq('id', requestId)
      .single()

    if (!existingRequest || existingRequest.mentor_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (feedback) {
      updateData.feedback = feedback
    }

    const { data: updatedRequest, error } = await supabase
      .from('mentorship_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error updating mentorship request:', error)
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
    }

    // If accepted, also create a row in the mentorships table
    if (status === 'accepted') {
      await supabase.from('mentorships').insert({
        mentor_id: userId,
        mentee_id: existingRequest.mentee_id,
        request_id: requestId,
        status: 'active',
        started_at: new Date().toISOString(),
      }).catch((err: unknown) => {
        // Non-critical: log but don't fail the request
        console.warn('Could not create mentorships record:', err)
      })
    }

    // Notify mentee
    await supabase
      .from('notifications')
      .insert({
        user_id: existingRequest.mentee_id,
        type: 'mentorship_response',
        title: status === 'accepted' ? 'Mentorship Request Accepted!' : 'Mentorship Request Declined',
        message: status === 'accepted' 
          ? 'A mentor has accepted your request'
          : feedback || 'Your mentorship request was declined',
        data: { request_id: requestId },
      })

    return NextResponse.json({ request: updatedRequest })
  } catch (error) {
    console.error('Error in mentorship PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Cancel/withdraw a mentorship request or end a mentorship
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership (can be either mentee or mentor)
    const { data: existingRequest } = await supabase
      .from('mentorship_requests')
      .select('mentee_id, mentor_id')
      .eq('id', requestId)
      .single()

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Allow both mentor and mentee to delete/end
    if (existingRequest.mentee_id !== userId && existingRequest.mentor_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error } = await supabase
      .from('mentorship_requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      console.error('Error deleting mentorship request:', error)
      return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 })
    }

    // Notify the other party
    const otherUserId = existingRequest.mentee_id === userId 
      ? existingRequest.mentor_id 
      : existingRequest.mentee_id
    
    await supabase
      .from('notifications')
      .insert({
        user_id: otherUserId,
        type: 'mentorship_ended',
        title: 'Mentorship Ended',
        message: 'A mentorship relationship has been ended',
        data: { request_id: requestId },
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in mentorship DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
