// Re-export all database types
export * from './database'

// App-specific types

export interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  table: string
  data: Record<string, unknown>
  timestamp: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed' | 'completed'
}

export interface OfflineImage {
  id: string
  localId: string
  originalFile: Blob
  compressedFile: Blob
  thumbnailFile: Blob
  mimeType: string
  originalSize: number
  compressedSize: number
  width: number
  height: number
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed'
  remoteUrl?: string
  createdAt: number
}

export interface OfflinePortfolio {
  id: string
  localId: string
  userId: string // User ID for data isolation
  data: Record<string, unknown>
  projects: OfflineProject[]
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict'
  lastModified: number
  serverVersion?: number
}

export interface OfflineProject {
  id: string
  localId: string
  portfolioId: string
  data: Record<string, unknown>
  images: OfflineImage[]
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict'
  lastModified: number
}

export interface NetworkStatus {
  isOnline: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
  downlink?: number
  rtt?: number
}

export interface SyncStatus {
  isSyncing: boolean
  pendingCount: number
  lastSyncTime?: number
  lastError?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  syncOnWifiOnly: boolean
  notificationsEnabled: boolean
  emailNotifications: boolean
  autoCompressImages: boolean
  maxImageSize: number // in KB
}

// Feed types
export interface FeedPost extends Post {
  author: Profile
  hasLiked: boolean
}

// Mentorship types
export interface MentorProfile extends Profile {
  menteeCount: number
  successStories: number
  rating: number
}

// Opportunity types
export interface OpportunityWithAuthor extends Opportunity {
  author: Profile
}

export interface ApplicationWithDetails extends Application {
  applicant: Profile
  portfolio?: Portfolio
}

// Bookmark types
export interface BookmarkWithPortfolio extends Bookmark {
  portfolio: Portfolio & {
    profiles: Profile
  }
}

// Message types
export interface MessageWithUser extends Message {
  sender?: Profile
  receiver?: Profile
}

// Mentorship feedback types
export interface MentorFeedbackWithReviewer extends MentorshipFeedback {
  reviewer: Profile
}

// Work submission types
export interface WorkSubmissionFile {
  url: string
  name: string
  size: number
  type: string
}

export interface WorkSubmissionWithDetails extends WorkSubmission {
  creative?: Profile
  employer?: Profile
}
