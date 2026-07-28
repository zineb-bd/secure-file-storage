import { api } from '@/api/client'
import type { FavoriteToggleResult } from '@/types'

export async function addFavorite(documentId: string): Promise<FavoriteToggleResult> {
  return api<FavoriteToggleResult>(`/api/documents/${documentId}/favorite`, { method: 'POST' })
}

export async function removeFavorite(documentId: string): Promise<FavoriteToggleResult> {
  return api<FavoriteToggleResult>(`/api/documents/${documentId}/favorite`, { method: 'DELETE' })
}

export async function toggleFavoriteApi(
  documentId: string,
  currentlyFavorite: boolean
): Promise<FavoriteToggleResult> {
  return currentlyFavorite ? removeFavorite(documentId) : addFavorite(documentId)
}
