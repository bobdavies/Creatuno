// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { publicCachedJson } from '@/lib/api/cache-headers'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.toLowerCase() || ''
  const type = searchParams.get('type') // Optional filter: portfolio, user, opportunity, post

  if (!query.trim()) {
    return NextResponse.json({ results: [] })
  }

  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ results: [] })
  }

  try {
    const supabase = await createServerClient()
    const results: any[] = []

    // Escape SQL LIKE special characters to prevent injection
    const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

    // Search portfolios
    if (!type || type === 'portfolio') {
      const { data: portfolios } = await supabase
        .from('portfolios')
        .select(`
          id,
          title,
          description,
          tagline,
          slug,
          user_id,
          profiles:user_id (
            id,
            full_name
          )
        `)
        .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,tagline.ilike.%${escaped}%`)
        .eq('is_public', true)
        .limit(10)

      if (portfolios) {
        results.push(...portfolios.map(p => ({
          id: p.id,
          type: 'portfolio',
          title: p.title,
          subtitle: (p.profiles as any)?.full_name || 'Unknown Creator',
          description: p.description || p.tagline,
          link: `/portfolio/${(p.profiles as any)?.id || p.user_id}/${p.slug}`,
          tags: [],
        })))
      }
    }

    // Search users/profiles (including location)
    if (!type || type === 'user') {
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, full_name, bio, role, skills, avatar_url, location')
        .or(`full_name.ilike.%${escaped}%,bio.ilike.%${escaped}%,skills.cs.{${escaped}},location.ilike.%${escaped}%`)
        .limit(10)

      if (users) {
        results.push(...users.map(u => ({
          id: u.user_id,
          type: 'user',
          title: u.full_name || 'Unknown User',
          subtitle: u.location ? `${u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Creative'} • ${u.location}` : (u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Creative'),
          description: u.bio,
          imageUrl: u.avatar_url,
          link: `/portfolio/user/${u.user_id}`,
          tags: u.skills?.slice(0, 3) || [],
        })))
      }
    }

    // Search opportunities
    if (!type || type === 'opportunity') {
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, title, description, type, category, budget_min, budget_max, currency, location')
        .or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,category.ilike.%${escaped}%`)
        .eq('status', 'open')
        .limit(10)

      if (opportunities) {
        results.push(...opportunities.map(o => ({
          id: o.id,
          type: 'opportunity',
          title: o.title,
          subtitle: `${o.type === 'job' ? 'Job' : o.type === 'gig' ? 'Gig' : 'Investment'} • $${o.budget_min} - $${o.budget_max}`,
          description: o.description,
          link: `/opportunities/${o.id}`,
          tags: [o.type, o.category].filter(Boolean),
        })))
      }
    }

    // Search posts
    if (!type || type === 'post') {
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles:user_id (
            full_name
          )
        `)
        .ilike('content', `%${escaped}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (posts) {
        results.push(...posts.map(p => ({
          id: p.id,
          type: 'post',
          title: p.content.slice(0, 100) + (p.content.length > 100 ? '...' : ''),
          subtitle: (p.profiles as any)?.full_name || 'Unknown User',
          description: '',
          link: '/feed',
          tags: [],
        })))
      }
    }

    // Sort results by relevance (exact matches first)
    results.sort((a, b) => {
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      const aExact = aTitle.includes(query)
      const bExact = bTitle.includes(query)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })

    return publicCachedJson({ results: results.slice(0, 30) }, 30, 60)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
