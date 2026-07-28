export type ChatFaqIntent =
  | 'upload'
  | 'documents'
  | 'share'
  | 'categories'
  | 'archive'
  | 'trash'
  | 'profile'
  | 'dashboard'
  | 'roles'
  | 'users'
  | 'audit'
  | 'config'
  | 'security'
  | 'greeting'
  | 'help'

export interface ChatFaqEntry {
  intent: ChatFaqIntent
  replyKey: string
  suggestionKey: string
  keywords: string[]
}

export const CHAT_FAQ: ChatFaqEntry[] = [
  {
    intent: 'greeting',
    replyKey: 'chat.faq.greeting',
    suggestionKey: 'chat.suggest.help',
    keywords: ['bonjour', 'hello', 'hi', 'salut', 'hey', 'bonsoir', 'coucou', 'merci', 'thanks', 'thank'],
  },
  {
    intent: 'help',
    replyKey: 'chat.faq.help',
    suggestionKey: 'chat.suggest.help',
    keywords: ['aide', 'help', 'assistance', 'comment utiliser', 'how to use', 'que peux', 'what can', 'fonctionnalit', 'features'],
  },
  {
    intent: 'upload',
    replyKey: 'chat.faq.upload',
    suggestionKey: 'chat.suggest.upload',
    keywords: [
      'upload', 'uploader', 'téléverser', 'televerser', 'importer', 'ajouter fichier', 'add file',
      'déposer', 'deposer', 'envoyer fichier', 'chargement', 'nouveau document', 'comment uploader',
    ],
  },
  {
    intent: 'documents',
    replyKey: 'chat.faq.documents',
    suggestionKey: 'chat.suggest.documents',
    keywords: [
      'document', 'documents', 'fichier', 'fichiers', 'mes docs', 'rechercher', 'search',
      'télécharger', 'telecharger', 'download', 'prévisualiser', 'preview', 'voir mes',
    ],
  },
  {
    intent: 'share',
    replyKey: 'chat.faq.share',
    suggestionKey: 'chat.suggest.share',
    keywords: ['partag', 'share', 'shared', 'lien', 'inviter', 'collabor', 'accès', 'acces'],
  },
  {
    intent: 'categories',
    replyKey: 'chat.faq.categories',
    suggestionKey: 'chat.suggest.categories',
    keywords: ['catégorie', 'categorie', 'categories', 'category', 'classer', 'organiser', 'organize'],
  },
  {
    intent: 'archive',
    replyKey: 'chat.faq.archive',
    suggestionKey: 'chat.suggest.archive',
    keywords: ['archiv', 'archive', 'archived'],
  },
  {
    intent: 'trash',
    replyKey: 'chat.faq.trash',
    suggestionKey: 'chat.suggest.trash',
    keywords: ['corbeille', 'trash', 'supprim', 'delete', 'restaurer', 'restore', 'vider', 'récupérer', 'recuperer'],
  },
  {
    intent: 'profile',
    replyKey: 'chat.faq.profile',
    suggestionKey: 'chat.suggest.profile',
    keywords: ['profil', 'profile', 'mot de passe', 'password', 'compte', 'avatar', 'langue'],
  },
  {
    intent: 'dashboard',
    replyKey: 'chat.faq.dashboard',
    suggestionKey: 'chat.suggest.dashboard',
    keywords: ['tableau de bord', 'dashboard', 'accueil', 'statistique', 'stats', 'overview'],
  },
  {
    intent: 'roles',
    replyKey: 'chat.faq.roles',
    suggestionKey: 'chat.suggest.roles',
    keywords: ['rôle', 'role', 'roles', 'droits', 'permission'],
  },
  {
    intent: 'users',
    replyKey: 'chat.faq.users',
    suggestionKey: 'chat.suggest.users',
    keywords: ['utilisateur', 'utilisateurs', 'user', 'users', 'compte utilisateur'],
  },
  {
    intent: 'audit',
    replyKey: 'chat.faq.audit',
    suggestionKey: 'chat.suggest.audit',
    keywords: ['audit', 'journal', 'traçabilité', 'tracabilite', 'historique'],
  },
  {
    intent: 'config',
    replyKey: 'chat.faq.config',
    suggestionKey: 'chat.suggest.config',
    keywords: ['config', 'configuration', 'paramètre', 'parametre', 'settings', 'antivirus'],
  },
  {
    intent: 'security',
    replyKey: 'chat.faq.security',
    suggestionKey: 'chat.suggest.security',
    keywords: ['sécurité', 'securite', 'security', 'chiffrement', 'encrypt', 'intégrité', 'integrite', 'hash', 'jwt'],
  },
]

export const DEFAULT_SUGGESTION_INTENTS: ChatFaqIntent[] = ['upload', 'share', 'trash', 'help']

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

export function matchFaq(message: string): ChatFaqEntry | null {
  const normalized = normalize(message)
  if (!normalized) return null

  let best: { entry: ChatFaqEntry; score: number } | null = null

  for (const entry of CHAT_FAQ) {
    let score = 0
    for (const kw of entry.keywords) {
      const needle = normalize(kw)
      if (needle && normalized.includes(needle)) {
        score += Math.max(1, Math.floor(needle.length / 4))
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score }
    }
  }

  return best?.entry ?? null
}

export function getSuggestionEntries(intents: ChatFaqIntent[] = DEFAULT_SUGGESTION_INTENTS): ChatFaqEntry[] {
  return intents
    .map((intent) => CHAT_FAQ.find((e) => e.intent === intent))
    .filter((e): e is ChatFaqEntry => e != null)
}
