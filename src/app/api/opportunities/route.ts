// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch opportunities
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ opportunities: [], opportunity: null })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') // gig, job, investment
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    const supabase = await createServerClient()

    // Fetch single opportunity
    if (id) {
      const { data: opp, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching opportunity:', error)
        return NextResponse.json({ opportunity: null })
      }

      const transformedOpp = opp ? {
        id: opp.id,
        title: opp.title,
        description: opp.description,
        type: opp.type,
        category: opp.category,
        budgetMin: opp.budget_min,
        budgetMax: opp.budget_max,
        currency: opp.currency,
        location: opp.location,
        isRemote: opp.is_remote,
        deadline: opp.deadline,
        requiredSkills: opp.required_skills || [],
        experienceLevel: opp.experience_level,
        companyName: opp.company_name,
        applicationsCount: opp.applications_count || 0,
        createdAt: opp.created_at,
        author: {
          id: opp.user_id,
          fullName: (opp.profiles as any)?.full_name || 'Unknown',
          avatarUrl: (opp.profiles as any)?.avatar_url,
        },
      } : null

      return NextResponse.json({ opportunity: transformedOpp })
    }

    // Check if requesting user's own opportunities (employer dashboard)
    const my = searchParams.get('my')

    // Fetch all opportunities
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })

    if (my === 'true') {
      // Employer wants their own opportunities (all statuses)
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      query = query.eq('user_id', userId)
    } else {
      // Public listing: only show open opportunities
      query = query.eq('status', 'open')
    }

    if (type) {
      query = query.eq('type', type)
    }

    if (category && category !== 'All Categories') {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: opportunities, error } = await query.limit(50)

    if (error) {
      console.error('Error fetching opportunities:', error)
      return NextResponse.json({ opportunities: [] })
    }

    // Transform data
    const transformedOpportunities = opportunities?.map(opp => ({
      id: opp.id,
      title: opp.title,
      description: opp.description,
      type: opp.type,
      category: opp.category,
      budgetMin: opp.budget_min,
      budgetMax: opp.budget_max,
      currency: opp.currency,
      location: opp.location,
      isRemote: opp.is_remote,
      deadline: opp.deadline,
      requiredSkills: opp.required_skills || [],
      experienceLevel: opp.experience_level,
      companyName: opp.company_name,
      applicationsCount: opp.applications_count || 0,
      createdAt: opp.created_at,
      author: {
        id: opp.user_id,
        fullName: (opp.profiles as any)?.full_name || 'Unknown',
        avatarUrl: (opp.profiles as any)?.avatar_url,
      },
    })) || []

    return NextResponse.json({ opportunities: transformedOpportunities })
  } catch (error) {
    console.error('Error in opportunities GET:', error)
    return NextResponse.json({ opportunities: [] })
  }
}

// POST - Create a new opportunity (for employers)
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
    const {
      title,
      description,
      type,
      category,
      budget_min,
      budget_max,
      currency,
      location,
      is_remote,
      deadline,
      required_skills,
      experience_level,
      company_name,
    } = body

    if (!title || !description || !type || !category) {
      return NextResponse.json(
        { error: 'Title, description, type, and category are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title,
        description,
        type,
        category,
        budget_min: budget_min || 0,
        budget_max: budget_max || 0,
        currency: currency || 'USD',
        location: location || 'Remote',
        is_remote: is_remote ?? true,
        deadline,
        required_skills: required_skills || [],
        experience_level,
        company_name,
        status: 'open',
        applications_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating opportunity:', error)
      return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 })
    }

    return NextResponse.json({ opportunity })
  } catch (error) {
    console.error('Error in opportunities POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update opportunity
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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Opportunity ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existingOpp || existingOpp.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating opportunity:', error)
      return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 })
    }

    return NextResponse.json({ opportunity })
  } catch (error) {
    console.error('Error in opportunities PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Close/delete opportunity
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
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Opportunity ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existingOpp || existingOpp.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Soft delete by setting status to closed
    const { error } = await supabase
      .from('opportunities')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error closing opportunity:', error)
      return NextResponse.json({ error: 'Failed to close opportunity' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in opportunities DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
