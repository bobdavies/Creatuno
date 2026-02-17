// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// GET - Fetch user's messages (inbox or sent)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ messages: [], count: 0 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'inbox' // 'inbox' or 'sent'
    const countOnly = searchParams.get('count_only') === 'true'

    const supabase = createAdminClient()

    if (countOnly) {
      // Just return count of sent messages
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)

      return NextResponse.json({ count: count ?? 0 })
    }

    let query
    if (folder === 'sent') {
      query = supabase
        .from('messages')
        .select(`
          *,
          receiver:receiver_id (
            full_name,
            avatar_url
          )
        `)
        .eq('sender_id', userId)
    } else {
      query = supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            full_name,
            avatar_url
          )
        `)
        .eq('receiver_id', userId)
    }

    const { data: messages, error } = await query
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ messages: [] })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error('Error in messages GET:', error)
    return NextResponse.json({ messages: [] })
  }
}

// POST - Send a message
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
    const { receiver_id, subject, content, attachments } = body

    if (!receiver_id || !content?.trim()) {
      return NextResponse.json(
        { error: 'Receiver ID and message content are required' },
        { status: 400 }
      )
    }

    if (receiver_id === userId) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const insertData: Record<string, unknown> = {
      sender_id: userId,
      receiver_id,
      subject: subject || '',
      content: content.trim(),
    }

    // Include attachments if provided (stored as JSONB)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      insertData.attachments = attachments
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Notify receiver
    await supabase.from('notifications').insert({
      user_id: receiver_id,
      type: 'new_message',
      title: 'New Message',
      message: `You received a new message: "${subject || content.trim().substring(0, 50)}"`,
      data: { message_id: message.id, sender_id: userId },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error in messages POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Mark message as read
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { message_id } = body

    if (!message_id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: message, error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', message_id)
      .eq('receiver_id', userId) // Only receiver can mark as read
      .select()
      .single()

    if (error) {
      console.error('Error marking message as read:', error)
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error in messages PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
