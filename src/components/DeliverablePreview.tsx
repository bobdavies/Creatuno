'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Download01Icon, FileAttachmentIcon, ViewIcon } from '@hugeicons/core-free-icons'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DeliverableFile {
  url: string | null
  name: string
  size: number
  type: string
  path?: string
  bucket?: string
  protected?: boolean
}

interface DeliverablePreviewProps {
  files: DeliverableFile[]
  submissionId: string
  filesReleased: boolean
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️'
  if (type.includes('pdf')) return '📄'
  if (type.includes('zip') || type.includes('rar')) return '📦'
  if (type.includes('photoshop') || type.includes('psd')) return '🎨'
  if (type.includes('postscript') || type.includes('.ai')) return '✏️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  return '📎'
}

export default function DeliverablePreview({ files, submissionId, filesReleased, className }: DeliverablePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  const handlePreview = async (file: DeliverableFile, index: number) => {
    if (!file.path || !file.type.startsWith('image/')) return

    setPreviewLoading(file.name)
    try {
      const params = new URLSearchParams({
        submission_id: submissionId,
        path: file.path,
        name: file.name,
        type: file.type,
        size: String(file.size),
      })
      const res = await fetch(`/api/deliverables/preview/${index}?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.preview_url) {
          setPreviewUrl(data.preview_url)
        }
      }
    } catch {
      // Silently fail
    } finally {
      setPreviewLoading(null)
    }
  }

  const getDownloadUrl = (file: DeliverableFile, index: number) => {
    if (file.protected || file.bucket === 'deliverables-protected') {
      return `/api/deliverables/download/${index}?submission_id=${submissionId}&path=${encodeURIComponent(file.path || '')}`
    }
    return file.url || '#'
  }

  return (
    <div className={cn('space-y-2', className)}>
      {files.map((file, idx) => {
        const isProtected = file.protected || file.bucket === 'deliverables-protected'
        const isImage = file.type?.startsWith('image/')
        const canDownload = filesReleased || !isProtected

        return (
          <div
            key={idx}
            className={cn(
              'flex items-center gap-2.5 p-2.5 rounded-lg border transition-all',
              canDownload
                ? 'bg-background border-emerald-500/30 hover:border-emerald-500/50'
                : 'bg-muted/30 border-border/50'
            )}
          >
            <span className="text-base flex-shrink-0">{getFileIcon(file.type)}</span>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                {isProtected && !filesReleased && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-orange-500/10 text-orange-500 border-orange-500/30">
                    PREVIEW ONLY
                  </Badge>
                )}
                {canDownload && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    FULL ACCESS
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isImage && isProtected && !filesReleased && (
                <button
                  onClick={() => handlePreview(file, idx)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title="Preview"
                >
                  {previewLoading === file.name ? (
                    <div className="w-3.5 h-3.5 border border-brand-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5 text-brand-500" />
                  )}
                </button>
              )}
              {canDownload && (
                <a
                  href={getDownloadUrl(file, idx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-emerald-500/10 transition-colors"
                  title="Download"
                >
                  <HugeiconsIcon icon={Download01Icon} className="w-3.5 h-3.5 text-emerald-500" />
                </a>
              )}
              {!canDownload && !isImage && (
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
          </div>
        )
      })}

      {/* Image preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh] p-1" onClick={e => e.stopPropagation()}>
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="rounded-lg max-h-[80vh] object-contain"
                onContextMenu={e => e.preventDefault()}
                draggable={false}
              />
              {!filesReleased && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-white/20 text-4xl font-bold rotate-[-30deg] select-none">
                    PREVIEW — CREATUNO
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
