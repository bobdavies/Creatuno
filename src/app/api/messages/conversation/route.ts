// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch all messages between two users (conversation view)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return privateCachedJson({ messages: [], partner: null })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partner_id')

    if (!partnerId) {
      return NextResponse.json({ error: 'partner_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch all messages between the two users (both directions)
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Error fetching conversation:', error)
      return privateCachedJson({ messages: [], partner: null })
    }

    // Fetch partner profile info
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, role, bio')
      .eq('user_id', partnerId)
      .single()

    // Mark all unread messages from partner as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', userId)
      .eq('is_read', false)

    return privateCachedJson({
      messages: messages || [],
      partner: partnerProfile
        ? {
            user_id: partnerProfile.user_id,
            full_name: partnerProfile.full_name || 'Unknown',
            avatar_url: partnerProfile.avatar_url,
            role: partnerProfile.role,
            bio: partnerProfile.bio,
          }
        : null,
    })
  } catch (error) {
    console.error('Error in conversation GET:', error)
    return privateCachedJson({ messages: [], partner: null })
  }
}
