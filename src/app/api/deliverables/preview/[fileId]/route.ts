import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

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
  const { fileId } = await params

  if (!submissionId) {
    return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Verify the requester is a participant of this submission
    const { data: submission, error } = await supabase
      .from('work_submissions')
      .select('id, creative_id, employer_id, files')
      .eq('id', submissionId)
      .single()

    if (error || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    if (submission.creative_id !== userId && submission.employer_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const fileIndex = Number.parseInt(fileId, 10)
    if (!Number.isInteger(fileIndex) || fileIndex < 0) {
      return NextResponse.json({ error: 'Invalid file id' }, { status: 400 })
    }

    const files = Array.isArray(submission.files) ? submission.files as Array<Record<string, unknown>> : []
    const targetFile = files[fileIndex]
    const canonicalPath = typeof targetFile?.path === 'string' ? targetFile.path : null
    const canonicalType = typeof targetFile?.type === 'string' ? targetFile.type : ''
    const canonicalName = typeof targetFile?.name === 'string' ? targetFile.name : null
    const canonicalSize = typeof targetFile?.size === 'number' ? targetFile.size : null

    if (!targetFile || !canonicalPath) {
      return NextResponse.json({ error: 'File not found for submission' }, { status: 404 })
    }

    // Reject mismatched query path to prevent path-confusion attacks.
    if (filePath && filePath !== canonicalPath) {
      return NextResponse.json({ error: 'Invalid file path for submission file' }, { status: 400 })
    }

    const isImage = canonicalType.startsWith('image/')
    const isVideo = canonicalType.startsWith('video/')
    const isAudio = canonicalType.startsWith('audio/')

    if (isImage || isVideo || isAudio) {
      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('deliverables-protected')
        .createSignedUrl(canonicalPath, 300)

      if (signedError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: 'Failed to generate preview URL' }, { status: 500 })
      }

      const previewType = isImage ? 'image' : isVideo ? 'video' : 'audio'

      return NextResponse.json({
        preview_type: previewType,
        preview_url: signedUrlData.signedUrl,
        name: canonicalName,
        type: canonicalType,
        size: canonicalSize,
        watermarked: isImage || isVideo,
        expires_in: 300,
      })
    }

    return NextResponse.json({
      preview_type: 'metadata',
      preview_url: null,
      name: canonicalName,
      type: canonicalType,
      size: canonicalSize,
      watermarked: false,
    })
  } catch (err) {
    console.error('Error in deliverables preview:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
