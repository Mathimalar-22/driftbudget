import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../lib/driftbudget/config'
import { buildCandidates, buildView, confirm, createInitialState, evolveAsset, injectDrift, propose } from '../lib/driftbudget/engine'
import { generateCandidates, runS4 } from '../lib/driftbudget/experiments'
import { impactScore } from '../lib/driftbudget/impact'
import { Rng } from '../lib/driftbudget/prng'
import { stateSchema } from '../lib/driftbudget/schema'
import { allocate, solveExact, solveGreedy } from '../lib/driftbudget/solvers'
import type { Candidate } from '../lib/driftbudget/types'

function value(cands: Candidate[], ids: Set<string>) {
  return cands.filter((c) => ids.has(c.id)).reduce((s, c) => s + c.impact, 0)
}
function weight(cands: Candidate[], ids: Set<string>) {
  return cands.filter((c) => ids.has(c.id)).reduce((s, c) => s + c.cost, 0)
}
function bruteForce(cands: Candidate[], B: number) {
  let best = 0
  for (let mask = 0; mask < 1 << cands.length; mask++) {
    let w = 0
    let v = 0
    cands.forEach((c, i) => {
      if (mask & (1 << i)) {
        w += c.cost
        v += c.impact
      }
    })
    if (w <= B && v > best) best = v
  }
  return best
}

describe('impact model (Eq. 2)', () => {
  it('matches the formula and grows with pending time', () => {
    const s = DEFAULT_SETTINGS
    const m = s.models.safety
    const base = s.weights.wc * m.criticality + s.weights.wq * s.consequenceScore[m.consequence] + s.weights.wd * Math.log2(1 + m.dependents)
    expect(impactScore(s, 'safety', 0)).toBeCloseTo(base)
    expect(impactScore(s, 'safety', 2)).toBeCloseTo(base * (1 + 2 * s.weights.wp))
    // A deferred safety repair gains more per cycle than a deferred reporting (energy) repair.
    const safetyGain = impactScore(s, 'safety', 1) - impactScore(s, 'safety', 0)
    const energyGain = impactScore(s, 'energy', 1) - impactScore(s, 'energy', 0)
    expect(safetyGain).toBeGreaterThan(energyGain)
  })
})

describe('solvers', () => {
  it('exact DP equals brute force and greedy is feasible and within 2× on 500 random cases', () => {
    const rng = new Rng(7)
    for (let t = 0; t < 500; t++) {
      const n = rng.int(1, 12)
      const cands: Candidate[] = Array.from({ length: n }, (_, i) => ({
        id: `c${i}`, model: 'safety', driftClass: 'attribute', detectedAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        cost: rng.int(1, 20), impact: Math.round(rng.next() * 1000) / 100, severity: rng.next(), pending: 0, critical: false,
      }))
      const B = rng.int(1, 60)
      const opt = bruteForce(cands, B)
      const exact = solveExact(cands, B)
      const greedy = solveGreedy(cands, B)
      expect(weight(cands, exact)).toBeLessThanOrEqual(B)
      expect(value(cands, exact)).toBeCloseTo(opt, 9)
      expect(weight(cands, greedy)).toBeLessThanOrEqual(B)
      expect(value(cands, greedy) * 2).toBeGreaterThanOrEqual(opt - 1e-9)
    }
  })

  it('selects everything without calling a solver when all repairs fit', () => {
    const cands = generateCandidates(DEFAULT_SETTINGS, 1, 5)
    const total = cands.reduce((s, c) => s + c.cost, 0)
    const a = allocate(cands, total, 'fifo')
    expect(a.selectAll).toBe(true)
    expect(a.deferred).toHaveLength(0)
  })

  it('is deterministic: identical input gives identical output', () => {
    const cands = generateCandidates(DEFAULT_SETTINGS, 3, 10)
    const shuffled = [...cands].reverse()
    expect(allocate(cands, 30, 'greedy')).toEqual(allocate(shuffled, 30, 'greedy'))
  })
})

describe('cycle workflow', () => {
  it('builds a valid seeded initial state with real history and pending drifts', () => {
    const s = createInitialState(42)
    expect(stateSchema.safeParse(s).success).toBe(true)
    expect(s.cycle).toBe(42)
    expect(s.history.length).toBe(4)
    expect(s.events.length).toBeGreaterThanOrEqual(5)
    expect(createInitialState(42)).toEqual(s)
  })

  it('propose does not change the state; confirm repairs, logs and advances the cycle', () => {
    const s = createInitialState(42)
    const snapshot = JSON.stringify(s)
    const p = propose(s, 40, 'greedy')
    expect(JSON.stringify(s)).toBe(snapshot)
    expect(p.used).toBeLessThanOrEqual(40)

    const after = confirm(s, p)
    expect(after.cycle).toBe(s.cycle + 1)
    expect(after.history[0].cycle).toBe(s.cycle)
    expect(after.history[0].repairs.map((r) => r.eventId)).toEqual(p.selected)
    const view = buildView(after)
    for (const r of after.history[0].repairs) {
      const m = view.models.find((x) => x.id === r.model)!
      // repaired unless a new drift arrived for the same model when the next cycle opened
      if (!after.events.some((e) => e.model === r.model)) expect(m.consistency).toBe(1)
      expect(r.after).not.toBe(r.before)
    }
    // Deferred repairs carry over with one more pending cycle.
    for (const id of p.deferred) {
      const before = buildCandidates(s).find((c) => c.id === id)!
      const now = buildCandidates(after).find((c) => c.id === id)!
      expect(now.pending).toBe(before.pending + 1)
      expect(now.impact).toBeGreaterThan(before.impact)
    }
  })

  it('rejects a proposal whose inputs changed', () => {
    const s = createInitialState(42)
    const p = propose(s, 40, 'greedy')
    const changed = injectDrift(s)
    expect(() => confirm(changed, p)).toThrow(/changed/)
  })

  it('drift injection leaves the twin untouched; controlled evolution does not create drift', () => {
    const s = createInitialState(42)
    const free = buildView(s).models.find((m) => !m.drifted)!
    const injected = injectDrift(s, { model: free.id })
    expect(injected.twin[free.id]).toEqual(s.twin[free.id])
    expect(injected.asset[free.id].version).not.toEqual(s.asset[free.id].version)

    const evolved = evolveAsset(s, free.id)
    expect(evolved.twin[free.id]).toEqual(evolved.asset[free.id])
    expect(evolved.events.length).toBe(s.events.length)
  })
})

describe('S4 experiment', () => {
  it('runs 30 seeds; exact ≥ greedy ≥ ½·exact, greedy beats baselines when tight', () => {
    const r = runS4(DEFAULT_SETTINGS, Array.from({ length: 30 }, (_, i) => i + 1))
    for (const level of r.levels) {
      const get = (s: string) => level.policies.find((p) => p.solver === s)!
      expect(get('exact').benefit).toBeGreaterThanOrEqual(get('greedy').benefit - 1e-9)
      expect(level.optimalityGap).toBeLessThanOrEqual(0.5)
      expect(level.trials).toBe(150)
    }
    const tight = r.levels[0]
    const g = tight.policies.find((p) => p.solver === 'greedy')!.benefit
    expect(g).toBeGreaterThan(tight.policies.find((p) => p.solver === 'fifo')!.benefit)
  })
})
