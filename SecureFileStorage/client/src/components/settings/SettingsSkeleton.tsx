export function SettingsSkeleton() {
  return (
    <div className="settings-layout">
      <aside className="settings-nav settings-skeleton-nav">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="settings-skeleton-nav-item" />
        ))}
      </aside>
      <div className="settings-content">
        <div className="settings-skeleton-header" />
        <div className="settings-skeleton-card" />
        <div className="settings-skeleton-card" />
      </div>
    </div>
  )
}
