// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET – Fetch work submissions
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({ submissions: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('application_id')
    const role = searchParams.get('role')

    const supabase = await createServerClient()

    if (applicationId) {
      const { data, error } = await supabase
        .from('work_submissions')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching work submissions:', error)
        return privateCachedJson({ submissions: [] })
      }
      return privateCachedJson({ submissions: data || [] })
    } else if (role === 'employer') {
      const { data, error } = await supabase
        .from('work_submissions')
        .select(`
          *,
          profiles:creative_id (
            full_name,
            avatar_url
          )
        `)
        .eq('employer_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching employer submissions:', error)
        return privateCachedJson({ submissions: [] })
      }
      return privateCachedJson({ submissions: data || [] })
    } else {
      const { data, error } = await supabase
        .from('work_submissions')
        .select('*')
        .eq('creative_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching submissions:', error)
        return privateCachedJson({ submissions: [] })
      }
      return privateCachedJson({ submissions: data || [] })
    }
  } catch (error) {
    console.error('Error in work-submissions GET:', error)
    return privateCachedJson({ submissions: [] })
  }
}

// ---------------------------------------------------------------------------
// POST – Creative submits (or resubmits) work
// ---------------------------------------------------------------------------

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
    const { application_id, message, files } = body

    if (!application_id) {
      return NextResponse.json(
        { error: 'Application ID is required' },
        { status: 400 },
      )
    }

    if (!message && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: 'Please provide a message or upload files' },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

    // Verify the application exists, belongs to this user, and is accepted
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select(`
        id,
        applicant_id,
        opportunity_id,
        status,
        opportunities:opportunity_id (
          id,
          user_id,
          title
        )
      `)
      .eq('id', application_id)
      .single()

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.applicant_id !== userId) {
      return NextResponse.json(
        { error: 'You are not the applicant for this application' },
        { status: 403 },
      )
    }

    if (application.status !== 'accepted') {
      return NextResponse.json(
        { error: 'You can only submit work for accepted applications' },
        { status: 400 },
      )
    }

    const opportunity = application.opportunities as unknown as {
      id: string
      user_id: string
      title: string
    }

    // Check if this is a resubmission (revision)
    const { data: existingSubmissions } = await supabase
      .from('work_submissions')
      .select('id, revision_count, status')
      .eq('application_id', application_id)
      .order('created_at', { ascending: false })
      .limit(1)

    const existingSub = existingSubmissions?.[0]
    let revisionCount = 0

    if (existingSub) {
      // This is a resubmission
      if (existingSub.status !== 'revision_requested') {
        return NextResponse.json(
          { error: 'You can only resubmit when a revision has been requested' },
          { status: 400 },
        )
      }
      revisionCount = (existingSub.revision_count || 0) + 1

      if (revisionCount > 2) {
        return NextResponse.json(
          { error: 'Maximum number of revisions (2) has been reached' },
          { status: 400 },
        )
      }
    }

    // Create the work submission
    const { data: submission, error } = await supabase
      .from('work_submissions')
      .insert({
        application_id,
        opportunity_id: opportunity.id,
        creative_id: userId,
        employer_id: opportunity.user_id,
        message: message || '',
        files: files || [],
        status: 'submitted',
        revision_count: revisionCount,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating work submission:', error)
      return NextResponse.json({ error: 'Failed to submit work' }, { status: 500 })
    }

    // If this is a resubmission, mark the old submission as superseded
    if (existingSub) {
      await supabase
        .from('work_submissions')
        .update({ status: 'superseded' })
        .eq('id', existingSub.id)
    }

    // Notify the employer
    const notifMessage = revisionCount > 0
      ? `A creative has resubmitted revised work (revision ${revisionCount}) for "${opportunity.title}"`
      : `A creative has submitted work for "${opportunity.title}"`

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: opportunity.user_id,
      type: 'work_submitted',
      title: revisionCount > 0 ? 'Revised Work Submitted' : 'Work Submitted',
      message: notifMessage,
      data: {
        submission_id: submission.id,
        application_id,
        opportunity_id: opportunity.id,
        revision_count: revisionCount,
      },
    })

    if (notifError) {
      console.error('Failed to send work submission notification:', notifError)
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Error in work-submissions POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH – Employer reviews: approve or request revision
// ---------------------------------------------------------------------------

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
    const { submission_id, status, feedback } = body

    if (!submission_id || !status) {
      return NextResponse.json(
        { error: 'Submission ID and status are required' },
        { status: 400 },
      )
    }

    const validStatuses = ['approved', 'revision_requested']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: 'Invalid status. Must be "approved" or "revision_requested"',
        },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()

    // Fetch the full submission
    const { data: existingSubmission, error: fetchError } = await supabase
      .from('work_submissions')
      .select(`
        id,
        employer_id,
        creative_id,
        opportunity_id,
        application_id,
        revision_count,
        status as current_status
      `)
      .eq('id', submission_id)
      .single()

    if (fetchError || !existingSubmission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (existingSubmission.employer_id !== userId) {
      return NextResponse.json(
        { error: 'You are not authorised to review this submission' },
        { status: 403 },
      )
    }

    const currentRevisionCount = existingSubmission.revision_count || 0

    // Build the update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (feedback !== undefined) {
      updateData.feedback = feedback
    }

    if (status === 'revision_requested') {
      // Enforce the 2-revision cap
      if (currentRevisionCount >= 2) {
        return NextResponse.json(
          {
            error: 'Maximum revisions (2) reached. Please approve the work.',
          },
          { status: 400 },
        )
      }
      updateData.status = 'revision_requested'
    } else if (status === 'approved') {
      updateData.status = 'approved'
    }

    const { data: submission, error } = await supabase
      .from('work_submissions')
      .update(updateData)
      .eq('id', submission_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating work submission:', error)
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
    }

    // Fetch opportunity title for notification
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('title')
      .eq('id', existingSubmission.opportunity_id)
      .single()

    const oppTitle = opportunity?.title || 'an opportunity'

    // Send appropriate notification
    if (status === 'approved') {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: existingSubmission.creative_id,
        type: 'work_approved',
        title: 'Work Approved!',
        message: `Your work for "${oppTitle}" has been approved.`,
        data: {
          submission_id,
          application_id: existingSubmission.application_id,
          opportunity_id: existingSubmission.opportunity_id,
        },
      })
      if (notifErr) console.error('Failed to send approval notification:', notifErr)
    } else if (status === 'revision_requested') {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: existingSubmission.creative_id,
        type: 'revision_requested',
        title: 'Revision Requested',
        message: feedback
          ? `Revision requested for "${oppTitle}": ${feedback.substring(0, 100)}`
          : `A revision has been requested for your work on "${oppTitle}"`,
        data: {
          submission_id,
          application_id: existingSubmission.application_id,
          opportunity_id: existingSubmission.opportunity_id,
          feedback,
          revision_count: currentRevisionCount,
        },
      })
      if (notifErr) console.error('Failed to send revision notification:', notifErr)
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Error in work-submissions PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
