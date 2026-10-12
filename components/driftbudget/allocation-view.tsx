import { useState } from 'react'
import { Check, CheckCheck, Clock3, Info, Sparkles, X } from 'lucide-react'
import type { DriftBudgetApi } from '@/lib/driftbudget/client'
import type { DemoView } from '@/lib/driftbudget/engine'
import type { SolverId } from '@/lib/driftbudget/types'
import { Badge, EmptyState, SOLVER_NAMES, SOLVER_OPTIONS, SectionHeading, fmt, pad3, pct } from './ui'

export function AllocationView({ view, db, onConfirmed }: { view: DemoView; db: DriftBudgetApi; onConfirmed: (cycle: number) => void }) {
  const [capacity, setCapacity] = useState(String(view.capacity))
  const [solver, setSolver] = useState<SolverId>('greedy')
  const p = db.proposal
  const byId = new Map(view.events.map((e) => [e.id, e]))
  const selected = p ? p.selected.map((id) => byId.get(id)!).filter(Boolean) : []
  const deferred = p ? p.deferred.map((id) => byId.get(id)!).filter(Boolean) : []
  const cap = Number(capacity)
  const validCap = Number.isInteger(cap) && cap >= 1

  const runAllocation = () => validCap && db.propose(cap, solver)
  const confirm = async () => {
    const cycle = await db.confirm()
    if (cycle !== undefined) onConfirmed(cycle)
  }

  const used = p?.used ?? 0
  const shownCap = p?.capacity ?? (validCap ? cap : view.capacity)

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow={`Planning / Cycle ${pad3(view.cycle)}`}
        title="Repair allocation"
        description="Optimize limited repair capacity against impact scores and operational constraints. Proposing does not change the twin; only confirming runs the repair executor."
        action={p ? <Badge tone="blue">Proposal · {SOLVER_NAMES[p.solver]}</Badge> : <Badge tone="blue">Solver ready</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Selected for repair</p>
              <p className="mt-1 text-sm text-muted-foreground">Highest impact per unit cost</p>
            </div>
            <Badge tone="success"><Check size={12} /> {selected.length} selected</Badge>
          </div>
          {!p ? (
            <EmptyState>Set the declared capacity and run the allocation to see which repairs fit.</EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {selected.map((e) => (
                <div className="repair-row" key={e.id}>
                  <div className="flex items-center gap-3">
                    <span className="repair-icon repair-icon-selected"><Check size={14} /></span>
                    <div>
                      <p className="text-sm font-medium">{e.label} <span className="font-mono text-[10px] text-muted-foreground">{e.id}</span></p>
                      <p className="font-mono text-[11px] text-muted-foreground">{e.twinVersion} → {e.assetVersion} · ρ {fmt(e.ratio, 3)}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <p className="font-semibold">I {fmt(e.impact)}</p>
                    <p className="text-muted-foreground">C {e.cost} u</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Deferred</p>
              <p className="mt-1 text-sm text-muted-foreground">Queued for a future cycle</p>
            </div>
            <Badge>{deferred.length} deferred</Badge>
          </div>
          {!p ? (
            <EmptyState>{view.events.length} pending candidates · Σ C(r) = {view.totalCost} units</EmptyState>
          ) : deferred.length === 0 ? (
            <EmptyState>Nothing deferred. Every pending repair fits this cycle.</EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {deferred.map((e) => (
                <div className="repair-row" key={e.id}>
                  <div className="flex items-center gap-3">
                    <span className="repair-icon"><Clock3 size={14} /></span>
                    <div>
                      <p className="text-sm font-medium">{e.label} <span className="font-mono text-[10px] text-muted-foreground">{e.id}</span></p>
                      <p className="font-mono text-[11px] text-muted-foreground">pending · cycle {e.pending} → {e.pending + 1} if deferred</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-muted-foreground">
                    <p className="font-semibold">I {fmt(e.impact)}</p>
                    <p>C {e.cost} u</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Projected capacity</p>
                <p className="mt-1 font-mono text-2xl font-semibold">
                  {used} <span className="text-sm font-normal text-muted-foreground">/ {shownCap} units</span>
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{pct(used / shownCap)}</span>
            </div>
            <div className="capacity-track mt-3"><div className="capacity-fill" style={{ width: `${Math.min(1, used / shownCap) * 100}%` }} /></div>
            {p && <p className="mt-2 font-mono text-[11px] text-muted-foreground">restored benefit Σ I(r) = {fmt(p.benefit)}</p>}
          </div>
          <label className="field-label w-full lg:w-36">
            Declared capacity
            <input aria-label="Declared capacity" type="number" min="1" step="1" value={capacity} onChange={(e) => { setCapacity(e.target.value); db.discardProposal() }} className="field-input font-mono text-foreground" />
          </label>
          <label className="field-label w-full lg:w-56">
            Solver
            <select className="field-input" value={solver} onChange={(e) => { setSolver(e.target.value as SolverId); db.discardProposal() }}>
              {SOLVER_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button onClick={runAllocation} disabled={db.busy || !validCap || !view.events.length} className="button-primary whitespace-nowrap">
            <Sparkles size={14} /> Run allocation
          </button>
        </div>
        {!validCap && <p className="mt-3 text-xs text-alert">Declared capacity must be a whole number of at least 1.</p>}
      </div>

      {p && (
        <div className="panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Info size={16} className="mt-0.5 shrink-0 text-warn" />
              <div className="text-sm">
                <p className="font-medium">Proposal only: twin state unchanged</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.selectAll
                    ? 'All pending repairs fit in the declared capacity, so every repair is selected and no solver is needed.'
                    : `${SOLVER_NAMES[p.solver]} selected ${p.selected.length} of ${p.selected.length + p.deferred.length} repairs. Confirming re-checks the proposal against the current drifts, updates the twin models and closes cycle ${pad3(p.cycle)}.`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={db.discardProposal}><X size={14} /> Discard</button>
              <button className="button-confirm" disabled={db.busy} onClick={confirm}><CheckCheck size={14} /> Confirm &amp; execute</button>
            </div>
          </div>
          {db.comparison && !p.selectAll && (
            <div className="mt-5 overflow-x-auto border-t border-border pt-4">
              <p className="eyebrow mb-2">Same candidates through every policy</p>
              <table className="data-table compact">
                <thead>
                  <tr><th>Policy</th><th className="text-right">Repairs</th><th className="text-right">Units used</th><th className="text-right">Restored benefit</th></tr>
                </thead>
                <tbody>
                  {db.comparison.map((c) => (
                    <tr key={c.solver} className={c.solver === p.solver ? 'row-active' : ''}>
                      <td>{SOLVER_NAMES[c.solver]}{c.solver === p.solver && <span className="ml-2 text-[10px] text-primary">current</span>}</td>
                      <td className="text-right font-mono">{c.selected}</td>
                      <td className="text-right font-mono">{c.used} / {p.capacity}</td>
                      <td className="text-right font-mono font-semibold">{fmt(c.benefit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
