'use client'

import TiltedCard from '@/components/TiltedCard'

interface PortfolioThumbnailProps {
  imageSrc: string | null
  altText: string
  className?: string
}

/**
 * Client-only thumbnail for portfolio cards. Uses TiltedCard when image is present.
 * Used on server-rendered pages (e.g. portfolio/user/[userId]).
 */
export function PortfolioThumbnail({ imageSrc, altText, className = '' }: PortfolioThumbnailProps) {
  if (!imageSrc) {
    return <div className={className} />
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <TiltedCard
        imageSrc={imageSrc}
        altText={altText}
        captionText={altText}
        containerHeight="100%"
        containerWidth="100%"
        imageHeight="100%"
        imageWidth="100%"
        scaleOnHover={1.05}
        rotateAmplitude={10}
        showMobileWarning={false}
        showTooltip={true}
      />
    </div>
  )
}
