import { ChevronRight, CircleAlert, Gauge, MoreHorizontal, Play } from 'lucide-react'
import type { DemoView } from '@/lib/driftbudget/engine'
import type { View } from './nav'
import { SectionHeading, StatusDot, pad3, pct, timeOnly } from './ui'

export function DashboardView({ view, onNavigate }: { view: DemoView; onNavigate: (v: View) => void }) {
  const demand = view.totalCost
  const over = demand > view.capacity
  const fill = Math.min(1, demand / view.capacity)
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        eyebrow="Operations / Overview"
        title="Digital Twin health"
        description="Monitor model consistency and prioritize repairs before they become operational risk."
        action={
          <button onClick={() => onNavigate('Allocation')} className="button-primary">
            <Play size={14} /> Run allocation
          </button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {view.models.map((m) => (
          <div className="panel group p-4" key={m.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <StatusDot drifted={m.drifted} critical={m.critical} />
                <span className="font-medium">{m.label}</span>
              </div>
              {m.drifted ? (
                <span className="font-mono text-[10px] text-muted-foreground">asset {m.assetVersion}</span>
              ) : (
                <MoreHorizontal size={16} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="font-mono text-xl font-semibold tracking-tight">{m.twinVersion}</p>
                <p className="mt-1 text-xs text-muted-foreground">encoded configuration</p>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm font-semibold ${m.drifted ? (m.critical ? 'text-alert' : 'text-warn') : ''}`}>{pct(m.consistency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">consistency</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.05fr_1.5fr]">
        <div className="panel flex min-h-40 flex-col justify-between gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Pending drift events</span>
            <CircleAlert size={16} className={view.events.length ? 'text-orange-500' : 'text-muted-foreground'} />
          </div>
          <div>
            <span className="font-mono text-5xl font-semibold tracking-[-0.06em]">{String(view.events.length).padStart(2, '0')}</span>
            <p className="mt-2 text-xs text-muted-foreground">
              {view.criticalPending} on critical models (Crit ≥ 4) require attention this cycle
            </p>
          </div>
          <button onClick={() => onNavigate('Drift Events')} className="link-button self-start">
            Review events <ChevronRight size={14} />
          </button>
        </div>
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Cycle capacity</p>
              <p className="mt-1 text-sm font-medium">
                Allocation window <span className="font-mono text-muted-foreground">/ CYCLE {pad3(view.cycle)}</span>
              </p>
            </div>
            <Gauge size={18} className="text-primary" />
          </div>
          <div className="mt-7 flex items-end justify-between">
            <span className="font-mono text-3xl font-semibold">
              {demand} <span className="text-base text-muted-foreground">/ {view.capacity} units</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">{pct(demand / view.capacity)}</span>
          </div>
          <div className="capacity-track mt-3">
            <div className={`capacity-fill ${over ? 'capacity-fill-over' : ''}`} style={{ width: `${fill * 100}%` }} />
          </div>
          <div className="mt-3 flex justify-between gap-4 text-xs text-muted-foreground">
            <span>pending repair cost vs declared capacity</span>
            <span>{over ? `${demand - view.capacity} units over: allocation needed` : 'all pending repairs fit'}</span>
          </div>
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="eyebrow">Recent activity</p>
            <p className="mt-1 text-sm font-medium">Latest system events</p>
          </div>
          <button onClick={() => onNavigate('History')} className="link-button">
            View history <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-border">
          {view.activity.slice(0, 6).map((a, i) => (
            <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between" key={`${a.at}-${i}`}>
              <div className="flex items-center gap-3">
                <span className={`activity-mark ${a.tone === 'critical' ? 'activity-mark-alert' : a.tone === 'success' ? 'activity-mark-success' : ''}`} />
                <span className="text-sm">{a.message}</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
                <span>{a.detail}</span>
                <span>{timeOnly(a.at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
