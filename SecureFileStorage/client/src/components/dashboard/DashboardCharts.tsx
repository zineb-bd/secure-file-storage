import { useMemo } from 'react'
import {
  AreaChart,
  BarChart,
  ChartCard,
  ChartLegend,
  chartColor,
  DonutChart,
} from '@/components/dashboard/charts'
import { useI18n } from '@/i18n/I18nContext'
import {
  activityByDay,
  groupByCategory,
  sizeByCategory,
} from '@/utils/dashboardHelpers'
import { fmtSize } from '@/utils/format'
import type { DashboardStats, DocumentDto } from '@/types'

interface DashboardChartsProps {
  stats: DashboardStats
  documents: DocumentDto[]
}

export function DashboardCharts({ stats, documents }: DashboardChartsProps) {
  const { t, locale } = useI18n()

  const categoryBars = useMemo(() => {
    return groupByCategory(documents).map((c, i) => ({
      label: c.name,
      value: c.count,
      color: chartColor(i),
    }))
  }, [documents])

  const volumeSlices = useMemo(() => {
    return sizeByCategory(documents)
      .filter((c) => c.bytes > 0)
      .map((c, i) => ({
        label: c.name,
        value: c.bytes,
        color: chartColor(i + 2),
      }))
  }, [documents])

  const volumeTotal = useMemo(
    () => volumeSlices.reduce((sum, s) => sum + s.value, 0),
    [volumeSlices],
  )

  const activityTrend = useMemo(() => {
    return activityByDay(stats.recentActivity || [], 7, locale).map((d) => ({
      label: d.name,
      value: d.count,
    }))
  }, [stats.recentActivity, locale])

  const hasData =
    documents.length > 0 || (stats.recentActivity?.length ?? 0) > 0

  if (!hasData) return null

  return (
    <section className="dash-charts" aria-label={t('chart.section')}>
      <div className="dash-charts-header">
        <h2>{t('chart.section')}</h2>
        <p>{t('chart.sectionHint')}</p>
      </div>
      <div className="dash-charts-grid dash-charts-grid-3">
        <ChartCard title={t('chart.categories.title')}>
          {categoryBars.length ? (
            <BarChart items={categoryBars} />
          ) : (
            <p className="dash-chart-empty">{t('chart.empty')}</p>
          )}
        </ChartCard>

        <ChartCard
          title={t('chart.volume.title')}
          footer={<ChartLegend slices={volumeSlices} />}
        >
          {volumeSlices.length ? (
            <div className="dash-donut-wrap">
              <DonutChart
                slices={volumeSlices}
                centerValue={fmtSize(volumeTotal)}
                centerLabel={t('chart.volume.total')}
                valueFormatter={fmtSize}
              />
            </div>
          ) : (
            <p className="dash-chart-empty">{t('chart.empty')}</p>
          )}
        </ChartCard>

        <ChartCard title={t('chart.activity.title')}>
          {activityTrend.some((p) => p.value > 0) ? (
            <AreaChart points={activityTrend} color={chartColor(0)} />
          ) : (
            <p className="dash-chart-empty">{t('chart.empty')}</p>
          )}
        </ChartCard>
      </div>
    </section>
  )
}
