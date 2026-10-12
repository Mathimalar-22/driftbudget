import { useMemo, useState } from 'react'
import { ArrowDownToLine, Layers, Search, Wrench, Zap } from 'lucide-react'
import type { DriftBudgetApi } from '@/lib/driftbudget/client'
import type { DemoView } from '@/lib/driftbudget/engine'
import { MODEL_IDS, type DriftClass, type ModelId } from '@/lib/driftbudget/types'
import { Badge, EmptyState, SectionHeading, StatusDot, downloadCsv, fmt, pct, timeOnly } from './ui'

export function EventsView({ view, db }: { view: DemoView; db: DriftBudgetApi }) {
  const [query, setQuery] = useState('')
  const [model, setModel] = useState<ModelId | 'random'>('random')
  const [cls, setCls] = useState<DriftClass | 'random'>('random')
  const [evolveModel, setEvolveModel] = useState<ModelId>('energy')

  const filtered = useMemo(
    () => view.events.filter((e) => `${e.id} ${e.label} ${e.description} ${e.driftClass}`.toLowerCase().includes(query.toLowerCase())),
    [view.events, query],
  )
  const labels = Object.fromEntries(view.models.map((m) => [m.id, m.label])) as Record<ModelId, string>

  const exportCsv = () =>
    downloadCsv(`drift-events-cycle-${view.cycle}.csv`, [
      ['event', 'model', 'twin_version', 'asset_version', 'drift_class', 'criticality', 'consequence', 'dependents', 'pending_cycles', 'cost', 'impact', 'ratio', 'severity', 'detected_at', 'description'],
      ...view.events.map((e) => [e.id, e.label, e.twinVersion, e.assetVersion, e.driftClass, e.criticality, e.consequence, e.dependents, e.pending, e.cost, fmt(e.impact, 3), fmt(e.ratio, 3), fmt(e.severity, 3), e.detectedAt, e.description]),
    ])

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow="Operations / Drift register"
        title="Drift events"
        description="Detected differences between the configuration each twin model encodes and the asset's current configuration. Each event maps to one repair with cost C(r) and impact I(r)."
        action={
          <button onClick={exportCsv} className="button-secondary" disabled={!view.events.length}>
            <ArrowDownToLine size={14} /> Export CSV
          </button>
        }
      />

      <div className="panel p-4">
        <p className="eyebrow mb-3">CNC simulator controls</p>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <label className="field-label">
              Model
              <select className="field-input" value={model} onChange={(e) => setModel(e.target.value as ModelId | 'random')}>
                <option value="random">Random</option>
                {MODEL_IDS.map((m) => (
                  <option key={m} value={m}>{labels[m]}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Drift class
              <select className="field-input" value={cls} onChange={(e) => setCls(e.target.value as DriftClass | 'random')}>
                <option value="random">Random</option>
                <option value="attribute">Attribute</option>
                <option value="structural">Structural</option>
              </select>
            </label>
            <button
              className="button-primary"
              disabled={db.busy}
              onClick={() => db.inject({ model: model === 'random' ? undefined : model, driftClass: cls === 'random' ? undefined : cls })}
            >
              <Zap size={14} /> Inject drift
            </button>
            <button className="button-secondary" disabled={db.busy} onClick={db.burst} title="Three aspects change at once (scenario S2 style)">
              <Layers size={14} /> Retrofit burst
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="field-label">
              Controlled evolution
              <select className="field-input" value={evolveModel} onChange={(e) => setEvolveModel(e.target.value as ModelId)}>
                {MODEL_IDS.map((m) => (
                  <option key={m} value={m}>{labels[m]}</option>
                ))}
              </select>
            </label>
            <button className="button-secondary" disabled={db.busy} onClick={() => db.evolve(evolveModel)} title="Asset and twin change together: no drift">
              <Wrench size={14} /> Evolve in sync
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Drift injection changes only the asset, so the twin keeps the old version. Controlled evolution changes both, so no drift appears.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search drift events" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events..." className="field-input pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Badge>{view.events.length} pending</Badge>
            <Badge tone="critical">{view.criticalPending} critical</Badge>
            <Badge tone="blue">Σ C(r) = {view.totalCost} units</Badge>
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState>{view.events.length ? 'No events match your search.' : 'No pending drift. Every twin model matches the asset. Inject a drift to try the allocation.'}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Model</th>
                  <th>Change</th>
                  <th>Twin → Asset</th>
                  <th>Class</th>
                  <th>Crit · Cons · Dep</th>
                  <th className="text-right">Pending</th>
                  <th className="text-right">Cost C(r)</th>
                  <th className="text-right">Impact I(r)</th>
                  <th className="text-right">I/C</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr className={e.critical ? 'row-critical' : ''} key={e.id}>
                    <td>
                      <code>{e.id}</code>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{timeOnly(e.detectedAt)}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5 font-medium">
                        <StatusDot drifted critical={e.critical} />
                        {e.label}
                      </div>
                    </td>
                    <td className="change-cell text-muted-foreground">{e.description}</td>
                    <td className="whitespace-nowrap">
                      <code>{e.twinVersion}</code> → <code className="text-primary">{e.assetVersion}</code>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{pct(1 - e.severity)} consistent</div>
                    </td>
                    <td><Badge tone={e.driftClass === 'structural' ? 'warn' : 'neutral'}>{e.driftClass}</Badge></td>
                    <td className="whitespace-nowrap"><span className="font-mono">{e.criticality}</span> · <span className="text-muted-foreground">{e.consequence}</span> · <span className="font-mono">{e.dependents}</span></td>
                    <td className="text-right font-mono text-muted-foreground">{e.pending}</td>
                    <td className="text-right font-mono">{e.cost}</td>
                    <td className="text-right font-mono font-semibold">{fmt(e.impact)}</td>
                    <td className="text-right font-mono">{fmt(e.ratio, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
