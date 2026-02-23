import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, createServerClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

/**
 * GET /api/deliverables/preview/[fileId]
 *
 * Serves a preview of a protected deliverable file.
 * - Images: returns a short-lived signed URL (5 min) with cache-busting
 * - Other files: returns metadata only (name, size, type) with no content
 *
 * Query params:
 *   ?submission_id=<uuid>  -- required to verify access
 *   ?path=<storage_path>   -- the file path in the protected bucket
 *   ?name=<filename>       -- original filename
 *   ?type=<mime_type>      -- MIME type
 *   ?size=<bytes>          -- file size
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
  const fileName = searchParams.get('name')
  const fileType = searchParams.get('type') || ''
  const fileSize = searchParams.get('size')
  const { fileId } = await params

  if (!submissionId || !filePath) {
    return NextResponse.json({ error: 'submission_id and path are required' }, { status: 400 })
  }

  try {
    const supabase = await createServerClient()

    // Verify the requester is a participant of this submission
    const { data: submission, error } = await supabase
      .from('work_submissions')
      .select('id, creative_id, employer_id')
      .eq('id', submissionId)
      .single()

    if (error || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (submission.creative_id !== userId && submission.employer_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const isImage = fileType.startsWith('image/')

    if (isImage) {
      // For images: generate a short-lived signed URL for preview
      const admin = createAdminClient()
      const { data: signedUrlData, error: signedError } = await admin.storage
        .from('deliverables-protected')
        .createSignedUrl(filePath, 300) // 5 minutes

      if (signedError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: 'Failed to generate preview URL' }, { status: 500 })
      }

      return NextResponse.json({
        preview_type: 'image',
        preview_url: signedUrlData.signedUrl,
        name: fileName,
        type: fileType,
        size: fileSize ? parseInt(fileSize) : null,
        watermarked: true,
        expires_in: 300,
      })
    }

    // For non-image files: metadata only
    return NextResponse.json({
      preview_type: 'metadata',
      preview_url: null,
      name: fileName,
      type: fileType,
      size: fileSize ? parseInt(fileSize) : null,
      watermarked: false,
    })
  } catch (err) {
    console.error('Error in deliverables preview:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
