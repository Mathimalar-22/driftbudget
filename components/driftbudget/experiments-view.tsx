import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import type { DriftBudgetApi } from '@/lib/driftbudget/client'
import type { ExperimentResult } from '@/lib/driftbudget/experiments'
import type { SolverId } from '@/lib/driftbudget/types'
import { SectionHeading, fmt, pct } from './ui'

const ALL_N = [3, 5, 8, 10, 14]
const ORDER: SolverId[] = ['greedy', 'exact', 'fifo', 'severity']
const NAMES: Record<SolverId, string> = { greedy: 'DriftBudget-Greedy', exact: 'DriftBudget-Exact', fifo: 'FIFO', severity: 'Severity-first' }
// Categorical slots in fixed order (validated palette).
const COLORS: Record<SolverId, string> = { greedy: '#2a78d6', exact: '#eb6834', fifo: '#1baf7a', severity: '#eda100' }

function Chart({ result }: { result: ExperimentResult }) {
  const [hover, setHover] = useState<{ level: string; solver: SolverId; value: number; x: number; y: number } | null>(null)
  const W = 640
  const H = 260
  const m = { top: 16, right: 12, bottom: 32, left: 40 }
  const max = Math.max(...result.levels.flatMap((l) => l.policies.map((p) => p.benefit)))
  const niceMax = Math.ceil(max / 5) * 5 || 5
  const ticks = Array.from({ length: 6 }, (_, i) => (niceMax / 5) * i)
  const plotW = W - m.left - m.right
  const plotH = H - m.top - m.bottom
  const groupW = plotW / result.levels.length
  const barW = Math.min(28, (groupW * 0.7) / ORDER.length - 2)
  const y = (v: number) => m.top + plotH - (v / niceMax) * plotH

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mean restored benefit per policy at each capacity level">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={m.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{t}</text>
          </g>
        ))}
        {result.levels.map((level, gi) => {
          const gx = m.left + gi * groupW + (groupW - ORDER.length * (barW + 2)) / 2
          return (
            <g key={level.id}>
              {ORDER.map((s, i) => {
                const p = level.policies.find((x) => x.solver === s)!
                const x = gx + i * (barW + 2)
                const top = y(p.benefit)
                const h = Math.max(0, m.top + plotH - top)
                const r = Math.min(4, h)
                return (
                  <g key={s} onMouseEnter={() => setHover({ level: level.label, solver: s, value: p.benefit, x: x + barW / 2, y: top })} onMouseLeave={() => setHover(null)}>
                    <rect x={x - 1} y={m.top} width={barW + 2} height={plotH} fill="transparent" />
                    <path
                      d={`M${x},${m.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${m.top + plotH} Z`}
                      fill={COLORS[s]}
                      opacity={hover && (hover.solver !== s || hover.level !== level.label) ? 0.45 : 1}
                    />
                  </g>
                )
              })}
              <text x={m.left + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--foreground)">
                {level.label} ({level.fraction} × Ctot)
              </text>
            </g>
          )
        })}
        <line x1={m.left} x2={W - m.right} y1={m.top + plotH} y2={m.top + plotH} stroke="var(--muted-foreground)" strokeWidth={1} />
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}>
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[hover.solver] }} /> {NAMES[hover.solver]} · {hover.level}
          <div className="font-mono font-semibold">{fmt(hover.value)} mean benefit</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[s] }} />{NAMES[s]}</span>
        ))}
      </div>
    </div>
  )
}

export function ExperimentsView({ db }: { db: DriftBudgetApi }) {
  const [seeds, setSeeds] = useState('30')
  const [nValues, setNValues] = useState<number[]>(ALL_N)
  const [result, setResult] = useState<ExperimentResult | null>(null)

  const run = async () => {
    const r = await db.runExperiment(Math.min(100, Math.max(1, Number(seeds) || 30)), nValues)
    if (r) setResult(r)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow="Evaluation / Scenario S4"
        title="Policy comparison"
        description="Seeded trials: each candidate set is generated once per seed and given unchanged to all four policies, at tight (0.25), moderate (0.50) and generous (0.75) capacity relative to the total pending cost."
        action={<button className="button-primary" disabled={db.busy || !nValues.length} onClick={run}><FlaskConical size={14} /> {db.busy ? 'Running…' : 'Run experiment'}</button>}
      />
      <div className="panel flex flex-wrap items-end gap-4 p-4">
        <label className="field-label w-28">
          Seeds (1…N)
          <input type="number" min={1} max={100} value={seeds} onChange={(e) => setSeeds(e.target.value)} className="field-input font-mono" />
        </label>
        <div className="field-label">
          Drifts per trial (n)
          <div className="flex gap-1.5">
            {ALL_N.map((n) => (
              <button
                key={n}
                className={`chip ${nValues.includes(n) ? 'chip-on' : ''}`}
                onClick={() => setNValues((v) => (v.includes(n) ? v.filter((x) => x !== n) : [...v, n].sort((a, b) => a - b)))}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto lg:max-w-sm">Uses your current impact-model settings. The paper does not publish its weights or costs, so the values will differ from its Table IV.</p>
      </div>

      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {result.levels.map((l) => (
              <div className="panel p-4" key={l.id}>
                <p className="eyebrow">{l.label} capacity</p>
                <p className="mt-3 font-mono text-2xl font-semibold">{pct(l.optimalityGap, 2)}</p>
                <p className="mt-1 text-xs text-muted-foreground">mean Greedy optimality gap vs Exact</p>
                <p className="mt-3 text-xs">Greedy vs FIFO <span className="font-mono font-semibold text-emerald-600">{l.greedyGainVsFifo >= 0 ? '+' : ''}{pct(l.greedyGainVsFifo)}</span> · vs Severity <span className="font-mono font-semibold text-emerald-600">{l.greedyGainVsSeverity >= 0 ? '+' : ''}{pct(l.greedyGainVsSeverity)}</span></p>
              </div>
            ))}
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Restored benefit / capacity utilization</p>
                <p className="mt-1 text-sm text-muted-foreground">Mean over {result.levels[0].trials} trials per capacity level ({result.seeds.length} seeds × n ∈ {'{'}{result.nValues.join(', ')}{'}'})</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Policy</th>{result.levels.map((l) => <th key={l.id} className="text-right">{l.label}</th>)}</tr>
                </thead>
                <tbody>
                  {ORDER.map((s) => (
                    <tr key={s} className={s === 'greedy' ? 'row-active' : ''}>
                      <td className="font-medium">{NAMES[s]}</td>
                      {result.levels.map((l) => {
                        const p = l.policies.find((x) => x.solver === s)!
                        return <td key={l.id} className="text-right font-mono">{fmt(p.benefit)} / {pct(p.utilization)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <p className="eyebrow mb-3">Mean restored benefit by policy</p>
            <Chart result={result} />
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-heading"><p className="eyebrow">Auxiliary measures (mean per trial)</p></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Capacity</th><th>Policy</th><th className="text-right">Critical repairs done</th><th className="text-right">Deferred</th><th className="text-right">Solver latency</th></tr>
                </thead>
                <tbody>
                  {result.levels.flatMap((l) =>
                    ORDER.map((s) => {
                      const p = l.policies.find((x) => x.solver === s)!
                      return (
                        <tr key={`${l.id}-${s}`}>
                          <td className="text-muted-foreground">{l.label}</td>
                          <td>{NAMES[s]}</td>
                          <td className="text-right font-mono">{fmt(p.criticalDone)}</td>
                          <td className="text-right font-mono">{fmt(p.deferred)}</td>
                          <td className="text-right font-mono">{fmt(p.latencyMicros, 1)} µs</td>
                        </tr>
                      )
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
