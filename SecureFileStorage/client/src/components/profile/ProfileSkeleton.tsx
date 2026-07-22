export function ProfileSkeleton() {
  return (
    <section className="page profile-page" id="page-profile">
      <div className="profile-skeleton">
        <div className="profile-skeleton-header">
          <div className="profile-skeleton-avatar" />
          <div className="profile-skeleton-lines">
            <div className="profile-skeleton-line lg" />
            <div className="profile-skeleton-line md" />
            <div className="profile-skeleton-line sm" />
          </div>
        </div>
        <div className="profile-skeleton-stats">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="profile-skeleton-stat" />
          ))}
        </div>
        <div className="profile-skeleton-grid">
          <div className="profile-skeleton-card tall" />
          <div className="profile-skeleton-card tall" />
          <div className="profile-skeleton-card" />
          <div className="profile-skeleton-card" />
        </div>
      </div>
    </section>
  )
}
