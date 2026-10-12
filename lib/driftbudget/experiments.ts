// Seeded evaluation (paper Section IV): scenario S4 — the S1 configuration swept across
// tight / moderate / generous capacity. For every seed the candidate set is generated
// once and the same set is given to all four policies.

import { impactScore, isCritical, repairCost } from './impact'
import { INITIAL_CONFIG } from './config'
import { Rng, seedState } from './prng'
import { allocate } from './solvers'
import { MODEL_IDS, SOLVERS, type Candidate, type Settings, type SolverId } from './types'

export const CAPACITY_LEVELS = [
  { id: 'tight', label: 'Tight', fraction: 0.25 },
  { id: 'moderate', label: 'Moderate', fraction: 0.5 },
  { id: 'generous', label: 'Generous', fraction: 0.75 },
] as const

export const DEFAULT_N_VALUES = [3, 5, 8, 10, 14]

/** Generate one reproducible candidate set of n drift repairs. */
export function generateCandidates(settings: Settings, seed: number, n: number): Candidate[] {
  const rng = new Rng(seedState(seed * 1000 + n))
  const start = Date.parse('2026-01-01T00:00:00.000Z')
  return Array.from({ length: n }, (_, i) => {
    const model = rng.pick(MODEL_IDS)
    const driftClass = rng.next() < 0.3 ? 'structural' : 'attribute'
    const diverged = driftClass === 'structural' ? 1 : rng.int(1, 2)
    const elements = Object.keys(INITIAL_CONFIG[model].elements).length + (driftClass === 'structural' ? 1 : 0)
    const pending = rng.int(0, 3)
    return {
      id: `c${String(i).padStart(2, '0')}`,
      model,
      driftClass,
      detectedAt: new Date(start + i * 60_000 * rng.int(1, 30) + i).toISOString(),
      cost: repairCost(settings, model, driftClass, diverged),
      impact: impactScore(settings, model, pending),
      severity: diverged / elements,
      pending,
      critical: isCritical(settings, model),
    }
  })
}

interface Accumulator {
  benefit: number
  utilization: number
  critical: number
  deferred: number
  micros: number
}

export interface PolicyResult {
  solver: SolverId
  benefit: number
  utilization: number
  criticalDone: number
  deferred: number
  latencyMicros: number
}

export interface LevelResult {
  id: string
  label: string
  fraction: number
  trials: number
  policies: PolicyResult[]
  /** Mean (1 − Greedy/Exact) across trials. */
  optimalityGap: number
  /** Greedy beat both baselines on mean restored benefit. */
  greedyGainVsFifo: number
  greedyGainVsSeverity: number
}

export interface ExperimentResult {
  seeds: number[]
  nValues: number[]
  levels: LevelResult[]
  byN: { n: number; level: string; greedy: number; exact: number; fifo: number; severity: number }[]
}

export function runS4(settings: Settings, seeds: number[], nValues: number[] = DEFAULT_N_VALUES): ExperimentResult {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const byN: ExperimentResult['byN'] = []

  const levels = CAPACITY_LEVELS.map((level) => {
    const acc = Object.fromEntries(SOLVERS.map((s) => [s, { benefit: 0, utilization: 0, critical: 0, deferred: 0, micros: 0 }])) as Record<SolverId, Accumulator>
    let trials = 0
    let gapSum = 0

    for (const n of nValues) {
      const perN = { greedy: 0, exact: 0, fifo: 0, severity: 0 }
      for (const seed of seeds) {
        const candidates = generateCandidates(settings, seed, n) // generated once, reused by every policy
        const total = candidates.reduce((s, c) => s + c.cost, 0)
        const capacity = Math.max(1, Math.round(level.fraction * total))
        const values = {} as Record<SolverId, number>
        for (const solver of SOLVERS) {
          const t0 = now()
          const a = allocate(candidates, capacity, solver)
          const t1 = now()
          const chosen = new Set(a.selected)
          acc[solver].benefit += a.benefit
          acc[solver].utilization += a.used / capacity
          acc[solver].critical += candidates.filter((c) => c.critical && chosen.has(c.id)).length
          acc[solver].deferred += a.deferred.length
          acc[solver].micros += (t1 - t0) * 1000
          values[solver] = a.benefit
          perN[solver] += a.benefit
        }
        gapSum += values.exact > 0 ? 1 - values.greedy / values.exact : 0
        trials++
      }
      byN.push({
        n,
        level: level.id,
        greedy: perN.greedy / seeds.length,
        exact: perN.exact / seeds.length,
        fifo: perN.fifo / seeds.length,
        severity: perN.severity / seeds.length,
      })
    }

    const policies: PolicyResult[] = SOLVERS.map((solver) => ({
      solver,
      benefit: acc[solver].benefit / trials,
      utilization: acc[solver].utilization / trials,
      criticalDone: acc[solver].critical / trials,
      deferred: acc[solver].deferred / trials,
      latencyMicros: acc[solver].micros / trials,
    }))
    const get = (s: SolverId) => policies.find((p) => p.solver === s)!.benefit
    return {
      id: level.id,
      label: level.label,
      fraction: level.fraction,
      trials,
      policies,
      optimalityGap: gapSum / trials,
      greedyGainVsFifo: get('fifo') > 0 ? get('greedy') / get('fifo') - 1 : 0,
      greedyGainVsSeverity: get('severity') > 0 ? get('greedy') / get('severity') - 1 : 0,
    }
  })

  return { seeds, nValues, levels, byN }
}
