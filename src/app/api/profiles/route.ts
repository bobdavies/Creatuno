// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { privateCachedJson } from '@/lib/api/cache-headers'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

function getSafeErrorDetails(error: unknown): { error: string; detail?: string; hint?: string; code?: string } {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null
  const message = e?.message || 'Failed to save profile'
  const lower = message.toLowerCase()

  if (lower.includes('payout_mode') || lower.includes('user_wallets') || lower.includes('wallet_ledger') || lower.includes('cashout_requests')) {
    return {
      error: 'Wallet cashout schema is not fully applied in the database',
      detail: 'Apply migration 011_wallet_cashout.sql and retry.',
      code: e?.code,
    }
  }

  return {
    error: 'Failed to save profile',
    detail: e?.details || e?.message,
    hint: e?.hint,
    code: e?.code,
  }
}

// Create or update user profile
export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      full_name,
      bio,
      location,
      role,
      skills,
      avatar_url,
      // Role-specific fields
      mentor_expertise,
      is_available_for_mentorship,
      max_mentees,
      hiring_needs,
      hiring_categories,
      investment_interests,
      investment_budget,
      payment_provider,
      payment_provider_id,
      payment_account,
      payout_mode,
    } = body

    const supabase = await createServerClient()

    // Check if profile exists (fetch full data so we can preserve fields)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingProfile) {
      // Update existing profile — only set fields that were explicitly provided
      // This prevents overwriting role, is_mentor, etc. when the client
      // only sends a subset of fields (e.g. just bio and skills).
      const updateData: Record<string, unknown> = {}

      if (full_name !== undefined) updateData.full_name = full_name
      if (bio !== undefined) updateData.bio = bio
      if (location !== undefined) updateData.location = location
      if (body.email !== undefined) updateData.email = body.email
      if (skills !== undefined) updateData.skills = skills
      if (role !== undefined) {
        updateData.role = role
        updateData.is_mentor = role === 'mentor'
      }
      if (mentor_expertise !== undefined) updateData.mentor_expertise = mentor_expertise
      if (is_available_for_mentorship !== undefined) updateData.is_available_for_mentorship = is_available_for_mentorship
      if (max_mentees !== undefined) updateData.max_mentees = max_mentees
      if (hiring_needs !== undefined) updateData.hiring_needs = hiring_needs
      if (hiring_categories !== undefined) updateData.hiring_categories = hiring_categories
      if (investment_interests !== undefined) updateData.investment_interests = investment_interests
      if (investment_budget !== undefined) updateData.investment_budget = investment_budget
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url
      if (payment_provider !== undefined) updateData.payment_provider = payment_provider
      if (payment_provider_id !== undefined) updateData.payment_provider_id = payment_provider_id
      if (payment_account !== undefined) updateData.payment_account = payment_account
      if (payout_mode !== undefined) updateData.payout_mode = payout_mode

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ profile: data, updated: true })
    } else {
      // Create new profile — defaults are safe here (first-time onboarding)
      const profileData = {
        user_id: userId,
        email: body.email || '',
        full_name,
        bio,
        location,
        role: role || 'creative',
        skills: skills || [],
        is_mentor: role === 'mentor',
        mentor_expertise: mentor_expertise || [],
        is_available_for_mentorship: is_available_for_mentorship ?? false,
        max_mentees: max_mentees || 5,
        hiring_needs: hiring_needs || null,
        hiring_categories: hiring_categories || [],
        investment_interests: investment_interests || [],
        investment_budget: investment_budget || null,
        avatar_url: avatar_url || null,
        payment_provider: payment_provider || null,
        payment_provider_id: payment_provider_id || null,
        payment_account: payment_account || null,
        payout_mode: payout_mode || 'auto',
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ profile: data, created: true })
    }
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(getSafeErrorDetails(error), { status: 500 })
  }
}

// Get current user's profile
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return privateCachedJson({ profile: data })
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}
