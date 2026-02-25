// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

const ALLOWED_REACTIONS = new Set(['like', 'smile', 'angry', 'excited'])

async function getReactionSummary(supabase: any, postId: string) {
  const { data } = await supabase
    .from('post_reactions')
    .select('reaction_type')
    .eq('post_id', postId)

  const reactionCounts = { like: 0, smile: 0, angry: 0, excited: 0 }
  for (const row of data || []) {
    if (row?.reaction_type && row.reaction_type in reactionCounts) {
      reactionCounts[row.reaction_type as keyof typeof reactionCounts] += 1
    }
  }
  return reactionCounts
}

// POST - Set, switch, or remove a post reaction
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
    const { post_id, reaction_type } = body

    if (!post_id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const incomingReaction = typeof reaction_type === 'string'
      ? reaction_type.trim().toLowerCase()
      : 'like'

    if (!ALLOWED_REACTIONS.has(incomingReaction)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // one reaction per user per post
    const { data: existingReaction } = await supabase
      .from('post_reactions')
      .select('id, reaction_type')
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingReaction) {
      const { error: insertError } = await supabase
        .from('post_reactions')
        .insert({
          post_id,
          user_id: userId,
          reaction_type: incomingReaction,
        })

      if (insertError) {
        console.error('Error creating reaction:', insertError)
        return NextResponse.json({ error: 'Failed to react to post' }, { status: 500 })
      }
    } else if (existingReaction.reaction_type === incomingReaction) {
      // Toggle off same reaction.
      const { error: deleteError } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Error removing reaction:', deleteError)
        return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })
      }
    } else {
      const { error: updateError } = await supabase
        .from('post_reactions')
        .update({ reaction_type: incomingReaction })
        .eq('id', existingReaction.id)

      if (updateError) {
        console.error('Error switching reaction:', updateError)
        return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 })
      }
    }

    const reactionCounts = await getReactionSummary(supabase, post_id)
    const myReactionQuery = await supabase
      .from('post_reactions')
      .select('reaction_type')
      .eq('post_id', post_id)
      .eq('user_id', userId)
      .maybeSingle()

    const myReaction = myReactionQuery.data?.reaction_type || null

    // Keep legacy likes_count in sync with "like" reactions for compatibility.
    await supabase
      .from('posts')
      .update({ likes_count: reactionCounts.like ?? 0 })
      .eq('id', post_id)

    // Notify post author (don't notify yourself) when adding/updating to an active reaction.
    if (myReaction) {
      const { data: post } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', post_id)
        .single()

      if (post && post.user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'post_reaction',
          title: 'New reaction on your post',
          message: `Someone reacted with ${myReaction}`,
          data: { post_id, reaction_type: myReaction },
        })
      }
    }

    return NextResponse.json({ success: true, myReaction, reactionCounts })
  } catch (error) {
    console.error('Error in like POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
