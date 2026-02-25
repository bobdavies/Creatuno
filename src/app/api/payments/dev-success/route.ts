import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isDevBypass(): boolean {
  if (process.env.MONIME_DEV_BYPASS === 'true') return true
  if (process.env.NODE_ENV === 'development' && process.env.MONIME_ACCESS_TOKEN?.startsWith('mon_test_')) return true
  return false
}

/**
 * GET /api/payments/dev-success?escrow_id=...
 *
 * Simulates a successful Monime payment callback for local development.
 * Only active when MONIME_DEV_BYPASS=true or when using a test token in dev.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!isDevBypass()) {
    return NextResponse.json(
      { error: 'Dev bypass is not enabled. This endpoint is only available in development mode.' },
      { status: 403 }
    )
  }

  if (!isSupabaseConfiguredServer()) {
    return NextResponse.redirect(`${appUrl}/dashboard/employer/deliverables/success?payment=error`)
  }

  const { searchParams } = new URL(request.url)
  const escrowId = searchParams.get('escrow_id')

  if (!escrowId) {
    return NextResponse.redirect(`${appUrl}/dashboard/employer/deliverables/success?payment=error`)
  }

  try {
    const supabase = createAdminClient()

    const { data: escrow, error } = await supabase
      .from('delivery_escrows')
      .select('*')
      .eq('id', escrowId)
      .single()

    if (error || !escrow) {
      console.error('[DEV BYPASS] Escrow not found:', escrowId, error)
      return NextResponse.redirect(`${appUrl}/dashboard/employer/deliverables/success?payment=error`)
    }

    const pendingStatuses = ['awaiting_payment', 'revision_exhausted_awaiting_payment', 'review_approved']
    if (!pendingStatuses.includes(escrow.status)) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/employer/deliverables/success?payment=success&escrow_id=${escrowId}`
      )
    }

    const isFullPayment = escrow.payment_percentage === 100

    await supabase
      .from('delivery_escrows')
      .update({
        status: isFullPayment ? 'payment_received' : 'partial_payment_received',
        files_released: isFullPayment,
      })
      .eq('id', escrowId)

    if (isFullPayment) {
      await supabase
        .from('work_submissions')
        .update({ status: 'approved' })
        .eq('id', escrow.submission_id)
    }

    await supabase.from('transactions').insert({
      opportunity_id: escrow.opportunity_id,
      application_id: escrow.application_id,
      payer_id: escrow.employer_id,
      payee_id: escrow.creative_id,
      amount: escrow.payment_amount,
      currency: escrow.currency,
      platform_fee: escrow.platform_fee,
      net_amount: escrow.net_payout_amount,
      monime_checkout_session_id: escrow.monime_checkout_session_id,
      payment_type: isFullPayment ? 'full' : 'partial_50',
      escrow_id: escrowId,
      status: 'completed',
    })

    const { data: opportunity } = await supabase
      .from('opportunities')
      .select('title')
      .eq('id', escrow.opportunity_id)
      .single()

    const oppTitle = opportunity?.title || 'a project'

    await supabase.from('notifications').insert([
      {
        user_id: escrow.employer_id,
        type: 'payment_completed',
        title: 'Payment Successful (Dev)',
        message: isFullPayment
          ? `[DEV] Your payment for "${oppTitle}" is complete. You now have full access to the delivered files.`
          : `[DEV] Your 50% compensation payment for "${oppTitle}" is complete.`,
        data: { escrow_id: escrowId, submission_id: escrow.submission_id },
      },
      {
        user_id: escrow.creative_id,
        type: 'payment_received',
        title: isFullPayment ? 'Payment Received! (Dev)' : '50% Compensation Received (Dev)',
        message: isFullPayment
          ? `[DEV] The employer has paid for your work on "${oppTitle}".`
          : `[DEV] You have received 50% compensation for your time on "${oppTitle}".`,
        data: { escrow_id: escrowId, submission_id: escrow.submission_id, amount: escrow.net_payout_amount },
      },
    ])

    console.warn(`[DEV BYPASS] Simulated successful payment for escrow ${escrowId}`)

    return NextResponse.redirect(
      `${appUrl}/dashboard/employer/deliverables/success?payment=success&escrow_id=${escrowId}`
    )
  } catch (err) {
    console.error('[DEV BYPASS] Error processing dev payment:', err)
    return NextResponse.redirect(`${appUrl}/dashboard/employer/deliverables/success?payment=error`)
  }
}
