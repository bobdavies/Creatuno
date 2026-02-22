// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Create or update project
export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json(
        { error: 'Supabase not configured', project: null },
        { status: 200 }
      )
    }

    const { userId } = await auth()
    
    if (!userId) {
      console.error('[Projects API] Unauthorized - no userId')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      id,
      portfolio_id,
      title,
      description,
      client_name,
      project_date,
      external_link,
      tags,
      images,
      video_url,
      display_order,
    } = body

    console.log('[Projects API] Received request:', { 
      id, 
      portfolio_id, 
      title, 
      userId,
      hasImages: images?.length || 0
    })

    // Validate portfolio_id format
    if (!portfolio_id) {
      console.error('[Projects API] Missing portfolio_id')
      return NextResponse.json({ error: 'portfolio_id is required' }, { status: 400 })
    }

    // Check if portfolio_id looks like a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(portfolio_id)) {
      console.error('[Projects API] Invalid portfolio_id format:', portfolio_id)
      return NextResponse.json({ error: `Invalid portfolio_id format: ${portfolio_id}` }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify the portfolio belongs to the user
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolio_id)
      .eq('user_id', userId)
      .single()

    if (portfolioError) {
      console.error('[Projects API] Portfolio lookup error:', portfolioError)
    }

    if (portfolioError || !portfolio) {
      console.error('[Projects API] Portfolio not found or access denied:', { 
        portfolio_id, 
        userId,
        error: portfolioError?.message 
      })
      return NextResponse.json(
        { error: 'Portfolio not found or access denied' },
        { status: 404 }
      )
    }

    // Handle project_date format - convert "2026-02" to "2026-02-01" for database
    let formattedProjectDate: string | null = null
    if (project_date) {
      // If it's just year-month (e.g., "2026-02"), append "-01" to make it a valid date
      if (/^\d{4}-\d{2}$/.test(project_date)) {
        formattedProjectDate = `${project_date}-01`
      } else {
        formattedProjectDate = project_date
      }
    }

    const projectData = {
      portfolio_id,
      title,
      description: description || null,
      client_name: client_name || null,
      project_date: formattedProjectDate,
      external_link: external_link || null,
      tags: tags || [],
      images: images || [],
      video_url: video_url || null,
      display_order: display_order || 0,
    }

    if (id) {
      // Update existing project
      const { data, error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ project: data, updated: true })
    } else {
      // Create new project
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ project: data, created: true })
    }
  } catch (error) {
    console.error('Project API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save project' },
      { status: 500 }
    )
  }
}

// Get projects for a portfolio
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfiguredServer()) {
      return privateCachedJson({ projects: [], message: 'Supabase not configured' })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const portfolioId = searchParams.get('portfolio_id')

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolio_id required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify the portfolio belongs to the user
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (portfolioError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found or access denied' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('display_order', { ascending: true })

    if (error) throw error

    return privateCachedJson({ projects: data })
  } catch (error) {
    console.error('Project GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// Delete a project
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 200 })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('id')

    if (!projectId) {
      return NextResponse.json({ error: 'project id required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get the project and verify ownership through portfolio
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, portfolio_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify ownership
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', project.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the project
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Project DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
