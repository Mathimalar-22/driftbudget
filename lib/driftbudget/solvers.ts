// Repair allocation engine (paper Section III-D).
// Eq. (1): choose R' ⊆ R maximising Σ I(r) subject to Σ C(r) ≤ B — a 0/1 knapsack.

import type { Allocation, Candidate, SolverId } from './types'

/** Deterministic tie-break: detection timestamp ascending, then candidate ID. */
function byDetection(a: Candidate, b: Candidate): number {
  if (a.detectedAt !== b.detectedAt) return a.detectedAt < b.detectedAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function ratio(c: Candidate): number {
  return c.impact / c.cost
}

function result(candidates: Candidate[], chosen: Set<string>, selectAll = false): Allocation {
  const selected = candidates
    .filter((c) => chosen.has(c.id))
    .sort((a, b) => ratio(b) - ratio(a) || byDetection(a, b))
  const deferred = candidates.filter((c) => !chosen.has(c.id)).sort(byDetection)
  return {
    selected: selected.map((c) => c.id),
    deferred: deferred.map((c) => c.id),
    used: selected.reduce((s, c) => s + c.cost, 0),
    benefit: selected.reduce((s, c) => s + c.impact, 0),
    selectAll,
  }
}

/** Fill the budget in the given order, skipping candidates that no longer fit. */
function fillInOrder(order: Candidate[], capacity: number): Set<string> {
  const chosen = new Set<string>()
  let left = capacity
  for (const c of order) {
    if (c.cost <= left) {
      chosen.add(c.id)
      left -= c.cost
    }
  }
  return chosen
}

/**
 * Algorithm 1 — exact dynamic programming, O(nB). Evaluation optimum.
 * V[i][b] = max(V[i−1][b], V[i−1][b−Ci] + Ii) if Ci ≤ b, else V[i−1][b].
 */
export function solveExact(candidates: Candidate[], capacity: number): Set<string> {
  const items = [...candidates].sort(byDetection)
  const n = items.length
  const B = Math.max(0, Math.floor(capacity))
  const V: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(B + 1))
  for (let i = 1; i <= n; i++) {
    const { cost, impact } = items[i - 1]
    for (let b = 0; b <= B; b++) {
      const skip = V[i - 1][b]
      V[i][b] = cost <= b ? Math.max(skip, V[i - 1][b - cost] + impact) : skip
    }
  }
  // Backtrack to recover the chosen set.
  const chosen = new Set<string>()
  let b = B
  for (let i = n; i >= 1; i--) {
    if (V[i][b] !== V[i - 1][b]) {
      chosen.add(items[i - 1].id)
      b -= items[i - 1].cost
    }
  }
  return chosen
}

/**
 * Algorithm 2 — deployed greedy solver, O(n log n).
 * Order by ρ = I/C (ties: detection time, then ID), fill greedily, then return the
 * better of that set and the best single feasible candidate (restores the 2× bound).
 */
export function solveGreedy(candidates: Candidate[], capacity: number): Set<string> {
  const order = [...candidates].sort((a, b) => ratio(b) - ratio(a) || byDetection(a, b))
  const greedy = fillInOrder(order, capacity)
  const greedyValue = candidates.filter((c) => greedy.has(c.id)).reduce((s, c) => s + c.impact, 0)

  let best: Candidate | undefined
  for (const c of [...candidates].sort(byDetection)) {
    if (c.cost <= capacity && (!best || c.impact > best.impact)) best = c
  }
  if (best && best.impact > greedyValue) return new Set([best.id])
  return greedy
}

/** Baseline: FIFO, detection order, no prioritisation. */
export function solveFifo(candidates: Candidate[], capacity: number): Set<string> {
  return fillInOrder([...candidates].sort(byDetection), capacity)
}

/** Baseline: severity-first, largest measured inconsistency first, ignoring cost. */
export function solveSeverity(candidates: Candidate[], capacity: number): Set<string> {
  const order = [...candidates].sort((a, b) => b.severity - a.severity || byDetection(a, b))
  return fillInOrder(order, capacity)
}

const SOLVER_FNS: Record<SolverId, (c: Candidate[], b: number) => Set<string>> = {
  greedy: solveGreedy,
  exact: solveExact,
  fifo: solveFifo,
  severity: solveSeverity,
}

export const SOLVER_LABELS: Record<SolverId, string> = {
  greedy: 'DriftBudget-Greedy',
  exact: 'DriftBudget-Exact',
  fifo: 'FIFO',
  severity: 'Severity-first',
}

/** A solver is only called when the declared capacity cannot accept every pending candidate. */
export function allocate(candidates: Candidate[], capacity: number, solver: SolverId): Allocation {
  const total = candidates.reduce((s, c) => s + c.cost, 0)
  if (total <= capacity) return result(candidates, new Set(candidates.map((c) => c.id)), true)
  return result(candidates, SOLVER_FNS[solver](candidates, capacity))
}
