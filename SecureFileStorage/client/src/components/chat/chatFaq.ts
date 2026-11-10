export type ChatFaqIntent =
  | 'upload'
  | 'download'
  | 'documents'
  | 'preview'
  | 'share'
  | 'roles'
  | 'favorites'
  | 'categories'
  | 'archive'
  | 'trash'
  | 'profile'
  | 'dashboard'
  | 'users'
  | 'groups'
  | 'audit'
  | 'config'
  | 'security'
  | 'notifications'
  | 'versions'
  | 'login'
  | 'greeting'
  | 'help'

export interface ChatFaqEntry {
  intent: ChatFaqIntent
  replyKey: string
  suggestionKey: string
  keywords: string[]
  route?: string
  greetingOnly?: boolean
}

export const CHAT_FAQ: ChatFaqEntry[] = [
  {
    intent: 'greeting',
    replyKey: 'chat.faq.greeting',
    suggestionKey: 'chat.suggest.help',
    keywords: ['bonjour', 'hello', 'hi', 'salut', 'hey', 'bonsoir', 'coucou', 'merci', 'thanks', 'thank'],
    greetingOnly: true,
  },
  {
    intent: 'help',
    replyKey: 'chat.faq.help',
    suggestionKey: 'chat.suggest.help',
    keywords: ['aide', 'help', 'assistance', 'comment utiliser', 'how to use', 'que peux', 'what can', 'fonctionnalit', 'features'],
    route: '/',
  },
  {
    intent: 'upload',
    replyKey: 'chat.faq.upload',
    suggestionKey: 'chat.suggest.upload',
    keywords: ['upload', 'uploader', 'televerser', 'importer', 'ajouter fichier', 'add file', 'deposer', 'envoyer fichier', 'nouveau document'],
    route: '/documents/upload',
  },
  {
    intent: 'download',
    replyKey: 'chat.faq.download',
    suggestionKey: 'chat.suggest.download',
    keywords: ['telecharger', 'download', 'telechargement', 'sauvegarder le fichier', 'recuperer le fichier'],
    route: '/documents',
  },
  {
    intent: 'documents',
    replyKey: 'chat.faq.documents',
    suggestionKey: 'chat.suggest.documents',
    keywords: ['mes documents', 'mes fichiers', 'voir mes', 'liste des documents', 'rechercher un fichier'],
    route: '/documents',
  },
  {
    intent: 'preview',
    replyKey: 'chat.faq.preview',
    suggestionKey: 'chat.suggest.preview',
    keywords: ['previsualiser', 'preview', 'apercu', 'ouvrir le fichier', 'lire un document'],
    route: '/documents',
  },
  {
    intent: 'share',
    replyKey: 'chat.faq.share',
    suggestionKey: 'chat.suggest.share',
    keywords: ['partager', 'partage', 'share', 'shared', 'lien securise', 'inviter', 'collabor'],
    route: '/shared',
  },
  {
    intent: 'favorites',
    replyKey: 'chat.faq.favorites',
    suggestionKey: 'chat.suggest.favorites',
    keywords: ['favori', 'favoris', 'favorite', 'etoile'],
    route: '/favorites',
  },
  {
    intent: 'categories',
    replyKey: 'chat.faq.categories',
    suggestionKey: 'chat.suggest.categories',
    keywords: ['categorie', 'categories', 'category', 'classer', 'organiser'],
    route: '/categories',
  },
  {
    intent: 'archive',
    replyKey: 'chat.faq.archive',
    suggestionKey: 'chat.suggest.archive',
    keywords: ['archiver', 'archive', 'archives', 'archived'],
    route: '/archived',
  },
  {
    intent: 'trash',
    replyKey: 'chat.faq.trash',
    suggestionKey: 'chat.suggest.trash',
    keywords: ['corbeille', 'trash', 'supprimer', 'delete', 'restaurer', 'restore', 'vider', 'recuperer'],
    route: '/trash',
  },
  {
    intent: 'profile',
    replyKey: 'chat.faq.profile',
    suggestionKey: 'chat.suggest.profile',
    keywords: ['profil', 'profile', 'mot de passe', 'password', 'avatar', 'mon compte', 'langue', 'theme', 'annuaire', 'directory'],
    route: '/annuaire',
  },
  {
    intent: 'roles',
    replyKey: 'chat.faq.roles',
    suggestionKey: 'chat.suggest.roles',
    keywords: ['role', 'roles', 'permission', 'permissions', 'rbac', 'droits d acces'],
    route: '/annuaire?tab=groups',
  },
  {
    intent: 'dashboard',
    replyKey: 'chat.faq.dashboard',
    suggestionKey: 'chat.suggest.dashboard',
    keywords: ['tableau de bord', 'dashboard', 'statistique', 'accueil'],
    route: '/',
  },
  {
    intent: 'users',
    replyKey: 'chat.faq.users',
    suggestionKey: 'chat.suggest.users',
    keywords: ['utilisateur', 'utilisateurs', 'user', 'users', 'ajouter un utilisateur', 'desactiver'],
    route: '/annuaire?tab=users',
  },
  {
    intent: 'groups',
    replyKey: 'chat.faq.groups',
    suggestionKey: 'chat.suggest.groups',
    keywords: ['groupe', 'groupes', 'group', 'groups', 'equipe'],
    route: '/annuaire?tab=groups',
  },
  {
    intent: 'audit',
    replyKey: 'chat.faq.audit',
    suggestionKey: 'chat.suggest.audit',
    keywords: ['audit', 'tracabilite', 'journal', 'historique des actions'],
    route: '/admin/audit',
  },
  {
    intent: 'config',
    replyKey: 'chat.faq.config',
    suggestionKey: 'chat.suggest.config',
    keywords: ['configuration', 'parametre systeme', 'settings', 'antivirus'],
    route: '/admin/config',
  },
  {
    intent: 'security',
    replyKey: 'chat.faq.security',
    suggestionKey: 'chat.suggest.security',
    keywords: ['securite', 'security', 'chiffrement', 'encrypt', 'gzip', 'integrite', 'hash', 'jwt', 'aes'],
    route: '/admin/config',
  },
  {
    intent: 'notifications',
    replyKey: 'chat.faq.notifications',
    suggestionKey: 'chat.suggest.notifications',
    keywords: ['notification', 'notifications', 'cloche', 'alerte'],
    route: '/annuaire',
  },
  {
    intent: 'versions',
    replyKey: 'chat.faq.versions',
    suggestionKey: 'chat.suggest.versions',
    keywords: ['version', 'versions', 'historique du fichier'],
    route: '/documents',
  },
  {
    intent: 'login',
    replyKey: 'chat.faq.login',
    suggestionKey: 'chat.suggest.login',
    keywords: ['connexion', 'login', 'se connecter', 'session expiree', 'deconnexion'],
    route: '/login',
  },
]

export const DEFAULT_SUGGESTION_INTENTS: ChatFaqIntent[] = ['upload', 'share', 'trash', 'help']

export const FOLLOW_UP_INTENTS: Record<string, ChatFaqIntent[]> = {
  upload: ['documents', 'categories', 'security'],
  download: ['upload', 'documents', 'preview'],
  documents: ['upload', 'share', 'preview'],
  roles: ['groups', 'users', 'categories'],
  preview: ['documents', 'share', 'upload'],
  share: ['documents', 'users', 'security'],
  favorites: ['documents', 'share'],
  categories: ['upload', 'groups', 'documents'],
  archive: ['trash', 'documents'],
  trash: ['archive', 'documents'],
  profile: ['users', 'security', 'help'],
  users: ['groups', 'profile', 'audit'],
  groups: ['users', 'categories'],
  dashboard: ['documents', 'upload'],
  audit: ['users', 'security'],
  config: ['security', 'audit'],
  security: ['upload', 'profile'],
  notifications: ['share', 'profile'],
  versions: ['documents', 'upload'],
  login: ['profile', 'help'],
  help: ['upload', 'share', 'trash'],
  greeting: ['upload', 'share', 'help'],
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function tokenize(normalized: string): string[] {
  return normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 0)
}

function scoreEntry(normalized: string, tokens: string[], entry: ChatFaqEntry): number {
  let score = 0
  for (const kw of entry.keywords) {
    const needle = normalize(kw)
    if (!needle) continue
    if (needle.includes(' ')) {
      if (normalized.includes(needle)) score += Math.max(4, needle.length)
      continue
    }
    for (const token of tokens) {
      if (token === needle) score += Math.max(4, needle.length)
      else if (needle.length >= 4 && (token.startsWith(needle) || (needle.startsWith(token) && token.length >= 4))) {
        score += Math.max(3, Math.floor(needle.length / 2))
      }
    }
  }
  return score
}

function hasStrongTopic(normalized: string, tokens: string[]): boolean {
  return CHAT_FAQ.some((entry) => !entry.greetingOnly && scoreEntry(normalized, tokens, entry) >= 3)
}

export function matchFaq(message: string): ChatFaqEntry | null {
  const normalized = normalize(message)
  if (!normalized) return null
  const tokens = tokenize(normalized)

  let best: { entry: ChatFaqEntry; score: number } | null = null
  for (const entry of CHAT_FAQ) {
    if (entry.greetingOnly && (tokens.length > 4 || hasStrongTopic(normalized, tokens))) continue
    const score = scoreEntry(normalized, tokens, entry)
    if (score > 0 && (!best || score > best.score)) best = { entry, score }
  }
  if (!best || best.score < 3) return null
  return best.entry
}

export function getSuggestionEntries(intents: ChatFaqIntent[] = DEFAULT_SUGGESTION_INTENTS): ChatFaqEntry[] {
  const seen = new Set<ChatFaqIntent>()
  const list: ChatFaqEntry[] = []
  for (const intent of intents) {
    if (seen.has(intent)) continue
    const entry = CHAT_FAQ.find((e) => e.intent === intent)
    if (!entry) continue
    seen.add(intent)
    list.push(entry)
  }
  return list
}

export function suggestionsForPath(pathname: string): ChatFaqIntent[] {
  if (pathname.startsWith('/documents/upload')) return ['upload', 'categories', 'security']
  if (pathname.startsWith('/documents')) return ['upload', 'share', 'preview']
  if (pathname.startsWith('/favorites')) return ['favorites', 'documents', 'share']
  if (pathname.startsWith('/shared')) return ['share', 'documents', 'security']
  if (pathname.startsWith('/categories')) return ['categories', 'groups', 'upload']
  if (pathname.startsWith('/archived')) return ['archive', 'trash', 'documents']
  if (pathname.startsWith('/trash')) return ['trash', 'archive', 'documents']
  if (pathname.startsWith('/annuaire')) return ['profile', 'users', 'groups']
  if (pathname.startsWith('/admin/audit')) return ['audit', 'users', 'security']
  if (pathname.startsWith('/admin/config')) return ['config', 'security', 'help']
  return DEFAULT_SUGGESTION_INTENTS
}

export function followUpIntents(topic: string | undefined, pathname: string): ChatFaqIntent[] {
  const fromTopic = topic ? FOLLOW_UP_INTENTS[topic] : undefined
  if (fromTopic?.length) return fromTopic
  return suggestionsForPath(pathname)
}
