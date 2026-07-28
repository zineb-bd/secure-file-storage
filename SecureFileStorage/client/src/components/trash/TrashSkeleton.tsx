export function TrashSkeleton() {
  return (
    <div className="trash-page-inner">
      <div className="trash-skeleton-toolbar">
        <div className="trash-skeleton-search" />
        <div className="trash-skeleton-actions" />
      </div>
      <div className="trash-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="trash-skeleton-stat" />
        ))}
      </div>
      <div className="trash-skeleton-table" />
    </div>
  )
}
