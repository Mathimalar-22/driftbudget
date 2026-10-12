import { useState } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronRight } from 'lucide-react'
import type { DemoView } from '@/lib/driftbudget/engine'
import { Badge, EmptyState, SOLVER_NAMES, SectionHeading, downloadCsv, fmt, formatClock, pad3 } from './ui'

export function HistoryView({ view, initialCycle }: { view: DemoView; initialCycle?: number }) {
  const [cycle, setCycle] = useState<number | undefined>(initialCycle ?? view.history[0]?.cycle)
  const record = view.history.find((h) => h.cycle === cycle) ?? view.history[0]
  const labels = Object.fromEntries(view.models.map((m) => [m.id, m.label]))

  const downloadLog = () =>
    downloadCsv('driftbudget-repair-log.csv', [
      ['cycle', 'executed_at', 'solver', 'declared_capacity', 'capacity_used', 'event', 'model', 'status', 'before', 'after', 'drift_class', 'cost', 'impact', 'pending_cycles', 'description'],
      ...view.history.flatMap((h) => [
        ...h.repairs.map((r) => [h.cycle, h.executedAt, h.solver, h.capacity, h.used, r.eventId, labels[r.model], 'repaired', r.before, r.after, r.driftClass, r.cost, fmt(r.impact, 3), r.pendingCycles, r.description]),
        ...h.deferred.map((d) => [h.cycle, h.executedAt, h.solver, h.capacity, h.used, d.eventId, labels[d.model], 'deferred', '', '', '', d.cost, fmt(d.impact, 3), d.pendingCycles, '']),
      ]),
    ])

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow="Audit / Repair log"
        title="Repair history"
        description="Persisted allocation cycles with the solver used, the capacity spent and the impact restored. Each cycle keeps its recorded inputs so the decision can be reconstructed."
        action={
          <button onClick={downloadLog} className="button-secondary" disabled={!view.history.length}>
            <ArrowDownToLine size={14} /> Download log
          </button>
        }
      />
      <div className="panel overflow-hidden">
        {view.history.length === 0 ? (
          <EmptyState>No completed cycles yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Cycle</th><th>Capacity</th><th>Solver used</th><th>Repairs executed</th><th>Deferred</th><th className="text-right">Impact restored</th><th /></tr>
              </thead>
              <tbody>
                {view.history.map((h) => (
                  <tr key={h.cycle} onClick={() => setCycle(h.cycle)} className={`cursor-pointer ${record?.cycle === h.cycle ? 'row-active' : ''}`}>
                    <td><code className="font-semibold">CYCLE {pad3(h.cycle)}</code><div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatClock(h.executedAt)}</div></td>
                    <td className="font-mono text-muted-foreground">{h.used} / {h.capacity} units</td>
                    <td><Badge tone={h.solver === 'greedy' ? 'blue' : 'neutral'}>{h.selectAll ? 'Select-all' : SOLVER_NAMES[h.solver]}</Badge></td>
                    <td className="font-mono">{h.repairs.length}</td>
                    <td className="font-mono text-muted-foreground">{h.deferred.length}</td>
                    <td className="text-right font-mono font-semibold text-emerald-600">+{fmt(h.impactRestored)}</td>
                    <td className="text-right"><ChevronRight size={16} className="ml-auto text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {record && (
        <div className="panel overflow-hidden">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Configuration versions</p>
              <p className="mt-1 text-sm font-medium">Cycle {pad3(record.cycle)} · {record.repairs.length} repaired, {record.deferred.length} deferred</p>
            </div>
            <Badge tone="success"><Check size={12} /> repaired</Badge>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {record.repairs.map((r) => (
              <div key={r.eventId}>
                <p className="mb-2 text-sm font-medium">{labels[r.model]} <span className="font-mono text-[10px] text-muted-foreground">{r.eventId} · C {r.cost} · I {fmt(r.impact)}</span></p>
                <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="comparison-box">
                    <p className="eyebrow">Before</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-orange-600">{r.before}</p>
                    <p className="mt-1 text-xs text-muted-foreground">outdated twin configuration</p>
                  </div>
                  <ArrowRight className="hidden text-muted-foreground sm:block" size={18} />
                  <div className="comparison-box comparison-box-after">
                    <p className="eyebrow">After</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-primary">{r.after}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {record.deferred.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="eyebrow mb-2">Deferred to the next cycle</p>
                <div className="flex flex-wrap gap-2">
                  {record.deferred.map((d) => (
                    <Badge key={d.eventId}>{labels[d.model]} · {d.eventId} · C {d.cost} · I {fmt(d.impact)}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
