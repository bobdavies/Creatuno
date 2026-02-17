// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// POST - Like or unlike a post
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
    const { post_id, action } = body

    if (!post_id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    if (action === 'like') {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post_id)
        .eq('user_id', userId)
        .single()

      if (existingLike) {
        return NextResponse.json({ success: true, already_liked: true })
      }

      // Add like
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          post_id,
          user_id: userId,
        })

      if (likeError) {
        console.error('Error liking post:', likeError)
        return NextResponse.json({ error: 'Failed to like post' }, { status: 500 })
      }

      // Update likes count on post
      const { error: updateError } = await supabase.rpc('increment_likes_count', {
        row_id: post_id,
      })

      if (updateError) {
        console.error('Error updating likes count:', updateError)
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
          type: 'post_like',
          title: 'Someone liked your post',
          message: 'Your post received a new like',
          data: { post_id },
        })
      }
    } else {
      // Remove like
      const { error: unlikeError } = await supabase
        .from('likes')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', userId)

      if (unlikeError) {
        console.error('Error unliking post:', unlikeError)
        return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 })
      }

      // Decrement likes count on post
      const { error: updateError } = await supabase.rpc('decrement_likes_count', {
        row_id: post_id,
      })

      if (updateError) {
        console.error('Error updating likes count:', updateError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in like POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
