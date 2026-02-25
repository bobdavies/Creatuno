// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch posts (cursor-based pagination)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({ posts: [], nextCursor: null })
  }

  try {
    const { userId } = await auth()
    const supabase = await createServerClient()

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = Math.min(
      Math.max(parseInt(limitParam || '20', 10) || 20, 1),
      50
    )
    const cursor = searchParams.get('cursor') || null

    let query = supabase
      .from('posts')
      .select(`
        id,
        content,
        images,
        video_url,
        created_at,
        updated_at,
        user_id,
        likes_count,
        comments_count,
        profiles:user_id (
          full_name,
          avatar_url,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('Error fetching posts:', error)
      return privateCachedJson({ posts: [], nextCursor: null })
    }

    // Determine nextCursor: if we got more than limit, the last one is the cursor
    const hasMore = posts && posts.length > limit
    const items = hasMore ? posts.slice(0, limit) : posts || []
    const nextCursor = hasMore && items.length > 0
      ? (items[items.length - 1] as { created_at: string }).created_at
      : null

    const postIds = items.map((p: any) => p.id)
    const reactionDefaults = { like: 0, smile: 0, angry: 0, excited: 0 }
    const reactionCountsByPost = new Map<string, { like: number; smile: number; angry: number; excited: number }>()
    const myReactionByPost = new Map<string, string | null>()

    if (postIds.length > 0) {
      const { data: reactions, error: reactionsError } = await supabase
        .from('post_reactions')
        .select('post_id, user_id, reaction_type')
        .in('post_id', postIds)

      // Backward-safe fallback if migration has not run yet.
      if (!reactionsError && reactions) {
        for (const row of reactions) {
          const current = reactionCountsByPost.get(row.post_id) || { ...reactionDefaults }
          if (row.reaction_type in current) {
            current[row.reaction_type as keyof typeof current] += 1
          }
          reactionCountsByPost.set(row.post_id, current)

          if (userId && row.user_id === userId) {
            myReactionByPost.set(row.post_id, row.reaction_type)
          }
        }
      } else if (reactionsError) {
        console.warn('post_reactions unavailable, falling back to legacy likes_count:', reactionsError.message)
      }
    }

    // Add reaction metadata while preserving legacy fields for compatibility.
    const postsWithLikeStatus = items.map((post: any) => {
      const reactionCounts = reactionCountsByPost.get(post.id) || { ...reactionDefaults }
      const myReaction = myReactionByPost.get(post.id) || null

      return {
        ...post,
        likes_count: reactionCounts.like || post.likes_count || 0,
        hasLiked: myReaction === 'like',
        myReaction,
        reactionCounts,
      }
    })

    return privateCachedJson({ posts: postsWithLikeStatus, nextCursor })
  } catch (error) {
    console.error('Error in posts GET:', error)
    return privateCachedJson({ posts: [], nextCursor: null })
  }
}

// POST - Create a new post
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
    const rawContent = typeof body?.content === 'string' ? body.content : ''
    const content = rawContent.trim()
    const rawImages = body?.images
    const rawVideoUrl = body?.video_url

    if (rawImages !== undefined && !Array.isArray(rawImages)) {
      return NextResponse.json({ error: 'Images must be an array of URLs' }, { status: 400 })
    }

    if (rawVideoUrl !== undefined && rawVideoUrl !== null && typeof rawVideoUrl !== 'string') {
      return NextResponse.json({ error: 'Video URL must be a string' }, { status: 400 })
    }

    const images = (rawImages || [])
      .filter((url: unknown) => typeof url === 'string')
      .map((url: string) => url.trim())
      .filter(Boolean)

    if ((rawImages || []).length !== images.length) {
      return NextResponse.json({ error: 'Images contain invalid URLs' }, { status: 400 })
    }

    const video_url = typeof rawVideoUrl === 'string' && rawVideoUrl.trim().length > 0
      ? rawVideoUrl.trim()
      : null

    if (!content && images.length === 0 && !video_url) {
      return NextResponse.json({ error: 'Post requires write-up or media' }, { status: 400 })
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Content must be under 1000 characters' }, { status: 400 })
    }

    if (images.length > 4) {
      return NextResponse.json({ error: 'Maximum 4 images per post' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content,
        images,
        video_url,
        likes_count: 0,
        comments_count: 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating post:', error)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error in posts POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a post
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
    const postId = searchParams.get('id')

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Verify ownership
    const { data: existingPost } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (!existingPost || existingPost.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized to delete this post' }, { status: 403 })
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      console.error('Error deleting post:', error)
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in posts DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
