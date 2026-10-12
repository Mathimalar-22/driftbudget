// Request validation (the FastAPI-style validation layer from the paper, done with zod).

import { z } from 'zod'
import { CONSEQUENCES, DRIFT_CLASSES, MODEL_IDS, SOLVERS } from './types'

const modelId = z.enum(MODEL_IDS)
const driftClass = z.enum(DRIFT_CLASSES)
const solver = z.enum(SOLVERS)
const consequence = z.enum(CONSEQUENCES)
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid timestamp')

const modelConfig = z.object({
  version: z.object({ major: z.number().int().min(0), minor: z.number().int().min(0) }),
  elements: z.record(z.string(), z.union([z.string(), z.number()])),
})

const perModel = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ spindle: schema, cooling: schema, safety: schema, energy: schema, maintenance: schema, quality: schema })

const modelMeta = z.object({
  label: z.string().min(1).max(40),
  criticality: z.number().min(1).max(5),
  consequence,
  dependents: z.number().int().min(0).max(50),
  repairOverhead: z.number().int().min(0).max(100),
})

export const settingsSchema = z.object({
  weights: z.object({ wc: z.number().min(0).max(10), wq: z.number().min(0).max(10), wd: z.number().min(0).max(10), wp: z.number().min(0).max(10) }),
  consequenceScore: z.object({ safety: z.number().min(0).max(10), quality: z.number().min(0).max(10), production: z.number().min(0).max(10), maintenance: z.number().min(0).max(10), reporting: z.number().min(0).max(10) }),
  classCost: z.object({ attribute: z.number().int().min(1).max(500), structural: z.number().int().min(1).max(500) }),
  perElementCost: z.number().int().min(0).max(100),
  models: perModel(modelMeta),
})

const candidate = z.object({
  id: z.string(),
  model: modelId,
  driftClass,
  detectedAt: iso,
  cost: z.number(),
  impact: z.number(),
  severity: z.number(),
  pending: z.number(),
  critical: z.boolean(),
})

export const stateSchema = z.object({
  schema: z.literal(1),
  seed: z.number().int(),
  rng: z.number().int().min(0),
  cycle: z.number().int().min(0),
  capacity: z.number().int().min(1),
  clock: iso,
  nextEventId: z.number().int().min(0),
  asset: perModel(modelConfig),
  twin: perModel(modelConfig),
  events: z.array(
    z.object({
      id: z.string(),
      model: modelId,
      twinVersion: z.string(),
      assetVersion: z.string(),
      driftClass,
      detectedAt: iso,
      detectedCycle: z.number().int(),
      description: z.string(),
    }),
  ).max(50),
  history: z.array(
    z.object({
      cycle: z.number().int(),
      executedAt: iso,
      capacity: z.number(),
      used: z.number(),
      solver,
      selectAll: z.boolean(),
      impactRestored: z.number(),
      repairs: z.array(z.object({ eventId: z.string(), model: modelId, before: z.string(), after: z.string(), driftClass, description: z.string(), cost: z.number(), impact: z.number(), pendingCycles: z.number() })),
      deferred: z.array(z.object({ eventId: z.string(), model: modelId, cost: z.number(), impact: z.number(), pendingCycles: z.number() })),
      inputs: z.array(candidate),
    }),
  ).max(100),
  activity: z.array(z.object({ at: iso, kind: z.enum(['drift', 'allocation', 'repair', 'system']), tone: z.enum(['neutral', 'critical', 'success']), message: z.string(), detail: z.string() })).max(100),
  settings: settingsSchema,
})

export const proposalSchema = z.object({
  selected: z.array(z.string()),
  deferred: z.array(z.string()),
  used: z.number(),
  benefit: z.number(),
  selectAll: z.boolean(),
  cycle: z.number().int(),
  capacity: z.number().int().min(1),
  solver,
  fingerprint: z.string(),
})

export const requests = {
  init: z.object({ seed: z.number().int().min(1).max(1_000_000).optional() }),
  view: z.object({ state: stateSchema }),
  inject: z.object({ state: stateSchema, model: modelId.optional(), driftClass: driftClass.optional(), burst: z.boolean().optional() }),
  evolve: z.object({ state: stateSchema, model: modelId }),
  propose: z.object({ state: stateSchema, capacity: z.number().int().min(1).max(10_000), solver }),
  confirm: z.object({ state: stateSchema, proposal: proposalSchema }),
  settings: z.object({ state: stateSchema, settings: settingsSchema }),
  experiments: z.object({
    settings: settingsSchema.optional(),
    seeds: z.number().int().min(1).max(100).optional(),
    nValues: z.array(z.number().int().min(1).max(40)).min(1).max(10).optional(),
  }),
}
