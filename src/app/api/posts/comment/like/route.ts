// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// POST - Like or unlike a comment
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
    const { comment_id, action } = body

    if (!comment_id) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    if (action === 'unlike') {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', comment_id)
        .eq('user_id', userId)

      if (error) {
        console.error('Error unliking comment:', error)
        return NextResponse.json({ error: 'Failed to unlike comment' }, { status: 500 })
      }
    } else {
      const { data: existing } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment_id)
          .eq('user_id', userId)

        if (error) {
          console.error('Error toggling off comment like:', error)
          return NextResponse.json({ error: 'Failed to update comment like' }, { status: 500 })
        }
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id, user_id: userId })

        if (error) {
          console.error('Error liking comment:', error)
          return NextResponse.json({ error: 'Failed to like comment' }, { status: 500 })
        }
      }
    }

    const { count } = await supabase
      .from('comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', comment_id)

    const { data: mine } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', comment_id)
      .eq('user_id', userId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      likesCount: count ?? 0,
      hasLiked: !!mine,
    })
  } catch (error) {
    console.error('Error in comment like POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
