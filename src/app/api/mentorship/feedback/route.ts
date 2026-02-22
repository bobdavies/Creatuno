// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch feedback/reviews for a mentor
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({ feedback: [], averageRating: 0, totalReviews: 0 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const mentorId = searchParams.get('mentor_id')

    if (!mentorId) {
      return NextResponse.json({ error: 'Mentor ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: feedback, error } = await supabase
      .from('mentorship_feedback')
      .select(`
        *,
        reviewer:reviewer_id (
          full_name,
          avatar_url
        )
      `)
      .eq('mentor_id', mentorId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching feedback:', error)
      return privateCachedJson({ feedback: [], averageRating: 0, totalReviews: 0 })
    }

    const reviews = feedback || []
    const totalReviews = reviews.length
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, f) => sum + (f.rating || 0), 0) / totalReviews
      : 0

    return privateCachedJson({
      feedback: reviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
    })
  } catch (error) {
    console.error('Error in feedback GET:', error)
    return privateCachedJson({ feedback: [], averageRating: 0, totalReviews: 0 })
  }
}

// POST - Submit feedback for a mentor
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
    const { mentorship_request_id, mentor_id, rating, feedback_text } = body

    if (!mentorship_request_id || !mentor_id || !rating) {
      return NextResponse.json(
        { error: 'Mentorship request ID, mentor ID, and rating are required' },
        { status: 400 }
      )
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify the reviewer was actually part of this mentorship
    const { data: mentorshipRequest } = await supabase
      .from('mentorship_requests')
      .select('mentee_id, mentor_id')
      .eq('id', mentorship_request_id)
      .single()

    if (!mentorshipRequest || mentorshipRequest.mentee_id !== userId) {
      return NextResponse.json({ error: 'Not authorized to review this mentorship' }, { status: 403 })
    }

    const { data: feedback, error } = await supabase
      .from('mentorship_feedback')
      .insert({
        mentorship_request_id,
        reviewer_id: userId,
        mentor_id,
        rating,
        feedback_text: feedback_text || '',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already reviewed this mentorship' }, { status: 400 })
      }
      console.error('Error creating feedback:', error)
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
    }

    // Notify the mentor
    await supabase.from('notifications').insert({
      user_id: mentor_id,
      type: 'mentorship_feedback',
      title: 'New Mentorship Review',
      message: `You received a ${rating}-star review`,
      data: { feedback_id: feedback.id },
    })

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Error in feedback POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
