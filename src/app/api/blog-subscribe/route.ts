// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfiguredServer, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    // Store in Supabase if configured
    if (isSupabaseConfiguredServer()) {
      const supabase = createAdminClient()

      await supabase.from('notifications').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Placeholder admin user
        type: 'blog_subscription',
        title: 'Blog Subscription',
        message: `${name.trim()} (${email.trim()}) subscribed to the blog launch notification.`,
        data: {
          subscriber_name: name.trim(),
          subscriber_email: email.trim(),
        },
      })
    }

    // Log to server console as a fallback
    console.log('[Blog Subscription]', {
      name: name.trim(),
      email: email.trim(),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Subscription received' })
  } catch (error) {
    console.error('Blog subscribe API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
