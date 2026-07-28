export function AuditSkeleton() {
  return (
    <div className="audit-page-inner">
      <div className="audit-skeleton-toolbar">
        <div className="audit-skeleton-search" />
        <div className="audit-skeleton-actions" />
      </div>
      <div className="audit-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="audit-skeleton-stat" />
        ))}
      </div>
      <div className="audit-skeleton-table" />
    </div>
  )
}
