import { api } from '@/api/client'

export type ChatSource = 'faq' | 'ai' | 'fallback'

export interface ChatApiResponse {
  reply: string
  source: ChatSource
  topic?: string
  route?: string | null
}

export async function askChatbot(message: string, locale?: string): Promise<ChatApiResponse> {
  return api<ChatApiResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, locale }),
  })
}
