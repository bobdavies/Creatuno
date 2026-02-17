// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// POST - Add a comment to a post
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
    const { post_id, content } = body

    if (!post_id || !content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Post ID and content are required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id,
        user_id: userId,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding comment:', error)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Update comments count on post
    const { error: updateError } = await supabase.rpc('increment_comments_count', {
      row_id: post_id,
    })

    if (updateError) {
      console.error('Error updating comments count:', updateError)
    }

    // Notify post author (don't notify yourself)
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', post_id)
      .single()

    if (post && post.user_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        type: 'post_comment',
        title: 'New comment on your post',
        message: content.trim().substring(0, 100),
        data: { post_id, comment_id: comment.id },
      })
    }

    return NextResponse.json({ comment })
  } catch (error) {
    console.error('Error in comment POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get comments for a post
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ comments: [] })
  }

  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('post_id')

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json({ comments: [] })
    }

    return NextResponse.json({ comments: comments || [] })
  } catch (error) {
    console.error('Error in comments GET:', error)
    return NextResponse.json({ comments: [] })
  }
}
