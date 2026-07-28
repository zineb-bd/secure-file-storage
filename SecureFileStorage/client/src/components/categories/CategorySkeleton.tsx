export function CategorySkeleton() {
  return (
    <div className="cat-page">
      <div className="cat-skeleton-toolbar">
        <div className="cat-skeleton-search" />
        <div className="cat-skeleton-actions" />
      </div>
      <div className="cat-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cat-skeleton-stat" />
        ))}
      </div>
      <div className="cat-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="cat-skeleton-card" />
        ))}
      </div>
    </div>
  )
}

export function CategoryDocsSkeleton() {
  return (
    <div className="cat-docs-skeleton">
      <div className="cat-skeleton-toolbar">
        <div className="cat-skeleton-search" />
        <div className="cat-skeleton-actions" />
      </div>
      <div className="cat-skeleton-table" />
    </div>
  )
}
