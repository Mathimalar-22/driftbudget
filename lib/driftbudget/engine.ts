// Cycle workflow: drift input → candidates (cost & impact) → propose → confirm → repair executor.
// Every function is pure: it takes a state and returns a new one, so the same
// inputs always give the same outputs (paper Section III-D, "deterministic control flow").

import { DEFAULT_SETTINGS, INITIAL_CONFIG } from './config'
import { impactScore, isCritical, repairCost } from './impact'
import { Rng, seedState } from './prng'
import { applyChange, cloneConfig, consistency, divergedElements, isDrifted, versionString } from './simulator'
import { allocate } from './solvers'
import {
  MODEL_IDS,
  type ActivityEntry,
  type Candidate,
  type CycleRecord,
  type DemoState,
  type DriftClass,
  type DriftEvent,
  type ModelId,
  type Proposal,
  type Settings,
  type SolverId,
} from './types'

const CYCLE_HOURS = 8
const MAX_ACTIVITY = 40
const MAX_HISTORY = 60

export class EngineError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function advanceClock(state: DemoState, minutes: number) {
  state.clock = new Date(new Date(state.clock).getTime() + minutes * 60_000).toISOString()
}

function log(state: DemoState, entry: Omit<ActivityEntry, 'at'>) {
  state.activity.unshift({ at: state.clock, ...entry })
  state.activity = state.activity.slice(0, MAX_ACTIVITY)
}

function withRng<T>(state: DemoState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng)
  const out = fn(rng)
  state.rng = rng.state
  return out
}

// ───────────────────────────── Drift input ─────────────────────────────

/** Drift injection: the asset changes, the twin keeps its old version. Registers or updates the drift event. */
function injectInto(state: DemoState, model: ModelId, rng: Rng, forceClass?: DriftClass): DriftEvent {
  const change = applyChange(state.asset[model], model, rng, forceClass)
  state.asset[model] = change.config
  advanceClock(state, rng.int(3, 25))

  const existing = state.events.find((e) => e.model === model)
  if (existing) {
    // A further change before repair: same repair action, now targeting the newer configuration.
    existing.assetVersion = versionString(change.config)
    if (change.driftClass === 'structural') existing.driftClass = 'structural'
    existing.description = `${existing.description}; ${change.description}`
    log(state, { kind: 'drift', tone: 'critical', message: `${state.settings.models[model].label} drift updated`, detail: `${existing.twinVersion} → ${existing.assetVersion}` })
    return existing
  }

  const event: DriftEvent = {
    id: `D-${String(state.nextEventId++).padStart(4, '0')}`,
    model,
    twinVersion: versionString(state.twin[model]),
    assetVersion: versionString(change.config),
    driftClass: change.driftClass,
    detectedAt: state.clock,
    detectedCycle: state.cycle,
    description: change.description,
  }
  state.events.push(event)
  log(state, { kind: 'drift', tone: 'critical', message: `${state.settings.models[model].label} drift event detected`, detail: `${event.id} · ${event.twinVersion} → ${event.assetVersion}` })
  return event
}

export function injectDrift(input: DemoState, opts: { model?: ModelId; driftClass?: DriftClass } = {}): DemoState {
  const state = clone(input)
  withRng(state, (rng) => injectInto(state, opts.model ?? rng.pick(MODEL_IDS), rng, opts.driftClass))
  return state
}

/** Multi-aspect retrofit (scenario S2 style): several aspects change at once. */
export function retrofitBurst(input: DemoState, count = 3): DemoState {
  const state = clone(input)
  withRng(state, (rng) => {
    const models = [...MODEL_IDS]
    for (let i = 0; i < Math.min(count, models.length); i++) {
      const idx = rng.int(0, models.length - 1)
      const [model] = models.splice(idx, 1)
      injectInto(state, model, rng)
    }
  })
  return state
}

/** Controlled evolution: the asset changes and the twin is updated with it, so no drift appears. */
export function evolveAsset(input: DemoState, model: ModelId): DemoState {
  const state = clone(input)
  if (state.events.some((e) => e.model === model)) {
    throw new EngineError(`${state.settings.models[model].label} has a pending drift; repair it before a controlled evolution.`, 409)
  }
  withRng(state, (rng) => {
    const change = applyChange(state.asset[model], model, rng)
    state.asset[model] = change.config
    state.twin[model] = cloneConfig(change.config)
    advanceClock(state, rng.int(3, 15))
    log(state, { kind: 'system', tone: 'neutral', message: `${state.settings.models[model].label} controlled evolution`, detail: `twin and asset → ${versionString(change.config)}` })
  })
  return state
}

// ─────────────────────── Metadata extractor & benefit ───────────────────────

export function buildCandidates(state: DemoState): Candidate[] {
  return state.events.map((event) => {
    const twin = state.twin[event.model]
    const asset = state.asset[event.model]
    const diverged = divergedElements(twin, asset).length
    const pending = Math.max(0, state.cycle - event.detectedCycle)
    return {
      id: event.id,
      model: event.model,
      driftClass: event.driftClass,
      detectedAt: event.detectedAt,
      cost: repairCost(state.settings, event.model, event.driftClass, diverged),
      impact: impactScore(state.settings, event.model, pending),
      severity: 1 - consistency(twin, asset),
      pending,
      critical: isCritical(state.settings, event.model),
    }
  })
}

function fingerprint(value: unknown): string {
  const text = JSON.stringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ─────────────────────────── Propose / confirm ───────────────────────────

/** Propose an allocation. Does NOT change the stored twin state. */
export function propose(state: DemoState, capacity: number, solver: SolverId): Proposal {
  if (!Number.isInteger(capacity) || capacity < 1) throw new EngineError('Declared capacity must be a positive whole number of units.')
  const candidates = buildCandidates(state)
  if (candidates.length === 0) throw new EngineError('There are no pending drift events to allocate.', 409)
  const allocation = allocate(candidates, capacity, solver)
  return {
    ...allocation,
    cycle: state.cycle,
    capacity,
    solver,
    fingerprint: fingerprint({ cycle: state.cycle, capacity, solver, candidates }),
  }
}

/** Confirm a proposal: re-validate it against the current inputs, then run the repair executor. */
export function confirm(input: DemoState, proposal: Proposal): DemoState {
  const check = propose(input, proposal.capacity, proposal.solver)
  if (check.fingerprint !== proposal.fingerprint || check.selected.join() !== proposal.selected.join()) {
    throw new EngineError('The pending drifts changed since this proposal was made. Run the allocation again.', 409)
  }

  const state = clone(input)
  const candidates = buildCandidates(state)
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const eventsById = new Map(state.events.map((e) => [e.id, e]))

  // Repair executor: bring each selected twin model to the asset's current configuration.
  const repairs = check.selected.map((id) => {
    const event = eventsById.get(id)!
    const cand = byId.get(id)!
    const before = versionString(state.twin[event.model])
    state.twin[event.model] = cloneConfig(state.asset[event.model])
    const after = versionString(state.twin[event.model])
    return {
      eventId: id,
      model: event.model,
      before,
      after,
      driftClass: event.driftClass,
      description: event.description,
      cost: cand.cost,
      impact: cand.impact,
      pendingCycles: cand.pending,
    }
  })

  state.events = state.events.filter((e) => !check.selected.includes(e.id))
  advanceClock(state, 30)

  const record: CycleRecord = {
    cycle: state.cycle,
    executedAt: state.clock,
    capacity: check.capacity,
    used: check.used,
    solver: check.solver,
    selectAll: check.selectAll,
    impactRestored: check.benefit,
    repairs,
    deferred: check.deferred.map((id) => {
      const c = byId.get(id)!
      return { eventId: id, model: c.model, cost: c.cost, impact: c.impact, pendingCycles: c.pending }
    }),
    inputs: candidates,
  }
  state.history.unshift(record)
  state.history = state.history.slice(0, MAX_HISTORY)
  state.capacity = check.capacity

  log(state, {
    kind: 'repair',
    tone: 'success',
    message: `Cycle ${pad(record.cycle)} executed: ${repairs.length} repair${repairs.length === 1 ? '' : 's'}`,
    detail: `${record.used}/${record.capacity} units · +${record.impactRestored.toFixed(2)}`,
  })

  nextCycle(state)
  return state
}

/** Close the maintenance window: deferred repairs carry over with one more pending cycle; new drifts may arrive. */
function nextCycle(state: DemoState) {
  state.cycle += 1
  state.clock = new Date(new Date(state.history[0]?.executedAt ?? state.clock).getTime() + CYCLE_HOURS * 3_600_000).toISOString()
  withRng(state, (rng) => {
    // Scenario S1-style steady arrivals between cycles.
    const arrivals = rng.int(0, 2)
    for (let i = 0; i < arrivals; i++) injectInto(state, rng.pick(MODEL_IDS), rng)
  })
  log(state, { kind: 'system', tone: 'neutral', message: `Cycle ${pad(state.cycle)} opened`, detail: `${state.events.length} pending drift events` })
}

export function updateSettings(input: DemoState, settings: Settings): DemoState {
  const state = clone(input)
  state.settings = settings
  log(state, { kind: 'system', tone: 'neutral', message: 'Impact model settings updated', detail: `wc ${settings.weights.wc} · wq ${settings.weights.wq} · wd ${settings.weights.wd} · wp ${settings.weights.wp}` })
  return state
}

export function pad(cycle: number): string {
  return String(cycle).padStart(3, '0')
}

// ───────────────────────────── Initial state ─────────────────────────────

/** Build the demo state by actually running the simulator for a few cycles, so the history is real. */
export function createInitialState(seed = 42): DemoState {
  let state: DemoState = {
    schema: 1,
    seed,
    rng: seedState(seed),
    cycle: 38,
    capacity: 30,
    clock: '2026-10-09T06:00:00.000Z',
    nextEventId: 101,
    asset: clone(INITIAL_CONFIG),
    twin: clone(INITIAL_CONFIG),
    events: [],
    history: [],
    activity: [],
    settings: clone(DEFAULT_SETTINGS),
  }
  log(state, { kind: 'system', tone: 'neutral', message: 'Twin sync completed', detail: '6 models consistent' })

  // Cycles 038–041: drifts arrive and are allocated with the deployed solver.
  const capacities = [20, 22, 18, 20]
  for (const cap of capacities) {
    state = retrofitBurst(state, 3)
    const p = propose(state, cap, 'greedy')
    state = confirm(state, p)
  }
  // Cycle 042: top up to five pending drift events for the operator to allocate.
  while (state.events.length < 5) {
    const free = MODEL_IDS.filter((m) => !state.events.some((e) => e.model === m))
    state = injectDrift(state, { model: free[new Rng(state.rng).int(0, free.length - 1)] })
  }
  state.capacity = 30
  return state
}

// ─────────────────────────────── View ───────────────────────────────

export function buildView(state: DemoState) {
  const candidates = buildCandidates(state)
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const models = MODEL_IDS.map((id) => {
    const twin = state.twin[id]
    const asset = state.asset[id]
    const drifted = isDrifted(twin, asset)
    const event = state.events.find((e) => e.model === id)
    return {
      id,
      label: state.settings.models[id].label,
      twinVersion: versionString(twin),
      assetVersion: versionString(asset),
      consistency: consistency(twin, asset),
      drifted,
      critical: isCritical(state.settings, id),
      divergedElements: divergedElements(twin, asset),
      eventId: event?.id ?? null,
    }
  })
  const events = state.events.map((e) => {
    const c = byId.get(e.id)!
    const meta = state.settings.models[e.model]
    return {
      ...e,
      label: meta.label,
      criticality: meta.criticality,
      consequence: meta.consequence,
      dependents: meta.dependents,
      pending: c.pending,
      cost: c.cost,
      impact: c.impact,
      ratio: c.impact / c.cost,
      severity: c.severity,
      critical: c.critical,
    }
  })
  const totalCost = candidates.reduce((s, c) => s + c.cost, 0)
  return {
    cycle: state.cycle,
    clock: state.clock,
    capacity: state.capacity,
    models,
    events,
    totalCost,
    criticalPending: events.filter((e) => e.critical).length,
    history: state.history,
    activity: state.activity,
    settings: state.settings,
    seed: state.seed,
  }
}

export type DemoView = ReturnType<typeof buildView>
