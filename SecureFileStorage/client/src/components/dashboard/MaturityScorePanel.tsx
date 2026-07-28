import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n/I18nContext'
import type { DocumentMaturityScore, MaturityPillar, MaturityRecommendation } from '@/types'

function CircularScore({ score, label }: { score: number; label: string }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference
  const levelClass =
    score >= 85 ? 'excellent' : score >= 70 ? 'good' : 'needs'

  return (
    <div className={`maturity-circle maturity-circle-${levelClass}`}>
      <svg viewBox="0 0 140 140" aria-hidden>
        <circle className="maturity-circle-track" cx="70" cy="70" r={radius} />
        <circle
          className="maturity-circle-value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="maturity-circle-content">
        <strong>{score}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function PillarCard({ pillar, t }: { pillar: MaturityPillar; t: (k: string) => string }) {
  const levelKey =
    pillar.level === 'Excellent'
      ? 'maturity.level.excellent'
      : pillar.level === 'Good'
        ? 'maturity.level.good'
        : 'maturity.level.needs'
  const titleKey = `maturity.pillar.${pillar.id}`
  const title = t(titleKey) !== titleKey ? t(titleKey) : pillar.label

  return (
    <article className="maturity-pillar-card">
      <div className="maturity-pillar-head">
        <h3>{title}</h3>
        <span className={`maturity-badge maturity-badge-${pillar.level.toLowerCase()}`}>
          {t(levelKey)}
        </span>
      </div>
      <div className="maturity-pillar-score">{pillar.score}%</div>
      <div className="maturity-progress" role="progressbar" aria-valuenow={pillar.score} aria-valuemin={0} aria-valuemax={100}>
        <div className="maturity-progress-fill" style={{ width: `${pillar.score}%` }} />
      </div>
      <ul className="maturity-metrics">
        {pillar.metrics.map((m) => (
          <li key={m.key}>
            <div className="maturity-metric-row">
              <span>{t(`maturity.metric.${m.key}`)}</span>
              <strong>{m.percent}%</strong>
            </div>
            <div className="maturity-progress maturity-progress-sm">
              <div className="maturity-progress-fill" style={{ width: `${m.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

function RecommendationItem({ item }: { item: MaturityRecommendation }) {
  const { t } = useI18n()
  return (
    <li className={`maturity-rec maturity-rec-${item.severity}`}>
      <div>
        <p>{item.message}</p>
        {item.percent != null && (
          <span className="maturity-rec-pct">{item.percent}%</span>
        )}
      </div>
      {item.actionHref && (
        <Link to={item.actionHref} className="btn btn-sm btn-outline">
          {item.actionLabel || t('maturity.viewDetails')}
        </Link>
      )}
    </li>
  )
}

interface MaturityScorePanelProps {
  data: DocumentMaturityScore
}

export function MaturityScorePanel({ data }: MaturityScorePanelProps) {
  const { t } = useI18n()
  const overallLevelKey =
    data.overallLevel === 'Excellent'
      ? 'maturity.level.excellent'
      : data.overallLevel === 'Good'
        ? 'maturity.level.good'
        : 'maturity.level.needs'

  return (
    <section className="maturity-section" aria-labelledby="maturity-title">
      <div className="maturity-section-header">
        <div>
          <h2 id="maturity-title">{t('maturity.title')}</h2>
          <p>{t('maturity.subtitle')}</p>
        </div>
        <span className={`maturity-badge maturity-badge-${data.overallLevel.toLowerCase()}`}>
          {t(overallLevelKey)}
        </span>
      </div>

      <div className="maturity-overview">
        <CircularScore score={data.overallScore} label={t('maturity.overall')} />
        <div className="maturity-overview-copy">
          <p>{t('maturity.overallHint', { count: String(data.totalDocuments) })}</p>
        </div>
      </div>

      <div className="maturity-pillars">
        <PillarCard pillar={data.organization} t={t} />
        <PillarCard pillar={data.security} t={t} />
        <PillarCard pillar={data.collaboration} t={t} />
      </div>

      <div className="maturity-recs-panel">
        <h3>{t('maturity.recommendations')}</h3>
        {!data.recommendations?.length ? (
          <p className="admin-dash-empty">{t('maturity.noRecommendations')}</p>
        ) : (
          <ul className="maturity-recs-list">
            {data.recommendations.map((r) => (
              <RecommendationItem key={r.id} item={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
