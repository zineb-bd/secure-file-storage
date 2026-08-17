export function UsersSkeleton() {
  return (
    <div className="users-page-inner">
      <div className="users-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="users-skeleton-stat" />
        ))}
      </div>
      <div className="users-skeleton-toolbar">
        <div className="users-skeleton-search" />
        <div className="users-skeleton-actions" />
      </div>
      <div className="users-skeleton-table" />
    </div>
  )
}
