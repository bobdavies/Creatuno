// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch user's bookmarked portfolios
export async function GET() {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ bookmarks: [] })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServerClient()

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select(`
        id,
        created_at,
        portfolio:portfolio_id (
          id,
          title,
          description,
          tagline,
          slug,
          is_public,
          view_count,
          created_at,
          updated_at,
          user_id,
          profiles:user_id (
            full_name,
            avatar_url,
            skills
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return NextResponse.json({ bookmarks: [] })
    }

    return NextResponse.json({ bookmarks: bookmarks || [] })
  } catch (error) {
    console.error('Error in bookmarks GET:', error)
    return NextResponse.json({ bookmarks: [] })
  }
}

// POST - Add a bookmark
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
    const { portfolio_id } = body

    if (!portfolio_id) {
      return NextResponse.json({ error: 'Portfolio ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .insert({
        user_id: userId,
        portfolio_id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already bookmarked' }, { status: 400 })
      }
      console.error('Error creating bookmark:', error)
      return NextResponse.json({ error: 'Failed to bookmark' }, { status: 500 })
    }

    return NextResponse.json({ bookmark })
  } catch (error) {
    console.error('Error in bookmarks POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a bookmark
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
    const portfolioId = searchParams.get('portfolio_id')

    if (!portfolioId) {
      return NextResponse.json({ error: 'Portfolio ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('portfolio_id', portfolioId)

    if (error) {
      console.error('Error deleting bookmark:', error)
      return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in bookmarks DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
