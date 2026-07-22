const ICONS: Record<string, string> = {
  dashboard: 'M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 10h1v7a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-7h1a1 1 0 00.707-1.707l-7-7z',
  documents: 'M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z',
  shared: 'M13 7a3 3 0 11-6 0 3 3 0 016 0zM6 9a2 2 0 00-2 2v1h12v-1a2 2 0 00-2-2h-1.5l-.7-.7A2 2 0 0010 7.6 2 2 0 008.2 8.3L7.5 9H6zm-3 4v3a2 2 0 002 2h10a2 2 0 002-2v-3H3z',
  categories: 'M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H2V6zm0 3h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9z',
  archived: 'M4 3a2 2 0 00-2 2v1h16V5a2 2 0 00-2-2H4zm14 4H2v8a2 2 0 002 2h12a2 2 0 002-2V7zM7 10h6v2H7v-2z',
  trash: 'M8 2h4v1H8V2zm-2 2h8l-1 12H7L6 4zm2 3v7h1V7H8zm3 0v7h1V7h-1z',
  profile: 'M10 10a3 3 0 100-6 3 3 0 000 6zm-7 8a7 7 0 0114 0H3z',
  users: 'M7 8a3 3 0 116 0 3 3 0 01-6 0zM3 17a5 5 0 0110 0H3zm10-2a4 4 0 014 2h-2.1a6 6 0 00-1.9-2zM13 7a2 2 0 114 0 2 2 0 01-4 0z',
  roles: 'M10 2l7 4v5c0 4.2-3 7.7-7 9-4-1.3-7-4.8-7-9V6l7-4zm0 2.2L5 7.3V11c0 3.1 2.2 5.8 5 6.8 2.8-1 5-3.7 5-6.8V7.3L10 4.2z',
  audit: 'M4 2h12a1 1 0 011 1v14l-3-2-3 2-3-2-3 2-3-2V3a1 1 0 011-1z',
  config: 'M4 4h12v12H4V4zm2 2v8h8V6H6zm1 1h6v1H7V7zm0 2h6v1H7V9zm0 2h4v1H7v-1z',
}

export function NavIcon({ name }: { name: string }) {
  const d = ICONS[name]
  if (!d) return null
  return (
    <span className="nav-icon">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d={d} />
      </svg>
    </span>
  )
}
