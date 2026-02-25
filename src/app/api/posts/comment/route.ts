// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
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
    const { post_id, content, parent_id } = body

    if (!post_id || !content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Post ID and content are required' }, { status: 400 })
    }

    if (content.trim().length > 1000) {
      return NextResponse.json({ error: 'Comment must be under 1000 characters' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Validate parent comment for threaded replies.
    let parentCommentUserId: string | null = null
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, post_id, user_id')
        .eq('id', parent_id)
        .maybeSingle()

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 400 })
      }
      if (parentComment.post_id !== post_id) {
        return NextResponse.json({ error: 'Parent comment does not belong to this post' }, { status: 400 })
      }
      parentCommentUserId = parentComment.user_id
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id,
        user_id: userId,
        parent_id: parent_id || null,
        content: content.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding comment:', error)
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Update comments count on post (count actual comments)
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post_id)

    await supabase
      .from('posts')
      .update({ comments_count: count ?? 0 })
      .eq('id', post_id)

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

    // Notify parent comment author for threaded replies (excluding duplicates/self)
    if (parentCommentUserId && parentCommentUserId !== userId && parentCommentUserId !== post?.user_id) {
      await supabase.from('notifications').insert({
        user_id: parentCommentUserId,
        type: 'comment_reply',
        title: 'New reply to your comment',
        message: content.trim().substring(0, 100),
        data: { post_id, comment_id: comment.id, parent_id: parent_id || null },
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
    return privateCachedJson({ comments: [] })
  }

  try {
    const { userId } = await auth()
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
      return privateCachedJson({ comments: [] })
    }

    const commentIds = (comments || []).map((c: any) => c.id)
    const likesCountByComment = new Map<string, number>()
    const userLikedCommentIds = new Set<string>()

    if (commentIds.length > 0) {
      const { data: allLikes } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds)

      for (const like of allLikes || []) {
        likesCountByComment.set(like.comment_id, (likesCountByComment.get(like.comment_id) || 0) + 1)
        if (userId && like.user_id === userId) {
          userLikedCommentIds.add(like.comment_id)
        }
      }
    }

    const enrichedComments = (comments || []).map((comment: any) => ({
      ...comment,
      likesCount: likesCountByComment.get(comment.id) || 0,
      hasLiked: userLikedCommentIds.has(comment.id),
    }))

    return privateCachedJson({ comments: enrichedComments })
  } catch (error) {
    console.error('Error in comments GET:', error)
    return privateCachedJson({ comments: [] })
  }
}
