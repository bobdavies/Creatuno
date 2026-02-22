// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Get user's notifications
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfiguredServer()) {
      return privateCachedJson({ notifications: [], message: 'Supabase not configured' })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const cursor = searchParams.get('cursor')
    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50)

    const supabase = await createServerClient()

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) throw error

    const rows = data ?? []
    const hasMore = rows.length > limit
    const notifications = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore
      ? notifications[notifications.length - 1]?.created_at ?? null
      : null

    return privateCachedJson({ notifications, nextCursor })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 200 })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, markAllRead } = body

    const supabase = await createServerClient()

    if (markAllRead) {
      // Mark all notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error
      return NextResponse.json({ success: true, markedAll: true })
    } else if (id) {
      // Mark single notification as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Notifications PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

// Delete notification
export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 200 })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notifications DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}

// Create notification (requires auth -- caller can only notify themselves or must be an internal API)
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 200 })
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, type, title, message, data } = body

    if (!user_id || !type || !title || !message) {
      return NextResponse.json(
        { error: 'user_id, type, title, and message are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        title,
        message,
        data: data || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ notification, created: true })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}
