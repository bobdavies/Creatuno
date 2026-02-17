// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfiguredServer, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 },
      )
    }

    // Store in Supabase if configured
    if (isSupabaseConfiguredServer()) {
      const supabase = createAdminClient()

      // Store as a notification-style record so admins can see it
      // We use a special "support_request" type in the notifications table
      await supabase.from('notifications').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Placeholder admin user
        type: 'support_request',
        title: `Support: ${subject.trim().substring(0, 100)}`,
        message: `From ${name.trim()} (${email.trim()}): ${message.trim().substring(0, 500)}`,
        data: {
          sender_name: name.trim(),
          sender_email: email.trim(),
          subject: subject.trim(),
          full_message: message.trim(),
        },
      })
    }

    // Log to server console as a fallback
    console.log('[Support Request]', {
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim().substring(0, 200),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Support request received' })
  } catch (error) {
    console.error('Support API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
