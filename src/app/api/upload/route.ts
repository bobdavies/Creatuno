// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient, isSupabaseConfiguredServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  if (!isSupabaseConfiguredServer()) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string || 'posts'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Normalize MIME type - strip codec parameters like ;codecs=opus
    const normalizedType = file.type.split(';')[0].trim()

    // Determine allowed types and max size based on bucket
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const deliverableTypes = [
      ...imageTypes,
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'image/vnd.adobe.photoshop',
      'application/postscript',
      'image/svg+xml',
      'video/mp4',
      'video/quicktime',
      'application/octet-stream', // catch-all for .psd, .ai, .fig, .sketch etc.
    ]

    const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm']
    const audioTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav']
    const postTypes = [...imageTypes, ...videoTypes, ...audioTypes]

    const isDeliverables = bucket === 'deliverables'
    const actualBucket = isDeliverables ? 'deliverables-protected' : bucket
    const isPosts = bucket === 'posts'
    const allowedTypes = isDeliverables ? [...deliverableTypes, ...audioTypes] : isPosts ? postTypes : imageTypes

    // For posts with video/audio, allow up to 50MB; images stay at 5MB
    const isVideoFile = videoTypes.includes(normalizedType)
    const isAudioFile = audioTypes.includes(normalizedType)
    const maxSize = isDeliverables ? 50 * 1024 * 1024 : (isPosts && (isVideoFile || isAudioFile)) ? 50 * 1024 * 1024 : 5 * 1024 * 1024

    // For deliverables, also check file extension as a fallback
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || ''
    const deliverableExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'zip', 'rar', 'psd', 'ai', 'svg', 'mp4', 'mov', 'fig', 'sketch', 'webm', 'ogg', 'mp3', 'wav']
    const postExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'ogg', 'mp3', 'wav']
    
    const isTypeAllowed = allowedTypes.includes(normalizedType) 
      || (isDeliverables && deliverableExtensions.includes(fileExtension))
      || (isPosts && postExtensions.includes(fileExtension))
      || isAudioFile // Always allow audio files (for voice messages)

    if (!isTypeAllowed) {
      return NextResponse.json({ 
        error: isDeliverables 
          ? 'Invalid file type. Allowed: images, PDF, ZIP, PSD, AI, SVG, MP4, MOV, FIG, Sketch, audio.' 
          : isPosts
          ? 'Invalid file type. Allowed: images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, WebM).'
          : 'Invalid file type. Only images are allowed.' 
      }, { status: 400 })
    }

    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${(isDeliverables || (isPosts && isVideoFile) || isAudioFile) ? '50MB' : '5MB'}.` 
      }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `${userId}/${timestamp}_${randomStr}.${extension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(actualBucket)
      .upload(filename, buffer, {
        contentType: normalizedType,
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    if (isDeliverables) {
      // Private bucket: return storage path only, no public URL
      return NextResponse.json({
        url: null,
        path: data.path,
        bucket: actualBucket,
        protected: true,
      })
    }

    // Public buckets: return public URL
    const { data: urlData } = supabase.storage
      .from(actualBucket)
      .getPublicUrl(data.path)

    return NextResponse.json({ 
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (error) {
    console.error('Error in upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
