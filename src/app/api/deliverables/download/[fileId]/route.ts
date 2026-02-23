import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

/**
 * GET /api/deliverables/download/[fileId]
 *
 * Serves full-access download of a protected deliverable file.
 * Only available after payment is confirmed (files_released = true).
 *
 * Query params:
 *   ?submission_id=<uuid>  -- required to look up escrow
 *   ?path=<storage_path>   -- file path in protected bucket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const submissionId = searchParams.get('submission_id')
  const filePath = searchParams.get('path')
  const { fileId } = await params

  if (!submissionId || !filePath) {
    return NextResponse.json({ error: 'submission_id and path are required' }, { status: 400 })
  }

  try {
    const supabase = await createServerClient()

    // Verify the employer owns this submission
    const { data: submission, error: subError } = await supabase
      .from('work_submissions')
      .select('id, employer_id, creative_id')
      .eq('id', submissionId)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const isEmployer = submission.employer_id === userId
    const isCreative = submission.creative_id === userId

    // Creatives can always download their own files
    if (isCreative) {
      const admin = createAdminClient()
      const { data: signedUrlData, error: signedError } = await admin.storage
        .from('deliverables-protected')
        .createSignedUrl(filePath, 3600)

      if (signedError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
      }

      return NextResponse.redirect(signedUrlData.signedUrl)
    }

    if (!isEmployer) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if files have been released via escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('delivery_escrows')
      .select('files_released')
      .eq('submission_id', submissionId)
      .eq('files_released', true)
      .limit(1)
      .maybeSingle()

    if (escrowError) {
      console.error('Error checking escrow:', escrowError)
      return NextResponse.json({ error: 'Failed to verify access' }, { status: 500 })
    }

    if (!escrow?.files_released) {
      return NextResponse.json(
        { error: 'Files have not been released yet. Payment is required to access these files.' },
        { status: 403 }
      )
    }

    // Generate a 1-hour signed URL for download
    const admin = createAdminClient()
    const { data: signedUrlData, error: signedError } = await admin.storage
      .from('deliverables-protected')
      .createSignedUrl(filePath, 3600)

    if (signedError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.redirect(signedUrlData.signedUrl)
  } catch (err) {
    console.error('Error in deliverables download:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
