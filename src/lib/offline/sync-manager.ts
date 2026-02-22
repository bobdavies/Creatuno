'use client'

import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client'
import {
  getSyncQueueItems,
  updateSyncQueueItem,
  removeSyncQueueItem,
  getPendingPortfolios,
  getPendingProjects,
  getPendingImages,
  savePortfolioOffline,
  saveProjectOffline,
  saveImageOffline,
  clearCompletedSyncItems,
  getProjectsByPortfolio,
} from './indexed-db'
import type { OfflineProject } from '@/types'
import type { SyncQueueItem, SyncStatus, OfflineImage } from '@/types'

// Sync status listeners
type SyncStatusListener = (status: SyncStatus) => void
const syncStatusListeners: Set<SyncStatusListener> = new Set()

let currentSyncStatus: SyncStatus = {
  isSyncing: false,
  pendingCount: 0,
}

// Subscribe to sync status changes
export function subscribeSyncStatus(listener: SyncStatusListener): () => void {
  syncStatusListeners.add(listener)
  listener(currentSyncStatus)
  return () => syncStatusListeners.delete(listener)
}

// Update sync status
function updateSyncStatus(status: Partial<SyncStatus>): void {
  currentSyncStatus = { ...currentSyncStatus, ...status }
  syncStatusListeners.forEach(listener => listener(currentSyncStatus))
}

// Maximum retry attempts
const MAX_RETRIES = 3

// Sync a single queue item via the unified /api/sync endpoint
async function syncQueueItem(item: SyncQueueItem): Promise<boolean> {
  try {
    await updateSyncQueueItem({ ...item, status: 'syncing' })

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: item.action,
        table: item.table,
        data: item.data,
        id: (item.data as Record<string, unknown>).id,
        timestamp: item.timestamp,
      }),
      credentials: 'include',
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(result.error || `Sync failed: ${response.status}`)
    }

    await removeSyncQueueItem(item.id)
    return true
  } catch (error) {
    console.error(`Sync failed for item ${item.id}:`, error)

    const newRetryCount = item.retryCount + 1

    if (newRetryCount >= MAX_RETRIES) {
      await updateSyncQueueItem({ ...item, status: 'failed', retryCount: newRetryCount })
    } else {
      await updateSyncQueueItem({ ...item, status: 'pending', retryCount: newRetryCount })
    }

    return false
  }
}

// Upload an offline image to storage
async function uploadOfflineImage(image: OfflineImage): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Skip upload silently when Supabase isn't configured
    return false
  }

  const supabase = getSupabaseClient()

  try {
    // Update status to uploading
    await saveImageOffline({ ...image, uploadStatus: 'uploading' })

    // Upload to Supabase Storage
    const fileName = `${image.localId}.webp`
    const { error, data } = await supabase.storage
      .from('portfolio-images')
      .upload(fileName, image.compressedFile, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) throw error

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('portfolio-images')
      .getPublicUrl(fileName)

    // Update image with remote URL
    await saveImageOffline({
      ...image,
      uploadStatus: 'uploaded',
      remoteUrl: urlData.publicUrl,
    })

    return true

  } catch (error) {
    console.error(`Image upload failed for ${image.localId}:`, error)
    await saveImageOffline({ ...image, uploadStatus: 'failed' })
    return false
  }
}

// Sync all pending portfolios
async function syncPendingPortfolios(): Promise<void> {
  if (!isSupabaseConfigured()) {
    // Skip sync silently when Supabase isn't configured
    return
  }

  const pendingPortfolios = await getPendingPortfolios()
  console.log(`[Sync] Found ${pendingPortfolios.length} pending portfolios to sync`)

  for (const portfolio of pendingPortfolios) {
    try {
      await savePortfolioOffline({ ...portfolio, syncStatus: 'syncing' })
      
      // Extract and flatten portfolio data for Supabase
      const data = portfolio.data as Record<string, unknown>
      const supabasePortfolio = {
        // Use existing server ID if available and valid, otherwise let Supabase generate one
        ...(portfolio.id && !portfolio.id.startsWith('local_') ? { id: portfolio.id } : {}),
        title: data.title as string,
        description: (data.description as string) || null,
        tagline: (data.tagline as string) || null,
        slug: data.slug as string,
        is_public: (data.is_public as boolean) ?? true,
        // user_id will be set by RLS/auth context
      }

      console.log(`[Sync] Syncing portfolio: ${portfolio.localId}`)

      // Sync to Supabase via API route (to get user context)
      const response = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...supabasePortfolio,
          localId: portfolio.localId,
        }),
        credentials: 'include', // Ensure cookies are sent for auth
      })

      const result = await response.json()
      
      if (!response.ok) {
        console.error(`[Sync] Portfolio sync API error:`, { status: response.status, error: result.error })
        throw new Error(result.error || 'Sync failed')
      }

      const serverId = result.portfolio?.id
      console.log(`[Sync] Portfolio synced successfully: ${portfolio.localId} -> ${serverId}`)
      
      // Update local portfolio with server ID
      await savePortfolioOffline({ 
        ...portfolio, 
        id: serverId || portfolio.id,
        syncStatus: 'synced' 
      })

      // Update all related projects with the new portfolio_id (server UUID)
      // Check for projects that have the localId OR the old portfolio.id (if it was different)
      if (serverId) {
        // Get projects that reference this portfolio by its localId
        const projectsByLocalId = await getProjectsByPortfolio(portfolio.localId)
        console.log(`[Sync] Found ${projectsByLocalId.length} projects by localId: ${portfolio.localId}`)
        
        for (const project of projectsByLocalId) {
          console.log(`[Sync] Updating project ${project.localId} portfolioId: ${project.portfolioId} -> ${serverId}`)
          await saveProjectOffline({
            ...project,
            portfolioId: serverId, // Update to server UUID
            syncStatus: 'pending', // Mark as pending to sync
          })
        }
      }
    } catch (error) {
      console.error(`[Sync] Portfolio sync failed for ${portfolio.localId}:`, error)
      await savePortfolioOffline({ ...portfolio, syncStatus: 'conflict' })
    }
  }
}

// Sync all pending images
async function syncPendingImages(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return
  }

  const pendingImages = await getPendingImages()

  for (const image of pendingImages) {
    await uploadOfflineImage(image)
  }
}

// Sync all pending projects
async function syncPendingProjects(): Promise<void> {
  if (!isSupabaseConfigured()) {
    return
  }

  const pendingProjects = await getPendingProjects()
  console.log(`[Sync] Found ${pendingProjects.length} pending projects to sync`)

  for (const project of pendingProjects) {
    try {
      await saveProjectOffline({ ...project, syncStatus: 'syncing' })

      const data = project.data as Record<string, unknown>
      
      // Get image URLs from the project images
      const imageUrls = (project.images ?? [])
        .filter(img => img.remoteUrl)
        .map(img => img.remoteUrl as string)

      // Handle project_date format - convert "2026-02" to "2026-02-01" for database
      let projectDate: string | null = null
      const rawDate = data.project_date as string
      if (rawDate) {
        // If it's just year-month (e.g., "2026-02"), append "-01" to make it a valid date
        if (/^\d{4}-\d{2}$/.test(rawDate)) {
          projectDate = `${rawDate}-01`
        } else {
          projectDate = rawDate
        }
      }

      const supabaseProject = {
        ...(project.id && !project.id.startsWith('local_') ? { id: project.id } : {}),
        portfolio_id: project.portfolioId,
        title: data.title as string || 'Untitled Project',
        description: (data.description as string) || null,
        client_name: (data.client_name as string) || null,
        project_date: projectDate,
        external_link: (data.external_link as string) || null,
        video_url: (data.video_url as string) || null,
        tags: (data.tags as string[]) || [],
        images: imageUrls,
        display_order: (data.display_order as number) || 0,
      }

      // Only sync if portfolio_id is a valid UUID (not a local ID or empty)
      if (!supabaseProject.portfolio_id || supabaseProject.portfolio_id.length === 0 || supabaseProject.portfolio_id.startsWith('local_')) {
        console.log(`[Sync] Skipping project ${project.localId} - portfolio_id is local: ${supabaseProject.portfolio_id}`)
        await saveProjectOffline({ ...project, syncStatus: 'pending' })
        continue
      }

      console.log(`[Sync] Syncing project: ${project.localId} with portfolio_id: ${supabaseProject.portfolio_id}`)

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supabaseProject),
        credentials: 'include', // Ensure cookies are sent for auth
      })

      const result = await response.json()
      
      if (!response.ok) {
        console.error(`[Sync] Project sync API error:`, { 
          status: response.status, 
          error: result.error,
          portfolio_id: supabaseProject.portfolio_id,
          project_localId: project.localId 
        })
        throw new Error(result.error || `Project sync failed with status ${response.status}`)
      }

      console.log(`[Sync] Project synced successfully: ${project.localId} -> ${result.project?.id}`)

      await saveProjectOffline({
        ...project,
        id: result.project?.id || project.id,
        syncStatus: 'synced',
      })
    } catch (error) {
      console.error(`[Sync] Project sync failed for ${project.localId}:`, error)
      await saveProjectOffline({ ...project, syncStatus: 'conflict' })
    }
  }
}

// Main sync function
export async function performSync(): Promise<void> {
  // Skip sync if Supabase isn't configured
  if (!isSupabaseConfigured()) {
    // Just update pending count without trying to sync
    try {
      const pendingPortfolios = await getPendingPortfolios()
      const pendingProjects = await getPendingProjects()
      const pendingImages = await getPendingImages()
      const queueItems = await getSyncQueueItems()
      const totalPending = queueItems.length + pendingPortfolios.length + pendingProjects.length + pendingImages.length
      
      updateSyncStatus({ 
        isSyncing: false, 
        pendingCount: totalPending,
        lastError: totalPending > 0 ? 'Supabase not configured - data saved locally' : undefined
      })
    } catch {
      // Ignore errors when checking pending count
    }
    return
  }

  if (currentSyncStatus.isSyncing) {
    console.log('Sync already in progress')
    return
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('Offline - skipping sync')
    return
  }

  if (shouldSkipSyncForConnection()) {
    console.log('Slow connection and syncOnWifiOnly enabled - skipping sync')
    return
  }

  try {
    updateSyncStatus({ isSyncing: true })

    // Get pending sync count
    const queueItems = await getSyncQueueItems()
    const pendingPortfolios = await getPendingPortfolios()
    const pendingProjects = await getPendingProjects()
    const pendingImages = await getPendingImages()
    
    const totalPending = queueItems.length + pendingPortfolios.length + pendingProjects.length + pendingImages.length
    updateSyncStatus({ pendingCount: totalPending })

    // Sync images first (they're needed for projects)
    await syncPendingImages()

    // Sync portfolios (must be before projects)
    await syncPendingPortfolios()

    // Sync projects (after portfolios so portfolio_id is available)
    await syncPendingProjects()

    // Sync queue items
    for (const item of queueItems) {
      await syncQueueItem(item)
      updateSyncStatus({ pendingCount: currentSyncStatus.pendingCount - 1 })
    }

    // Clear completed items
    await clearCompletedSyncItems()

    updateSyncStatus({ 
      isSyncing: false, 
      pendingCount: 0,
      lastSyncTime: Date.now(),
      lastError: undefined,
    })

  } catch (error) {
    console.error('Sync failed:', error)
    updateSyncStatus({ 
      isSyncing: false,
      lastError: error instanceof Error ? error.message : 'Sync failed',
    })
  }
}

// Register for background sync (if supported)
export async function registerBackgroundSync(tag: string = 'creatuno-sync'): Promise<void> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      if ('sync' in registration) {
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag)
      }
    } catch (error) {
      console.error('Background sync registration failed:', error)
    }
  }
}

// Check if user prefers wifi-only sync
function shouldSkipSyncForConnection(): boolean {
  if (typeof navigator === 'undefined') return false
  try {
    const stored = localStorage.getItem('creatuno_settings')
    if (!stored) return false
    const settings = JSON.parse(stored)
    if (!settings.syncOnWifiOnly) return false
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } }
    const etype = nav.connection?.effectiveType
    return etype === 'slow-2g' || etype === '2g'
  } catch {
    return false
  }
}

// Sync a single portfolio immediately (for use after creation)
export async function syncPortfolioImmediately(localId: string): Promise<{ success: boolean; serverId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Offline' }
  }

  const db = await (await import('./indexed-db')).getDB()
  const portfolio = await db.get('portfolios', localId)

  if (!portfolio) {
    return { success: false, error: 'Portfolio not found' }
  }

  try {
    await savePortfolioOffline({ ...portfolio, syncStatus: 'syncing' })

    const data = portfolio.data as Record<string, unknown>
    const supabasePortfolio = {
      ...(portfolio.id ? { id: portfolio.id } : {}),
      title: data.title as string,
      description: data.description as string | null,
      tagline: data.tagline as string | null,
      slug: data.slug as string,
      is_public: data.is_public as boolean ?? true,
    }

    const response = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...supabasePortfolio,
        localId: portfolio.localId,
      }),
      credentials: 'include',
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Sync failed')
    }

    const serverId = result.portfolio?.id

    await savePortfolioOffline({
      ...portfolio,
      id: serverId || portfolio.id,
      syncStatus: 'synced',
    })

    // Update related projects with the new portfolio_id
    if (serverId) {
      const relatedProjects = await getProjectsByPortfolio(localId)
      for (const project of relatedProjects) {
        await saveProjectOffline({
          ...project,
          portfolioId: serverId,
          syncStatus: 'pending',
        })
      }
    }

    return { success: true, serverId }
  } catch (error) {
    console.error(`Portfolio sync failed for ${localId}:`, error)
    await savePortfolioOffline({ ...portfolio, syncStatus: 'conflict' })
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' }
  }
}

// Sync a single project immediately (for use after creation)
export async function syncProjectImmediately(localId: string): Promise<{ success: boolean; serverId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Offline' }
  }

  const db = await (await import('./indexed-db')).getDB()
  const project = await db.get('projects', localId) as OfflineProject | undefined

  if (!project) {
    return { success: false, error: 'Project not found' }
  }

  // Check if portfolio_id is a valid UUID (not a local ID or empty)
  if (!project.portfolioId || project.portfolioId.length === 0 || project.portfolioId.startsWith('local_')) {
    return { success: false, error: 'Portfolio not yet synced' }
  }

  try {
    await saveProjectOffline({ ...project, syncStatus: 'syncing' })

    const data = project.data as Record<string, unknown>
    const imageUrls = (project.images ?? [])
      .filter(img => img.remoteUrl)
      .map(img => img.remoteUrl as string)

    const supabaseProject = {
      ...(project.id ? { id: project.id } : {}),
      portfolio_id: project.portfolioId,
      title: data.title as string,
      description: data.description as string | null,
      client_name: data.client_name as string | null,
      project_date: data.project_date as string | null,
      external_link: data.external_link as string | null,
      tags: data.tags as string[] || [],
      images: imageUrls,
      display_order: data.display_order as number || 0,
    }

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supabaseProject),
      credentials: 'include',
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Project sync failed')
    }

    const serverId = result.project?.id

    await saveProjectOffline({
      ...project,
      id: serverId || project.id,
      syncStatus: 'synced',
    })

    return { success: true, serverId }
  } catch (error) {
    console.error(`Project sync failed for ${localId}:`, error)
    await saveProjectOffline({ ...project, syncStatus: 'conflict' })
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' }
  }
}

// Check if there are pending items to sync
export async function hasPendingSync(): Promise<boolean> {
  try {
    const queueItems = await getSyncQueueItems()
    const pendingPortfolios = await getPendingPortfolios()
    const pendingProjects = await getPendingProjects()
    const pendingImages = await getPendingImages()
    
    return queueItems.length > 0 || pendingPortfolios.length > 0 || pendingProjects.length > 0 || pendingImages.length > 0
  } catch {
    return false
  }
}

// Get current sync status
export function getSyncStatus(): SyncStatus {
  return currentSyncStatus
}

// Initialize sync manager - call this on app start
export function initSyncManager(): void {
  if (typeof window === 'undefined') return

  // Sync when coming online
  window.addEventListener('online', () => {
    console.log('Back online - triggering sync')
    performSync()
  })

  // Listen for visibility change - sync when app becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      performSync()
    }
  })

  // Initial sync if online (delayed to allow app to load)
  setTimeout(() => {
    if (navigator.onLine) {
      performSync()
    }
  }, 2000)
}
