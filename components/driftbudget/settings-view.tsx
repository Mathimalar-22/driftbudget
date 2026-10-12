import { useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import type { DriftBudgetApi } from '@/lib/driftbudget/client'
import type { DemoView } from '@/lib/driftbudget/engine'
import { CONSEQUENCES, MODEL_IDS, type Consequence, type Settings } from '@/lib/driftbudget/types'
import { SectionHeading } from './ui'

function Num({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <label className="field-label">
      {label}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="field-input font-mono text-foreground" />
      {hint && <span className="text-[10px] font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function SettingsView({ view, db }: { view: DemoView; db: DriftBudgetApi }) {
  const [s, setS] = useState<Settings>(() => structuredClone(view.settings))
  const set = (fn: (d: Settings) => void) => setS((prev) => { const d = structuredClone(prev); fn(d); return d })

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow="Configuration / Impact model"
        title="Settings"
        description="Weights and maintenance metadata used by Eq. 2 and the repair cost C(r). Saving recalculates every pending repair's impact and cost."
        action={
          <>
            <button className="button-secondary" disabled={db.busy} onClick={async () => { const d = await db.defaultSettings(); if (d) setS(d) }}><RotateCcw size={14} /> Load defaults</button>
            <button className="button-primary" disabled={db.busy} onClick={() => db.saveSettings(s)}><Save size={14} /> Save</button>
          </>
        }
      />

      <div className="panel p-5">
        <p className="eyebrow">Eq. 2 weights</p>
        <p className="mt-1 mb-4 font-mono text-xs text-muted-foreground">I(r) = (wc·Crit(m) + wq·Cons(r) + wd·log2(1 + Dep(m))) · (1 + wp·Pend(r))</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Num label="wc · criticality" step={0.05} value={s.weights.wc} onChange={(v) => set((d) => { d.weights.wc = v })} />
          <Num label="wq · consequence" step={0.05} value={s.weights.wq} onChange={(v) => set((d) => { d.weights.wq = v })} />
          <Num label="wd · dependents" step={0.05} value={s.weights.wd} onChange={(v) => set((d) => { d.weights.wd = v })} />
          <Num label="wp · pending" step={0.05} value={s.weights.wp} onChange={(v) => set((d) => { d.weights.wp = v })} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <p className="eyebrow mb-4">Cons(r): consequence category score</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {CONSEQUENCES.map((c) => (
              <Num key={c} label={c} step={0.5} value={s.consequenceScore[c]} onChange={(v) => set((d) => { d.consequenceScore[c] = v })} />
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <p className="eyebrow mb-4">C(r): repair cost metadata (units)</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Num label="attribute drift" value={s.classCost.attribute} onChange={(v) => set((d) => { d.classCost.attribute = v })} />
            <Num label="structural drift" value={s.classCost.structural} onChange={(v) => set((d) => { d.classCost.structural = v })} />
            <Num label="per extra element" value={s.perElementCost} onChange={(v) => set((d) => { d.perElementCost = v })} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">C(r) = class cost + model overhead + per-element cost × (diverged elements − 1)</p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-heading"><p className="eyebrow">Twin models</p></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Model</th><th>Crit(m) 1–5</th><th>Consequence</th><th>Dep(m)</th><th>Repair overhead</th></tr>
            </thead>
            <tbody>
              {MODEL_IDS.map((id) => {
                const m = s.models[id]
                return (
                  <tr key={id}>
                    <td className="font-medium">{m.label}</td>
                    <td><input type="number" min={1} max={5} value={m.criticality} onChange={(e) => set((d) => { d.models[id].criticality = Number(e.target.value) })} className="field-input w-20 font-mono" /></td>
                    <td>
                      <select value={m.consequence} onChange={(e) => set((d) => { d.models[id].consequence = e.target.value as Consequence })} className="field-input w-36">
                        {CONSEQUENCES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min={0} value={m.dependents} onChange={(e) => set((d) => { d.models[id].dependents = Number(e.target.value) })} className="field-input w-20 font-mono" /></td>
                    <td><input type="number" min={0} value={m.repairOverhead} onChange={(e) => set((d) => { d.models[id].repairOverhead = Number(e.target.value) })} className="field-input w-20 font-mono" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Reset demo data</p>
          <p className="mt-1 text-xs text-muted-foreground">Rebuild the seeded simulator state at cycle 042. History and settings return to their defaults.</p>
        </div>
        <button className="button-secondary" disabled={db.busy} onClick={async () => { await db.reset() }}><RotateCcw size={14} /> Reset demo</button>
      </div>
    </div>
  )
}
