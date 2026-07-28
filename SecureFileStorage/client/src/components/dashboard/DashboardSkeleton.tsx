export function DashboardSkeleton() {
  return (
    <div className="home-dashboard">
      <div className="home-skeleton-welcome" />
      <div className="home-skeleton-actions" />
      <div className="home-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="home-skeleton-stat" />
        ))}
      </div>
      <div className="home-skeleton-grid">
        <div className="home-skeleton-panel" />
        <div className="home-skeleton-panel" />
      </div>
      <div className="home-skeleton-grid">
        <div className="home-skeleton-panel" />
        <div className="home-skeleton-panel" />
      </div>
    </div>
  )
}
