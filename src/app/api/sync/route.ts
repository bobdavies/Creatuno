// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

// Allowed tables that can be synced
const ALLOWED_TABLES = new Set([
  'portfolios',
  'projects',
  'posts',
  'messages',
  'applications',
  'mentorship_requests',
  'notifications',
])

/**
 * POST /api/sync
 * Processes a sync queue item from the service worker or client.
 * Accepts: { action, table, data, id, timestamp }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSupabaseConfiguredServer()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { action, table, data, id, timestamp } = body

    // Validate inputs
    if (!action || !table) {
      return NextResponse.json({ error: 'Missing action or table' }, { status: 400 })
    }

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Table "${table}" is not allowed` }, { status: 400 })
    }

    if (!['create', 'update', 'delete'].includes(action)) {
      return NextResponse.json({ error: `Invalid action "${action}"` }, { status: 400 })
    }

    const supabase = createAdminClient()

    switch (action) {
      case 'create': {
        if (!data) {
          return NextResponse.json({ error: 'Missing data for create' }, { status: 400 })
        }

        // Ensure user_id is set to the authenticated user
        const insertData = { ...data, user_id: userId }

        const { data: created, error } = await supabase
          .from(table as any)
          .insert(insertData)
          .select()
          .single()

        if (error) {
          console.error(`Sync create error [${table}]:`, error)
          return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
        }

        return NextResponse.json({ success: true, action: 'create', data: created })
      }

      case 'update': {
        if (!data || !id) {
          return NextResponse.json({ error: 'Missing data or id for update' }, { status: 400 })
        }

        // Conflict resolution: check server timestamp
        if (timestamp) {
          const { data: existing } = await supabase
            .from(table as any)
            .select('updated_at')
            .eq('id', id)
            .single()

          if (existing?.updated_at) {
            const serverTime = new Date(existing.updated_at).getTime()
            if (serverTime > timestamp) {
              // Server version is newer -- skip this update
              return NextResponse.json({
                success: false,
                action: 'update',
                reason: 'conflict',
                message: 'Server version is newer, skipping offline update',
              })
            }
          }
        }

        const { data: updated, error } = await supabase
          .from(table as any)
          .update(data)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single()

        if (error) {
          console.error(`Sync update error [${table}]:`, error)
          return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
        }

        return NextResponse.json({ success: true, action: 'update', data: updated })
      }

      case 'delete': {
        if (!id) {
          return NextResponse.json({ error: 'Missing id for delete' }, { status: 400 })
        }

        const { error } = await supabase
          .from(table as any)
          .delete()
          .eq('id', id)
          .eq('user_id', userId)

        if (error) {
          console.error(`Sync delete error [${table}]:`, error)
          return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
        }

        return NextResponse.json({ success: true, action: 'delete', id })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
