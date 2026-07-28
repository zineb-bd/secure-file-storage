export function RolesSkeleton() {
  return (
    <div className="roles-page-inner">
      <div className="roles-skeleton-toolbar">
        <div className="roles-skeleton-search" />
        <div className="roles-skeleton-actions" />
      </div>
      <div className="roles-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="roles-skeleton-stat" />
        ))}
      </div>
      <div className="roles-skeleton-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="roles-skeleton-card" />
        ))}
      </div>
    </div>
  )
}
