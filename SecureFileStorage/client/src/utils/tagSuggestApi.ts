import { api } from '@/api/client'
import { extractTagsLocally } from '@/utils/uploadHelpers'

export type TagSuggestSource = 'local' | 'ai' | 'hybrid'

export interface SuggestTagsResponse {
  tags: string[]
  source: TagSuggestSource
}

export async function suggestDocumentTags(input: {
  fileName: string
  title?: string
  contentType?: string
  category?: string
  description?: string
  excerpt?: string
  locale?: string
}): Promise<SuggestTagsResponse> {
  try {
    const data = await api<SuggestTagsResponse>('/api/documents/suggest-tags', {
      method: 'POST',
      body: JSON.stringify({
        fileName: input.fileName,
        title: input.title || undefined,
        contentType: input.contentType || undefined,
        category: input.category || undefined,
        description: input.description || undefined,
        excerpt: input.excerpt || undefined,
        locale: input.locale || undefined,
      }),
    })
    if (data?.tags?.length) return data
  } catch {
    // Le modèle local côté client prend le relais si l'API est indisponible.
  }

  return {
    tags: extractTagsLocally(input),
    source: 'local',
  }
}
