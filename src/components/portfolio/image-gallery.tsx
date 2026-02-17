'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, PlayIcon, ZoomInAreaIcon } from "@hugeicons/core-free-icons";
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import TiltedCard from '@/components/TiltedCard'
import { cn } from '@/lib/utils'

interface ImageGalleryProps {
  images: string[]
  projectTitle: string
  videoUrl?: string
}

export function ImageGallery({ images, projectTitle, videoUrl }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }, [images.length])

  // Handle keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [lightboxOpen, goToNext, goToPrevious])

  // Get video embed URL
  const getVideoEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    return url
  }

  if (images.length === 0 && !videoUrl) {
    return (
      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-500/20 to-brand-600/10">
          <span className="text-4xl sm:text-6xl font-bold text-brand-purple-400/30 dark:text-brand-400/30">
            {projectTitle.charAt(0)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Video Player */}
        {videoUrl && (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              src={getVideoEmbedUrl(videoUrl)}
              title={`${projectTitle} video`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Image Grid */}
        {images.length > 0 && (
          <div className={cn(
            "grid gap-4",
            images.length === 1 && "grid-cols-1",
            images.length === 2 && "grid-cols-2",
            images.length >= 3 && "grid-cols-2 md:grid-cols-3"
          )}>
            {images.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "relative group cursor-pointer bg-muted rounded-lg overflow-hidden",
                  images.length === 1 && "aspect-video",
                  images.length >= 2 && "aspect-square"
                )}
                onClick={() => openLightbox(index)}
              >
                <div className="w-full h-full [&_.tilted-card-img]:rounded-lg">
                  <TiltedCard
                    imageSrc={image}
                    altText={`${projectTitle} - Image ${index + 1}`}
                    containerHeight="100%"
                    containerWidth="100%"
                    imageHeight="100%"
                    imageWidth="100%"
                    scaleOnHover={1.05}
                    rotateAmplitude={10}
                    showMobileWarning={false}
                    showTooltip={false}
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
                  <HugeiconsIcon icon={ZoomInAreaIcon} className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={closeLightbox}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="w-6 h-6" />
          </Button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white text-sm z-10">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Previous Button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 text-white hover:bg-white/20 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="w-8 h-8" />
            </Button>
          )}

          {/* Current Image */}
          <div 
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[currentIndex]}
              alt={`${projectTitle} - Image ${currentIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 text-white hover:bg-white/20 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="w-8 h-8" />
            </Button>
          )}

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((image, index) => (
                <button
                  key={index}
                  className={cn(
                    "w-16 h-16 rounded overflow-hidden border-2 transition-colors",
                    index === currentIndex ? "border-brand-500" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
