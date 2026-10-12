import type { ReactNode } from 'react'
import type { SolverId } from '@/lib/driftbudget/types'

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'critical' | 'success' | 'blue' | 'warn' }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>
}

export function StatusDot({ drifted, critical }: { drifted: boolean; critical?: boolean }) {
  return <span className={`status-dot ${drifted ? (critical ? 'status-dot-alert' : 'status-dot-warn') : ''}`} />
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</div>
}

export const SOLVER_NAMES: Record<SolverId, string> = {
  greedy: 'Greedy',
  exact: 'Exact',
  fifo: 'FIFO',
  severity: 'Severity-first',
}

export const SOLVER_OPTIONS: { id: SolverId; label: string }[] = [
  { id: 'greedy', label: 'Greedy (deployed, Alg. 2)' },
  { id: 'exact', label: 'Exact DP (Alg. 1)' },
  { id: 'fifo', label: 'FIFO (baseline)' },
  { id: 'severity', label: 'Severity-first (baseline)' },
]

export const pad3 = (n: number) => String(n).padStart(3, '0')
export const fmt = (n: number, d = 2) => n.toFixed(d)
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`

export function formatClock(iso: string) {
  const d = new Date(iso)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)} UTC`
}

export function timeOnly(iso: string) {
  return new Date(iso).toISOString().slice(11, 19)
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
