// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch posts
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ posts: [] })
  }

  try {
    const { userId } = await auth()
    const supabase = await createServerClient()
    
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching posts:', error)
      return NextResponse.json({ posts: [] })
    }

    // If user is authenticated, check which posts they've liked
    let userLikes: Set<string> = new Set()
    if (userId && posts && posts.length > 0) {
      const postIds = posts.map((p: any) => p.id)
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds)
      
      if (likes) {
        userLikes = new Set(likes.map((l: any) => l.post_id))
      }
    }

    // Add hasLiked to each post
    const postsWithLikeStatus = (posts || []).map((post: any) => ({
      ...post,
      hasLiked: userLikes.has(post.id),
    }))

    return NextResponse.json({ posts: postsWithLikeStatus })
  } catch (error) {
    console.error('Error in posts GET:', error)
    return NextResponse.json({ posts: [] })
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
    const { content, images, video_url } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Content must be under 1000 characters' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: content.trim(),
        images: images || [],
        video_url: video_url || null,
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
