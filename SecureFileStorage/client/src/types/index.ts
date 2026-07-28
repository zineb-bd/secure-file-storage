export interface UserInfo {
  email: string
  fullName: string
  roles: string[]
  expiresAt: string
}

export interface LoginResponse {
  token: string
  email: string
  fullName: string
  roles: string[]
  expiresAt: string
}

export interface ProfileUser {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  roles: string[]
  createdAt: string
}

export interface DocumentDto {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  category: string
  description: string
  sha256Hash: string
  currentVersion: number
  status: string
  ownerId: string
  ownerName: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
  lastScanResult: string
  wasDeduplicated?: boolean
  isLocked: boolean
  lockedById?: string | null
  lockedByName?: string | null
  lockedAt?: string | null
  lockExpiresAt?: string | null
  isLockedByCurrentUser: boolean
  canModify: boolean
  visibility: string
  publicAccessLevel: string
  myAccessLevel?: string | null
  isOwner: boolean
  isFavorite?: boolean
}

export interface FavoriteToggleResult {
  documentId: string
  isFavorite: boolean
}

export interface DocumentCollaborator {
  userId?: string | null
  userName: string
  userEmail: string
  role: string
  accessLevel: string
  permissionId?: string | null
  grantedAt?: string | null
  expiresAt?: string | null
  isExpired: boolean
}

export interface DocumentCollaborators {
  owner: DocumentCollaborator
  collaborators: DocumentCollaborator[]
  canManage: boolean
}

export interface DocumentImportSource {
  id: string
  displayName: string
  isEnabled: boolean
  unavailableReason?: string | null
}

export interface MaturityMetric {
  key: string
  value: number
  total: number
  percent: number
}

export interface MaturityPillar {
  id: string
  label: string
  score: number
  level: string
  metrics: MaturityMetric[]
}

export interface MaturityRecommendation {
  id: string
  severity: string
  message: string
  actionLabel?: string | null
  actionHref?: string | null
  percent?: number | null
}

export interface DocumentMaturityScore {
  overallScore: number
  overallLevel: string
  organization: MaturityPillar
  security: MaturityPillar
  collaboration: MaturityPillar
  recommendations: MaturityRecommendation[]
  totalDocuments: number
  generatedAt: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface DashboardStats {
  totalDocuments: number
  storageUsedBytes: number
  logicalStorageBytes: number
  bytesSavedByDedup: number
  recentDocuments: DocumentDto[]
  recentActivity: RecentActivity[]
  notifications: NotificationItem[]
}

export interface RecentActivity {
  action: string
  documentName: string
  documentId?: string | null
  timestamp: string
}

export interface NotificationItem {
  type: string
  message: string
  date: string
}

export interface UserDirectoryEntry {
  id: string
  email: string
  fullName: string
}

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  roles: string[]
  createdAt: string
}

export interface RoleDto {
  id: string
  name: string
  description: string
}

export interface AuditLog {
  id: string
  userId?: string | null
  userEmail?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  details: string
  ipAddress: string
  success: boolean
  timestamp: string
}

export interface StorageConfig {
  id: string
  providerType: string
  databaseProvider: string
  basePath: string
  s3Endpoint?: string | null
  s3Bucket?: string | null
  isActive: boolean
  updatedAt: string
}

export interface DocumentDetail extends DocumentDto {
  extension: string
  storagePath?: string | null
}

export interface DocumentVersion {
  id: string
  versionNumber: number
  sizeBytes: number
  sha256Hash: string
  uploadedById: string
  uploadedByName: string
  createdAt: string
  changeComment?: string | null
}

export interface DocumentShares {
  userShares: UserShare[]
  links: ShareLink[]
}

export interface UserShare {
  id: string
  userId: string
  userEmail: string
  userName: string
  accessLevel: string
  grantedAt: string
  expiresAt?: string | null
  isExpired: boolean
}

export interface ShareLink {
  id: string
  accessLevel: string
  createdAt: string
  expiresAt: string
  isRevoked: boolean
  isExpired: boolean
}

export interface SharedDocumentInfo {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  accessLevel: string
  expiresAt: string
  ownerName: string
}

export interface CreateShareLinkResponse {
  id: string
  token: string
  shareUrl: string
  accessLevel: string
  expiresAt: string
}

export interface AntivirusAlert {
  id: string
  documentId?: string | null
  fileName: string
  threatName: string
  details: string
  detectedAt: string
  isResolved: boolean
}

export interface DocFilters {
  fileName?: string
  category?: string
  contentType?: string
  status?: string
  createdFrom?: string
  createdTo?: string
  page?: number
  pageSize?: number
}

export interface DocActionOpts {
  isLocked?: boolean
  isLockedByCurrentUser?: boolean
  canModify?: boolean
  showRestore?: boolean
  showPermDelete?: boolean
  noPreview?: boolean
  noDownload?: boolean
  noShare?: boolean
  noArchive?: boolean
  noTrash?: boolean
  isFavorite?: boolean
  showFavorite?: boolean
}
