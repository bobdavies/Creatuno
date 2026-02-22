// @ts-nocheck
import { NextResponse } from 'next/server'
import { publicCachedJson } from '@/lib/api/cache-headers'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Get all public portfolios for discovery
export async function GET() {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ portfolios: [], message: 'Supabase not configured' })
    }

    const supabase = await createServerClient()

    // Fetch public portfolios with user info and project count
    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select(`
        id,
        title,
        tagline,
        description,
        slug,
        view_count,
        is_featured,
        created_at,
        user_id,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          skills
        )
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching portfolios:', error)
      throw error
    }

    // Get first image for each portfolio from projects
    const portfolioIds = portfolios?.map(p => p.id) || []
    const { data: projects } = await supabase
      .from('projects')
      .select('portfolio_id, images')
      .in('portfolio_id', portfolioIds)
      .order('display_order', { ascending: true })

    // Create map of portfolio_id to first image and project count
    const portfolioData = new Map<string, { firstImage: string | null; projectCount: number }>()
    portfolioIds.forEach(id => portfolioData.set(id, { firstImage: null, projectCount: 0 }))

    projects?.forEach(project => {
      const data = portfolioData.get(project.portfolio_id)
      if (data) {
        data.projectCount++
        if (!data.firstImage && project.images?.length > 0) {
          data.firstImage = project.images[0]
        }
      }
    })

    // Transform data for response
    const transformedPortfolios = portfolios?.map(p => {
      const data = portfolioData.get(p.id) || { firstImage: null, projectCount: 0 }
      const profile = p.profiles as { id: string; full_name: string; avatar_url: string | null; skills: string[] } | null
      
      return {
        id: p.id,
        title: p.title,
        tagline: p.tagline,
        description: p.description,
        slug: p.slug,
        viewCount: p.view_count || 0,
        isFeatured: p.is_featured || false,
        createdAt: p.created_at,
        user: {
          fullName: profile?.full_name || 'Unknown User',
          username: profile?.id || p.user_id, // Use user_id as username for URL
          avatarUrl: profile?.avatar_url || null,
          skills: profile?.skills || [],
        },
        firstImage: data.firstImage,
        projectCount: data.projectCount,
      }
    }) || []

    return publicCachedJson({ portfolios: transformedPortfolios }, 60, 300)
  } catch (error) {
    console.error('Public portfolios API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    )
  }
}
