export function ArchiveSkeleton() {
  return (
    <div className="archive-page-inner">
      <div className="archive-skeleton-toolbar">
        <div className="archive-skeleton-search" />
        <div className="archive-skeleton-actions" />
      </div>
      <div className="archive-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="archive-skeleton-stat" />
        ))}
      </div>
      <div className="archive-skeleton-table" />
    </div>
  )
}
