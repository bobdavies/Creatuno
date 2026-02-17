// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Create or update portfolio
export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json(
        { error: 'Supabase not configured', portfolio: null },
        { status: 200 } // Return 200 to not block the app
      )
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, description, tagline, slug, is_public, localId } = body

    const supabase = await createServerClient()

    // Check if portfolio already exists (by localId in metadata or by id)
    let existingPortfolio = null
    
    if (id) {
      const { data } = await supabase
        .from('portfolios')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single()
      existingPortfolio = data
    }

    const portfolioData = {
      user_id: userId,
      title,
      description: description || null,
      tagline: tagline || null,
      slug: slug || localId,
      is_public: is_public ?? true,
    }

    if (existingPortfolio) {
      // Update existing portfolio
      const { data, error } = await supabase
        .from('portfolios')
        .update(portfolioData)
        .eq('id', existingPortfolio.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ portfolio: data, updated: true })
    } else {
      // Create new portfolio
      const { data, error } = await supabase
        .from('portfolios')
        .insert(portfolioData)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ portfolio: data, created: true })
    }
  } catch (error) {
    console.error('Portfolio API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save portfolio' },
      { status: 500 }
    )
  }
}

// Get current user's portfolios
export async function GET() {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ portfolios: [], message: 'Supabase not configured' })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ portfolios: data })
  } catch (error) {
    console.error('Portfolio GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    )
  }
}

// Delete a portfolio
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
    const portfolioId = searchParams.get('id')

    if (!portfolioId) {
      return NextResponse.json({ error: 'Portfolio id required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership before deleting
    const { data: portfolio, error: fetchError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !portfolio) {
      return NextResponse.json({ error: 'Portfolio not found or access denied' }, { status: 404 })
    }

    // Delete all projects associated with this portfolio first
    const { error: projectsDeleteError } = await supabase
      .from('projects')
      .delete()
      .eq('portfolio_id', portfolioId)

    if (projectsDeleteError) {
      console.warn('Failed to delete portfolio projects:', projectsDeleteError)
    }

    // Delete the portfolio
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Portfolio DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete portfolio' },
      { status: 500 }
    )
  }
}
