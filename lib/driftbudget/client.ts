'use client'

// Client side of the system: calls the API routes and keeps the returned state.
// The API is stateless (works on Vercel serverless without a database), so the
// browser persists the state in localStorage and sends it with every request.

import { useCallback, useEffect, useState } from 'react'
import type { DemoView } from './engine'
import type { ExperimentResult } from './experiments'
import type { DemoState, DriftClass, ModelId, Proposal, Settings, SolverId } from './types'

const STORAGE_KEY = 'driftbudget.state.v1'

export interface PolicyComparison {
  solver: SolverId
  benefit: number
  used: number
  selected: number
}

async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

function save(state: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable: the demo still works for this session */
  }
}

function load(): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoState) : null
  } catch {
    return null
  }
}

export function useDriftBudget() {
  const [state, setState] = useState<DemoState | null>(null)
  const [view, setView] = useState<DemoView | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [comparison, setComparison] = useState<PolicyComparison[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const apply = useCallback((data: { state: DemoState; view: DemoView }) => {
    setState(data.state)
    setView(data.view)
    setProposal(null)
    setComparison(null)
    save(data.state)
  }, [])

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const stored = load()
    run(async () => {
      if (stored) {
        try {
          apply(await api('/api/view', { state: stored }))
          return
        } catch {
          /* stored state no longer valid: fall through to a fresh one */
        }
      }
      apply(await api('/api/state', {}))
    })
  }, [apply, run])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000)
  }

  return {
    state,
    view,
    proposal,
    comparison,
    busy,
    error,
    notice,
    clearError: () => setError(null),
    reset: () =>
      run(async () => {
        apply(await api('/api/state', {}))
        flash('Demo data reset to the seeded cycle 042.')
      }),
    inject: (opts: { model?: ModelId; driftClass?: DriftClass }) =>
      run(async () => apply(await api('/api/drifts/inject', { state, ...opts }))),
    burst: () => run(async () => apply(await api('/api/drifts/inject', { state, burst: true }))),
    evolve: (model: ModelId) => run(async () => apply(await api('/api/asset/evolve', { state, model }))),
    propose: (capacity: number, solver: SolverId) =>
      run(async () => {
        const data = await api<{ proposal: Proposal; comparison: PolicyComparison[] }>('/api/allocation/propose', { state, capacity, solver })
        setProposal(data.proposal)
        setComparison(data.comparison)
        return data.proposal
      }),
    discardProposal: () => {
      setProposal(null)
      setComparison(null)
    },
    confirm: () =>
      run(async () => {
        const data = await api<{ state: DemoState; view: DemoView }>('/api/allocation/confirm', { state, proposal })
        apply(data)
        flash(`Cycle ${String(data.state.history[0].cycle).padStart(3, '0')} executed and saved to history.`)
        return data.state.history[0].cycle
      }),
    saveSettings: (settings: Settings) =>
      run(async () => {
        apply(await api('/api/settings', { state, settings }, 'PUT'))
        flash('Settings saved. Impact and cost scores were recalculated.')
      }),
    defaultSettings: () => run(async () => (await api<{ settings: Settings }>('/api/settings', undefined, 'GET')).settings),
    runExperiment: (seeds: number, nValues: number[]) =>
      run(async () => api<ExperimentResult>('/api/experiments', { settings: state?.settings, seeds, nValues })),
  }
}

export type DriftBudgetApi = ReturnType<typeof useDriftBudget>
