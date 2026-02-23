import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

/**
 * GET /api/payments/status?submission_id=...
 * GET /api/payments/status?escrow_id=...
 *
 * Returns current escrow/payment status for a submission.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const submissionId = searchParams.get('submission_id')
  const escrowId = searchParams.get('escrow_id')

  if (!submissionId && !escrowId) {
    return NextResponse.json({ error: 'submission_id or escrow_id is required' }, { status: 400 })
  }

  try {
    const supabase = await createServerClient()

    let query = supabase.from('delivery_escrows').select('*')

    if (escrowId) {
      query = query.eq('id', escrowId)
    } else if (submissionId) {
      query = query.eq('submission_id', submissionId)
    }

    const { data: escrows, error } = await query
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching escrow status:', error)
      return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 })
    }

    // Filter to only show escrows the user is involved in
    const userEscrows = (escrows || []).filter(
      e => e.creative_id === userId || e.employer_id === userId
    )

    if (userEscrows.length === 0) {
      return NextResponse.json({
        escrow: null,
        payment_status: 'none',
        files_released: false,
      })
    }

    const latest = userEscrows[0]

    return NextResponse.json({
      escrow: latest,
      payment_status: latest.status,
      files_released: latest.files_released,
      payment_amount: latest.payment_amount,
      payment_percentage: latest.payment_percentage,
      currency: latest.currency,
    })
  } catch (error) {
    console.error('Error in payments/status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
