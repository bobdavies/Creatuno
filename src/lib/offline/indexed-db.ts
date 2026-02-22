import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { 
  SyncQueueItem, 
  OfflineImage, 
  OfflinePortfolio, 
  OfflineProject,
  UserPreferences 
} from '@/types'

// Database schema definition
interface CreatunoDB extends DBSchema {
  portfolios: {
    key: string
    value: OfflinePortfolio
    indexes: { 'by-sync-status': string; 'by-last-modified': number; 'by-user-id': string }
  }
  projects: {
    key: string
    value: OfflineProject
    indexes: { 'by-portfolio': string; 'by-sync-status': string }
  }
  images: {
    key: string
    value: OfflineImage
    indexes: { 'by-upload-status': string }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: { 'by-status': string; 'by-timestamp': number }
  }
  userPreferences: {
    key: string
    value: UserPreferences
  }
  cachedData: {
    key: string
    value: {
      id: string
      table: string
      data: Record<string, unknown>
      cachedAt: number
      expiresAt: number
    }
    indexes: { 'by-table': string; 'by-expires': number }
  }
}

const DB_NAME = 'creatuno-offline'
const DB_VERSION = 2 // Incremented for userId index

let dbInstance: IDBPDatabase<CreatunoDB> | null = null

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<CreatunoDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<CreatunoDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Portfolios store
      if (!db.objectStoreNames.contains('portfolios')) {
        const portfolioStore = db.createObjectStore('portfolios', { keyPath: 'localId' })
        portfolioStore.createIndex('by-sync-status', 'syncStatus')
        portfolioStore.createIndex('by-last-modified', 'lastModified')
        portfolioStore.createIndex('by-user-id', 'userId')
      } else if (oldVersion < 2) {
        // Migrate existing store to add userId index
        const portfolioStore = transaction.objectStore('portfolios')
        if (!portfolioStore.indexNames.contains('by-user-id')) {
          portfolioStore.createIndex('by-user-id', 'userId')
        }
      }

      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'localId' })
        projectStore.createIndex('by-portfolio', 'portfolioId')
        projectStore.createIndex('by-sync-status', 'syncStatus')
      }

      // Images store
      if (!db.objectStoreNames.contains('images')) {
        const imageStore = db.createObjectStore('images', { keyPath: 'localId' })
        imageStore.createIndex('by-upload-status', 'uploadStatus')
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
        syncStore.createIndex('by-status', 'status')
        syncStore.createIndex('by-timestamp', 'timestamp')
      }

      // User preferences store
      if (!db.objectStoreNames.contains('userPreferences')) {
        db.createObjectStore('userPreferences', { keyPath: 'userId' })
      }

      // Cached data store
      if (!db.objectStoreNames.contains('cachedData')) {
        const cacheStore = db.createObjectStore('cachedData', { keyPath: 'id' })
        cacheStore.createIndex('by-table', 'table')
        cacheStore.createIndex('by-expires', 'expiresAt')
      }
    },
  })

  return dbInstance
}

// Get database instance
export async function getDB(): Promise<IDBPDatabase<CreatunoDB>> {
  if (!dbInstance) {
    return initDB()
  }
  return dbInstance
}

// ==========================================
// Portfolio Operations
// ==========================================

export async function savePortfolioOffline(portfolio: OfflinePortfolio): Promise<void> {
  const db = await getDB()
  await db.put('portfolios', portfolio)
}

export async function getPortfolioOffline(localId: string): Promise<OfflinePortfolio | undefined> {
  const db = await getDB()
  return db.get('portfolios', localId)
}

export async function getAllPortfoliosOffline(): Promise<OfflinePortfolio[]> {
  const db = await getDB()
  return db.getAll('portfolios')
}

/**
 * Get all portfolios for a specific user
 * This ensures data isolation between users
 */
export async function getPortfoliosByUser(userId: string): Promise<OfflinePortfolio[]> {
  const db = await getDB()
  return db.getAllFromIndex('portfolios', 'by-user-id', userId)
}

export async function getPendingPortfolios(): Promise<OfflinePortfolio[]> {
  const db = await getDB()
  return db.getAllFromIndex('portfolios', 'by-sync-status', 'pending')
}

export async function deletePortfolioOffline(localId: string): Promise<void> {
  const db = await getDB()
  await db.delete('portfolios', localId)
}

// ==========================================
// Project Operations
// ==========================================

export async function saveProjectOffline(project: OfflineProject): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function getProjectOffline(localId: string): Promise<OfflineProject | undefined> {
  const db = await getDB()
  return db.get('projects', localId)
}

export async function getProjectsByPortfolio(portfolioId: string): Promise<OfflineProject[]> {
  const db = await getDB()
  return db.getAllFromIndex('projects', 'by-portfolio', portfolioId)
}

export async function deleteProjectOffline(localId: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', localId)
}

export async function getPendingProjects(): Promise<OfflineProject[]> {
  const db = await getDB()
  return db.getAllFromIndex('projects', 'by-sync-status', 'pending')
}

export async function getAllProjects(): Promise<OfflineProject[]> {
  const db = await getDB()
  return db.getAll('projects')
}

// ==========================================
// Image Operations
// ==========================================

export async function saveImageOffline(image: OfflineImage): Promise<void> {
  const db = await getDB()
  await db.put('images', image)
}

export async function getImageOffline(localId: string): Promise<OfflineImage | undefined> {
  const db = await getDB()
  return db.get('images', localId)
}

export async function getPendingImages(): Promise<OfflineImage[]> {
  const db = await getDB()
  return db.getAllFromIndex('images', 'by-upload-status', 'pending')
}

export async function deleteImageOffline(localId: string): Promise<void> {
  const db = await getDB()
  await db.delete('images', localId)
}

// ==========================================
// Sync Queue Operations
// ==========================================

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB()
  await db.put('syncQueue', item)
}

export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  const db = await getDB()
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending')
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB()
  await db.put('syncQueue', item)
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('syncQueue', id)
}

export async function clearCompletedSyncItems(): Promise<void> {
  const db = await getDB()
  const completed = await db.getAllFromIndex('syncQueue', 'by-status', 'completed')
  const tx = db.transaction('syncQueue', 'readwrite')
  await Promise.all(completed.map(item => tx.store.delete(item.id)))
  await tx.done
}

// ==========================================
// User Preferences Operations
// ==========================================

export async function saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
  const db = await getDB()
  await db.put('userPreferences', { ...preferences, userId } as UserPreferences & { userId: string })
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
  const db = await getDB()
  const result = await db.get('userPreferences', userId)
  return result
}

// ==========================================
// Cache Operations
// ==========================================

export async function cacheData(
  table: string,
  id: string,
  data: Record<string, unknown>,
  ttlMs: number = 1000 * 60 * 60 // 1 hour default
): Promise<void> {
  const db = await getDB()
  await db.put('cachedData', {
    id: `${table}:${id}`,
    table,
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  })
}

export async function getCachedData(table: string, id: string): Promise<Record<string, unknown> | undefined> {
  const db = await getDB()
  const cached = await db.get('cachedData', `${table}:${id}`)
  
  if (!cached) return undefined
  
  // Check if expired
  if (cached.expiresAt < Date.now()) {
    await db.delete('cachedData', `${table}:${id}`)
    return undefined
  }
  
  return cached.data
}

export async function clearExpiredCache(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('cachedData', 'readwrite')
  const store = tx.store
  const index = store.index('by-expires')
  
  let cursor = await index.openCursor(IDBKeyRange.upperBound(Date.now()))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  
  await tx.done
}

// ==========================================
// Offline Mutation Helpers
// ==========================================

export async function queueOfflineMutation(
  table: string,
  action: 'create' | 'update' | 'delete',
  data: Record<string, unknown>
): Promise<string> {
  const id = generateLocalId()
  await addToSyncQueue({
    id,
    table,
    action,
    data,
    timestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
  })
  return id
}

export async function queueOfflinePost(postData: Record<string, unknown>): Promise<string> {
  return queueOfflineMutation('posts', 'create', postData)
}

export async function queueOfflineMessage(messageData: Record<string, unknown>): Promise<string> {
  return queueOfflineMutation('messages', 'create', messageData)
}

export async function queueOfflineApplication(applicationData: Record<string, unknown>): Promise<string> {
  return queueOfflineMutation('applications', 'create', applicationData)
}

export async function queueOfflineMentorshipRequest(requestData: Record<string, unknown>): Promise<string> {
  return queueOfflineMutation('mentorship_requests', 'create', requestData)
}

// ==========================================
// Utility Functions
// ==========================================

export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB()
  await db.clear('portfolios')
  await db.clear('projects')
  await db.clear('images')
  await db.clear('syncQueue')
  await db.clear('cachedData')
}

export async function getOfflineStats(): Promise<{
  portfolioCount: number
  projectCount: number
  imageCount: number
  pendingSyncCount: number
}> {
  const db = await getDB()
  return {
    portfolioCount: await db.count('portfolios'),
    projectCount: await db.count('projects'),
    imageCount: await db.count('images'),
    pendingSyncCount: (await db.getAllFromIndex('syncQueue', 'by-status', 'pending')).length,
  }
}

// Generate unique local ID
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ==========================================
// Convenience wrapper object
// ==========================================

export const offlineDB = {
  // Database
  init: initDB,
  get: getDB,

  // Portfolios
  savePortfolio: savePortfolioOffline,
  getPortfolio: getPortfolioOffline,
  getAllPortfolios: getAllPortfoliosOffline,
  getPortfoliosByUser,
  getPendingPortfolios,
  deletePortfolio: deletePortfolioOffline,

  // Projects
  saveProject: saveProjectOffline,
  getProject: getProjectOffline,
  getProjectsByPortfolio,
  deleteProject: deleteProjectOffline,

  // Images
  saveImage: saveImageOffline,
  getImage: getImageOffline,
  getPendingImages,
  deleteImage: deleteImageOffline,

  // Sync Queue
  addToSyncQueue,
  getSyncQueueItems,
  updateSyncQueueItem,
  removeSyncQueueItem,
  clearCompletedSyncItems,

  // Offline Mutations
  queueOfflineMutation,
  queueOfflinePost,
  queueOfflineMessage,
  queueOfflineApplication,
  queueOfflineMentorshipRequest,

  // User Preferences
  saveUserPreferences,
  getUserPreferences,

  // Cache
  cacheData,
  getCachedData,
  clearExpiredCache,

  // Utilities
  clearAllOfflineData,
  getOfflineStats,
  generateLocalId,
}
