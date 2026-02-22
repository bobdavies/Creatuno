// @ts-nocheck — Supabase types not generated for this table
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch user's applications or check for existing application
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({ applications: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const opportunityId = searchParams.get('opportunity_id')
    const role = searchParams.get('role')

    const supabase = await createServerClient()

    // Employer view: fetch all applications for opportunities owned by this user
    if (role === 'employer') {
      // First, get all opportunity IDs owned by this employer
      const { data: myOpportunities, error: oppError } = await supabase
        .from('opportunities')
        .select('id')
        .eq('user_id', userId)

      if (oppError || !myOpportunities || myOpportunities.length === 0) {
        return privateCachedJson({ applications: [] })
      }

      const oppIds = myOpportunities.map((o: { id: string }) => o.id)

      const { data: applications, error } = await supabase
        .from('applications')
        .select(`
          *,
          opportunity:opportunities!opportunity_id (
            id,
            title,
            type,
            category,
            budget_min,
            budget_max,
            currency,
            deadline,
            status
          ),
          applicant:profiles!applicant_id (
            full_name,
            avatar_url,
            bio,
            skills
          )
        `)
        .in('opportunity_id', oppIds)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching employer applications:', error)
        return privateCachedJson({ applications: [] })
      }

      return privateCachedJson({ applications: applications || [] })
    }

    // Default: fetch applications by the current user (creative/applicant view)
    let query = supabase
      .from('applications')
      .select(`
        *,
        opportunity:opportunities!opportunity_id (
          id,
          title,
          type,
          category,
          budget_min,
          budget_max,
          currency,
          deadline,
          status,
          employer:profiles!user_id (
            full_name,
            avatar_url
          )
        )
      `)
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })

    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId)
    }

    const { data: applications, error } = await query

    if (error) {
      console.error('Error fetching applications:', error)
      return privateCachedJson({ applications: [] })
    }

    return privateCachedJson({ applications: applications || [] })
  } catch (error) {
    console.error('Error in applications GET:', error)
    return privateCachedJson({ applications: [] })
  }
}

// POST - Submit a new application
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
    const { opportunity_id, portfolio_id, cover_letter, proposed_budget } = body

    if (!opportunity_id || !portfolio_id || !cover_letter) {
      return NextResponse.json(
        { error: 'Opportunity ID, portfolio ID, and cover letter are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Check if already applied
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('opportunity_id', opportunity_id)
      .eq('applicant_id', userId)
      .single()

    if (existingApp) {
      return NextResponse.json(
        { error: 'You have already applied for this opportunity' },
        { status: 400 }
      )
    }

    // Prevent self-application: check if the user owns this opportunity
    const { data: oppOwner } = await supabase
      .from('opportunities')
      .select('user_id')
      .eq('id', opportunity_id)
      .single()

    if (oppOwner && (oppOwner as { user_id: string }).user_id === userId) {
      return NextResponse.json(
        { error: 'You cannot apply to your own opportunity' },
        { status: 403 }
      )
    }

    // Create application
    const { data: application, error } = await (supabase
      .from('applications') as any)
      .insert({
        opportunity_id,
        applicant_id: userId,
        portfolio_id,
        cover_letter,
        proposed_budget,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating application:', error)
      return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
    }

    // Update application count on opportunity
    await supabase.rpc('increment_applications_count', {
      row_id: opportunity_id,
    })

    // Notify the opportunity author about the new application
    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('user_id, title')
      .eq('id', opportunity_id)
      .single()

    if (opportunity && opportunity.user_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: opportunity.user_id,
        type: 'new_application',
        title: 'New Application Received',
        message: `Someone applied to "${opportunity.title}"`,
        data: { opportunity_id, application_id: application.id },
      })
    }

    return NextResponse.json({ application })
  } catch (error) {
    console.error('Error in applications POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update application status (for employers)
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
    const { application_id, status } = body

    if (!application_id || !status) {
      return NextResponse.json(
        { error: 'Application ID and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'reviewing', 'accepted', 'rejected', 'withdrawn']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: application, error } = await supabase
      .from('applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', application_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating application:', error)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    // Notify the applicant about the status change
    if (application && status !== 'pending') {
      const statusMessages: Record<string, { title: string; message: string }> = {
        reviewing: {
          title: 'Application Under Review',
          message: 'Your application is being reviewed by the employer',
        },
        accepted: {
          title: 'Application Accepted!',
          message: 'Congratulations! Your application has been accepted',
        },
        rejected: {
          title: 'Application Update',
          message: 'Unfortunately, your application was not selected this time',
        },
      }

      const notif = statusMessages[status]
      if (notif) {
        await supabase.from('notifications').insert({
          user_id: application.applicant_id,
          type: 'application_status',
          title: notif.title,
          message: notif.message,
          data: { application_id, status },
        })
      }
    }

    return NextResponse.json({ application })
  } catch (error) {
    console.error('Error in applications PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Withdraw application
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
    const applicationId = searchParams.get('id')

    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership
    const { data: existingApp } = await supabase
      .from('applications')
      .select('applicant_id, opportunity_id')
      .eq('id', applicationId)
      .single()

    if (!existingApp || existingApp.applicant_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', applicationId)

    if (error) {
      console.error('Error deleting application:', error)
      return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
    }

    // Decrement application count
    await supabase.rpc('decrement_applications_count', {
      row_id: existingApp.opportunity_id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in applications DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
