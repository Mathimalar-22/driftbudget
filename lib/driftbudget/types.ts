// Core domain types for DriftBudget (paper Section III).

export const MODEL_IDS = ['spindle', 'cooling', 'safety', 'energy', 'maintenance', 'quality'] as const
export type ModelId = (typeof MODEL_IDS)[number]

export const DRIFT_CLASSES = ['attribute', 'structural'] as const
export type DriftClass = (typeof DRIFT_CLASSES)[number]

export const CONSEQUENCES = ['safety', 'quality', 'production', 'maintenance', 'reporting'] as const
export type Consequence = (typeof CONSEQUENCES)[number]

export const SOLVERS = ['greedy', 'exact', 'fifo', 'severity'] as const
export type SolverId = (typeof SOLVERS)[number]

export type ConfigValue = string | number

/** Versioned configuration of one aspect (model) of the CNC asset. σ(m) = version. */
export interface ModelConfig {
  version: { major: number; minor: number }
  /** Configuration elements: attributes (thresholds, limits) and structure (modes, relations). */
  elements: Record<string, ConfigValue>
}

export interface ModelMeta {
  label: string
  /** Crit(m): model criticality, 1–5. */
  criticality: number
  /** Consequence category of decisions the model supports. */
  consequence: Consequence
  /** Dep(m): number of dependent consumers. */
  dependents: number
  /** Extra repair effort for this model (maintenance metadata), integer units. */
  repairOverhead: number
}

export interface Settings {
  weights: { wc: number; wq: number; wd: number; wp: number }
  /** Cons(r) score per consequence category. */
  consequenceScore: Record<Consequence, number>
  /** Base repair cost per drift class (maintenance metadata), integer units. */
  classCost: Record<DriftClass, number>
  /** Additional cost per extra diverged element beyond the first. */
  perElementCost: number
  models: Record<ModelId, ModelMeta>
}

/** A detected drift event d = ⟨m, σ(m), σ*(m), κ, τ⟩. One event maps to one repair r. */
export interface DriftEvent {
  id: string
  model: ModelId
  twinVersion: string
  assetVersion: string
  driftClass: DriftClass
  /** τ: detection timestamp (simulated clock, ISO). */
  detectedAt: string
  detectedCycle: number
  description: string
}

/** A repair candidate with its computed cost and impact. */
export interface Candidate {
  id: string
  model: ModelId
  driftClass: DriftClass
  detectedAt: string
  cost: number
  impact: number
  /** Measured inconsistency (used by the severity-first baseline), 0–1. */
  severity: number
  pending: number
  critical: boolean
}

export interface RepairRecord {
  eventId: string
  model: ModelId
  before: string
  after: string
  driftClass: DriftClass
  description: string
  cost: number
  impact: number
  pendingCycles: number
}

export interface CycleRecord {
  cycle: number
  executedAt: string
  capacity: number
  used: number
  solver: SolverId
  selectAll: boolean
  impactRestored: number
  repairs: RepairRecord[]
  deferred: { eventId: string; model: ModelId; cost: number; impact: number; pendingCycles: number }[]
  /** Recorded inputs so a past decision can be reconstructed. */
  inputs: Candidate[]
}

export interface ActivityEntry {
  at: string
  kind: 'drift' | 'allocation' | 'repair' | 'system'
  tone: 'neutral' | 'critical' | 'success'
  message: string
  detail: string
}

export interface DemoState {
  schema: 1
  seed: number
  rng: number
  cycle: number
  capacity: number
  clock: string
  nextEventId: number
  asset: Record<ModelId, ModelConfig>
  twin: Record<ModelId, ModelConfig>
  events: DriftEvent[]
  history: CycleRecord[]
  activity: ActivityEntry[]
  settings: Settings
}

export interface Allocation {
  selected: string[]
  deferred: string[]
  used: number
  benefit: number
  selectAll: boolean
}

export interface Proposal extends Allocation {
  cycle: number
  capacity: number
  solver: SolverId
  /** Fingerprint of the inputs; confirm rejects a proposal whose inputs changed. */
  fingerprint: string
}
