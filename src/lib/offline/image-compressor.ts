'use client'

import type { OfflineImage } from '@/types'
import { generateLocalId, saveImageOffline } from './indexed-db'

// Default compression settings optimized for low-bandwidth
const DEFAULT_MAX_WIDTH = 1200
const DEFAULT_MAX_HEIGHT = 1200
const DEFAULT_QUALITY = 0.75
const DEFAULT_MAX_SIZE_KB = 500
const THUMBNAIL_SIZE = 200

interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number
  format?: 'webp' | 'jpeg'
}

interface CompressionResult {
  originalFile: Blob
  compressedFile: Blob
  thumbnailFile: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

// Load image from file
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}

// Calculate dimensions maintaining aspect ratio
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let newWidth = width
  let newHeight = height

  if (width > maxWidth) {
    newWidth = maxWidth
    newHeight = (height * maxWidth) / width
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = (width * maxHeight) / height
  }

  return { width: Math.round(newWidth), height: Math.round(newHeight) }
}

// Convert canvas to blob
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'webp' | 'jpeg',
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      },
      format === 'webp' ? 'image/webp' : 'image/jpeg',
      quality
    )
  })
}

// Compress image with adaptive quality to meet size target
async function compressWithTargetSize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  maxSizeKB: number,
  format: 'webp' | 'jpeg'
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

  // Start with high quality and reduce until target size is met
  let quality = 0.9
  let blob = await canvasToBlob(canvas, format, quality)
  const maxSizeBytes = maxSizeKB * 1024

  while (blob.size > maxSizeBytes && quality > 0.1) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, format, quality)
  }

  return blob
}

// Create thumbnail
async function createThumbnail(
  img: HTMLImageElement,
  size: number,
  format: 'webp' | 'jpeg'
): Promise<Blob> {
  const { width, height } = calculateDimensions(img.width, img.height, size, size)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(img, 0, 0, width, height)

  return canvasToBlob(canvas, format, 0.6)
}

// Main compression function
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    maxSizeKB = DEFAULT_MAX_SIZE_KB,
    format = 'webp',
  } = options

  const img = await loadImage(file)
  const originalSize = file.size

  // Calculate target dimensions
  const { width, height } = calculateDimensions(img.width, img.height, maxWidth, maxHeight)

  // Compress main image
  const compressedFile = await compressWithTargetSize(img, width, height, maxSizeKB, format)

  // Create thumbnail
  const thumbnailFile = await createThumbnail(img, THUMBNAIL_SIZE, format)

  const compressionRatio = ((originalSize - compressedFile.size) / originalSize) * 100

  return {
    originalFile: file,
    compressedFile,
    thumbnailFile,
    width,
    height,
    originalSize,
    compressedSize: compressedFile.size,
    compressionRatio,
  }
}

// Process and save image for offline use
export async function processAndSaveImage(
  file: File,
  options?: CompressionOptions
): Promise<OfflineImage> {
  const result = await compressImage(file, options)
  
  const offlineImage: OfflineImage = {
    id: '', // Will be set after upload
    localId: generateLocalId(),
    originalFile: result.originalFile,
    compressedFile: result.compressedFile,
    thumbnailFile: result.thumbnailFile,
    mimeType: options?.format === 'jpeg' ? 'image/jpeg' : 'image/webp',
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    width: result.width,
    height: result.height,
    uploadStatus: 'pending',
    createdAt: Date.now(),
  }

  await saveImageOffline(offlineImage)

  return offlineImage
}

// Get local URL for offline image
export function getOfflineImageUrl(image: OfflineImage): string {
  if (image.remoteUrl) {
    return image.remoteUrl
  }
  return URL.createObjectURL(image.compressedFile)
}

// Get thumbnail URL for offline image
export function getOfflineThumbnailUrl(image: OfflineImage): string {
  return URL.createObjectURL(image.thumbnailFile)
}

// Check if browser supports WebP
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
}

// Get optimal format based on browser support
export function getOptimalFormat(): 'webp' | 'jpeg' {
  return supportsWebP() ? 'webp' : 'jpeg'
}

// Estimate compression for UI feedback
export function estimateCompressedSize(originalSizeKB: number): number {
  // Rough estimation: WebP typically achieves 25-35% of original size for photos
  return Math.round(originalSizeKB * 0.3)
}
