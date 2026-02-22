'use client'

import Image, { type ImageProps } from 'next/image'
import { useNetwork } from '@/components/providers/network-aware-provider'

interface AdaptiveImageProps extends Omit<ImageProps, 'quality'> {
  lowSrc?: string
}

/**
 * Image component that adapts quality and loading behavior
 * based on the user's network conditions.
 */
export function AdaptiveImage({ lowSrc, src, ...props }: AdaptiveImageProps) {
  const { imageQuality, shouldReduceData } = useNetwork()

  const qualityMap = { low: 30, medium: 55, high: 80 } as const
  const quality = qualityMap[imageQuality]

  const resolvedSrc = shouldReduceData && lowSrc ? lowSrc : src

  return (
    <Image
      src={resolvedSrc}
      quality={quality}
      loading="lazy"
      {...props}
    />
  )
}

interface AdaptiveImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  lowSrc?: string
}

/**
 * Raw <img> wrapper that always lazy-loads and can switch to
 * a lower-quality source on slow connections.
 */
export function AdaptiveImg({ lowSrc, src, ...props }: AdaptiveImgProps) {
  const { shouldReduceData } = useNetwork()

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={shouldReduceData && lowSrc ? lowSrc : src}
      loading="lazy"
      decoding="async"
      {...props}
    />
  )
}
