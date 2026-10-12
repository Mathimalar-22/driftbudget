'use client'

import { useState } from 'react'
import { Activity, ChevronRight, Cpu, Database, FlaskConical, History as HistoryIcon, LayoutDashboard, Loader2, Menu, Settings2, SlidersHorizontal, X } from 'lucide-react'
import { useDriftBudget } from '@/lib/driftbudget/client'
import { AllocationView } from '@/components/driftbudget/allocation-view'
import { DashboardView } from '@/components/driftbudget/dashboard-view'
import { EventsView } from '@/components/driftbudget/events-view'
import { ExperimentsView } from '@/components/driftbudget/experiments-view'
import { HistoryView } from '@/components/driftbudget/history-view'
import type { View } from '@/components/driftbudget/nav'
import { SettingsView } from '@/components/driftbudget/settings-view'
import { formatClock, pad3 } from '@/components/driftbudget/ui'

const navItems: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Drift Events', icon: Activity },
  { label: 'Allocation', icon: SlidersHorizontal },
  { label: 'History', icon: HistoryIcon },
  { label: 'Experiments', icon: FlaskConical },
]

export default function Page() {
  const db = useDriftBudget()
  const [view, setView] = useState<View>('Dashboard')
  const [historyCycle, setHistoryCycle] = useState<number | undefined>()
  const [menuOpen, setMenuOpen] = useState(false)
  const v = db.view

  const go = (next: View) => {
    setView(next)
    setMenuOpen(false)
    if (next !== 'History') setHistoryCycle(undefined)
  }

  const renderView = () => {
    if (!v) return null
    switch (view) {
      case 'Dashboard':
        return <DashboardView view={v} onNavigate={go} />
      case 'Drift Events':
        return <EventsView view={v} db={db} />
      case 'Allocation':
        return <AllocationView view={v} db={db} onConfirmed={(cycle) => { setHistoryCycle(cycle); setView('History') }} />
      case 'History':
        return <HistoryView key={historyCycle ?? 'latest'} view={v} initialCycle={historyCycle} />
      case 'Experiments':
        return <ExperimentsView db={db} />
      case 'Settings':
        return <SettingsView key={JSON.stringify(v.settings)} view={v} db={db} />
    }
  }

  return (
    <main className="app-shell">
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark"><Cpu size={17} /></span><span>DriftBudget</span></div>
          <span className="sidebar-version">v1.0</span>
          <button aria-label="Close navigation" className="sidebar-close" onClick={() => setMenuOpen(false)}><X size={16} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">AC</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">Acme Manufacturing</p>
            <p className="truncate text-[11px] text-sidebar-muted">production / cnc-twin-01</p>
          </div>
          <ChevronRight size={14} className="ml-auto rotate-90 text-sidebar-muted" />
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button aria-current={view === label ? 'page' : undefined} onClick={() => go(label)} className={`nav-item ${view === label ? 'nav-item-active' : ''}`} key={label}>
              <Icon size={16} />
              <span>{label}</span>
              {label === 'Drift Events' && v && <span className="nav-count">{v.events.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => go('Settings')} className={`nav-item ${view === 'Settings' ? 'nav-item-active' : ''}`}><Settings2 size={16} /><span>Settings</span></button>
          <div className="operator">
            <span className="operator-avatar">PO</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">Plant Operator</p>
              <p className="truncate text-[11px] text-sidebar-muted">maintenance lead</p>
            </div>
          </div>
        </div>
      </aside>
      <section className="main-shell">
        <header className="mobile-header">
          <button aria-label="Open navigation" className="button-quiet" onClick={() => setMenuOpen(true)}><Menu size={18} /></button>
          <div className="brand"><span className="brand-mark"><Cpu size={15} /></span><span>DriftBudget</span></div>
          <span className="status-live"><span className="status-dot status-dot-live" /> Live</span>
        </header>
        <div className="topbar">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database size={14} /> Digital Twin Registry <ChevronRight size={13} /> <span className="text-foreground">{view}</span>
          </div>
          <div className="flex items-center gap-3">
            {db.busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            {v && <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">CYCLE {pad3(v.cycle)} · {formatClock(v.clock)}</span>}
            <span className="status-live"><span className="status-dot status-dot-live" /> Live</span>
          </div>
        </div>
        <div className="page-content">
          {db.error && (
            <div className="banner banner-error" role="alert">
              <span>{db.error}</span>
              <button aria-label="Dismiss" onClick={db.clearError}><X size={14} /></button>
            </div>
          )}
          {db.notice && <div className="banner banner-success" role="status">{db.notice}</div>}
          {v ? renderView() : (
            <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading the simulator state…</div>
          )}
        </div>
      </section>
    </main>
  )
}
