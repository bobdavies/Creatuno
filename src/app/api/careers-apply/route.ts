// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfiguredServer, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, portfolioUrl, coverLetter } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return NextResponse.json({ error: 'Area of interest is required' }, { status: 400 })
    }
    if (!coverLetter || typeof coverLetter !== 'string' || coverLetter.trim().length < 20) {
      return NextResponse.json(
        { error: 'Cover letter must be at least 20 characters' },
        { status: 400 },
      )
    }

    // Store in Supabase if configured
    if (isSupabaseConfiguredServer()) {
      const supabase = createAdminClient()

      await supabase.from('notifications').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Placeholder admin user
        type: 'career_application',
        title: `Career Application: ${role.trim()} - ${name.trim().substring(0, 50)}`,
        message: `${name.trim()} (${email.trim()}) applied for ${role.trim()}. Cover letter: ${coverLetter.trim().substring(0, 300)}`,
        data: {
          applicant_name: name.trim(),
          applicant_email: email.trim(),
          role_interest: role.trim(),
          portfolio_url: portfolioUrl?.trim() || null,
          cover_letter: coverLetter.trim(),
        },
      })
    }

    // Log to server console as a fallback
    console.log('[Career Application]', {
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      portfolioUrl: portfolioUrl?.trim() || 'N/A',
      coverLetter: coverLetter.trim().substring(0, 200),
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Application received' })
  } catch (error) {
    console.error('Careers apply API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
