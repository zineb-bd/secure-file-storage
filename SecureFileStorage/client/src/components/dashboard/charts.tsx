import { useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

export interface ChartSlice {
  label: string
  value: number
  color: string
}

const CHART_PALETTE = [
  '#0ea5e9',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#64748b',
  '#14b8a6',
]

export function chartColor(index: number) {
  return CHART_PALETTE[index % CHART_PALETTE.length]
}

type TipState = {
  label: string
  value: string
  color: string
  x: number
  y: number
} | null

function ChartGlassTip({ tip }: { tip: TipState }) {
  if (!tip) return null
  return (
    <div
      className="dash-glass-tip visible"
      style={
        {
          left: tip.x,
          top: tip.y,
          '--tip-accent': tip.color,
        } as CSSProperties
      }
      role="tooltip"
    >
      <span className="dash-glass-tip-dot" aria-hidden />
      <div className="dash-glass-tip-text">
        <strong>{tip.label}</strong>
        <em>{tip.value}</em>
      </div>
    </div>
  )
}

function useChartTip(containerRef: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<TipState>(null)

  const show = (label: string, value: string, color: string, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.min(Math.max(12, clientX - rect.left + 14), rect.width - 12)
    const y = Math.min(Math.max(12, clientY - rect.top - 12), rect.height - 12)
    setTip({ label, value, color, x, y })
  }

  const hide = () => setTip(null)

  return { tip, show, hide }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutArcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const large = endAngle - startAngle > 180 ? 1 : 0
  const o1 = polarToCartesian(cx, cy, rOuter, endAngle)
  const o0 = polarToCartesian(cx, cy, rOuter, startAngle)
  const i1 = polarToCartesian(cx, cy, rInner, startAngle)
  const i0 = polarToCartesian(cx, cy, rInner, endAngle)
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i0.x} ${i0.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ')
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 168,
  valueFormatter,
}: {
  slices: ChartSlice[]
  centerLabel?: string
  centerValue?: string
  size?: number
  valueFormatter?: (value: number) => string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useChartTip(wrapRef)
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const cx = 80
  const cy = 80
  const rOuter = 66
  const rInner = 44
  const format = valueFormatter ?? ((v: number) => String(v))

  if (total <= 0) {
    return (
      <div className="dash-donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" aria-hidden>
          <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} className="dash-donut-empty" />
        </svg>
        <div className="dash-donut-center">
          <strong>0</strong>
          {centerLabel && <span>{centerLabel}</span>}
        </div>
      </div>
    )
  }

  let angle = 0
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const sweep = (slice.value / total) * 360
      const start = angle
      const end = angle + Math.max(sweep, 0.5)
      angle += sweep
      return { ...slice, start, end, pct: Math.round((slice.value / total) * 100) }
    })

  return (
    <div className="dash-donut dash-chart-interactive" ref={wrapRef} style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" aria-hidden>
        <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2} className="dash-donut-track" />
        {arcs.map((slice) => (
          <path
            key={slice.label}
            d={donutArcPath(cx, cy, rOuter, rInner, slice.start, slice.end)}
            fill={slice.color}
            className={`dash-donut-arc${active === slice.label ? ' active' : ''}`}
            onMouseEnter={(e) => {
              setActive(slice.label)
              show(
                slice.label,
                `${format(slice.value)} · ${slice.pct}%`,
                slice.color,
                e.clientX,
                e.clientY,
              )
            }}
            onMouseMove={(e) =>
              show(
                slice.label,
                `${format(slice.value)} · ${slice.pct}%`,
                slice.color,
                e.clientX,
                e.clientY,
              )
            }
            onMouseLeave={() => {
              setActive(null)
              hide()
            }}
          />
        ))}
      </svg>
      <div className="dash-donut-center">
        {centerValue && <strong>{centerValue}</strong>}
        {centerLabel && <span>{centerLabel}</span>}
      </div>
      <ChartGlassTip tip={tip} />
    </div>
  )
}

export function BarChart({
  items,
  maxBars = 6,
  valueFormatter,
}: {
  items: ChartSlice[]
  maxBars?: number
  valueFormatter?: (value: number) => string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useChartTip(wrapRef)
  const data = items.slice(0, maxBars)
  const max = Math.max(...data.map((d) => d.value), 1)
  const format = valueFormatter ?? ((v: number) => String(v))

  if (!data.length) {
    return <p className="dash-chart-empty">—</p>
  }

  return (
    <div className="dash-bars dash-chart-interactive" ref={wrapRef} role="img">
      {data.map((item) => {
        const height = Math.max(8, Math.round((item.value / max) * 100))
        return (
          <div
            key={item.label}
            className="dash-bar-col"
            onMouseEnter={(e) =>
              show(item.label, format(item.value), item.color, e.clientX, e.clientY)
            }
            onMouseMove={(e) =>
              show(item.label, format(item.value), item.color, e.clientX, e.clientY)
            }
            onMouseLeave={hide}
          >
            <div className="dash-bar-track">
              <div
                className="dash-bar-fill"
                style={{ height: `${height}%`, background: item.color }}
              />
            </div>
            <span className="dash-bar-label">{item.label}</span>
          </div>
        )
      })}
      <ChartGlassTip tip={tip} />
    </div>
  )
}

export function HorizontalBars({
  items,
  maxBars = 6,
  valueFormatter,
}: {
  items: ChartSlice[]
  maxBars?: number
  valueFormatter?: (value: number) => string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useChartTip(wrapRef)
  const data = items.slice(0, maxBars)
  const max = Math.max(...data.map((d) => d.value), 1)
  const format = valueFormatter ?? ((v: number) => String(v))

  if (!data.length) {
    return <p className="dash-chart-empty">—</p>
  }

  return (
    <div className="dash-hbars-wrap dash-chart-interactive" ref={wrapRef}>
      <ul className="dash-hbars">
        {data.map((item) => {
          const width = Math.max(4, Math.round((item.value / max) * 100))
          return (
            <li
              key={item.label}
              onMouseEnter={(e) =>
                show(item.label, format(item.value), item.color, e.clientX, e.clientY)
              }
              onMouseMove={(e) =>
                show(item.label, format(item.value), item.color, e.clientX, e.clientY)
              }
              onMouseLeave={hide}
            >
              <div className="dash-hbar-meta">
                <span>{item.label}</span>
                <strong>{format(item.value)}</strong>
              </div>
              <div className="dash-hbar-track">
                <div
                  className="dash-hbar-fill"
                  style={{ width: `${width}%`, background: item.color }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <ChartGlassTip tip={tip} />
    </div>
  )
}

export function ChartLegend({ slices }: { slices: ChartSlice[] }) {
  const visible = slices.filter((s) => s.value > 0)
  if (!visible.length) return null
  return (
    <ul className="dash-legend">
      {visible.map((s) => (
        <li key={s.label}>
          <i style={{ background: s.color }} aria-hidden />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  )
}

export function ChartCard({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="dash-chart-card">
      <h3>{title}</h3>
      <div className="dash-chart-body">{children}</div>
      {footer}
    </section>
  )
}

export function AreaChart({
  points,
  color = '#0ea5e9',
  valueFormatter,
}: {
  points: { label: string; value: number }[]
  color?: string
  valueFormatter?: (value: number) => string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useChartTip(wrapRef)
  const gradId = useId().replace(/:/g, '')
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const format = valueFormatter ?? ((v: number) => String(v))

  if (!points.length) {
    return <p className="dash-chart-empty">—</p>
  }

  const width = 320
  const height = 140
  const padX = 12
  const padY = 16
  const max = Math.max(...points.map((p) => p.value), 1)
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = padX + i * step
    const y = height - padY - (p.value / max) * (height - padY * 2)
    return { x, y, ...p }
  })

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')
  const area = `${line} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`

  return (
    <div className="dash-area dash-chart-interactive" ref={wrapRef} role="img">
      <svg viewBox={`0 0 ${width} ${height}`} className="dash-area-svg" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={c.label}>
            <circle
              cx={c.x}
              cy={c.y}
              r={activeIdx === i ? 6 : 3.5}
              fill="#fff"
              stroke={color}
              strokeWidth="2"
              className={`dash-area-point${activeIdx === i ? ' active' : ''}`}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r="14"
              fill="transparent"
              className="dash-area-hit"
              onMouseEnter={(e) => {
                setActiveIdx(i)
                show(c.label, format(c.value), color, e.clientX, e.clientY)
              }}
              onMouseMove={(e) => show(c.label, format(c.value), color, e.clientX, e.clientY)}
              onMouseLeave={() => {
                setActiveIdx(null)
                hide()
              }}
            />
          </g>
        ))}
      </svg>
      <div className="dash-area-labels">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
      <ChartGlassTip tip={tip} />
    </div>
  )
}
