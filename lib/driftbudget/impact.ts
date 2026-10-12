// Metadata extractor and benefit calculator: C(r) and I(r) (paper Eq. 2).

import { CRITICAL_THRESHOLD } from './config'
import type { DriftClass, ModelId, Settings } from './types'

/**
 * Eq. (2): I(r) = (wc·Crit(m) + wq·Cons(r) + wd·log2(1 + Dep(m))) · (1 + wp·Pend(r)).
 * The pending factor multiplies the existing consequence, so a deferred safety
 * repair grows faster than a deferred reporting repair.
 */
export function impactScore(settings: Settings, model: ModelId, pending: number): number {
  const meta = settings.models[model]
  const { wc, wq, wd, wp } = settings.weights
  const base = wc * meta.criticality + wq * settings.consequenceScore[meta.consequence] + wd * Math.log2(1 + meta.dependents)
  return base * (1 + wp * Math.max(0, pending))
}

/** C(r) ∈ Z+: from maintenance metadata for the drift class, the model, and how many elements diverged. */
export function repairCost(settings: Settings, model: ModelId, driftClass: DriftClass, divergedCount: number): number {
  const extra = Math.max(0, divergedCount - 1) * settings.perElementCost
  return Math.max(1, Math.round(settings.classCost[driftClass] + settings.models[model].repairOverhead + extra))
}

export function isCritical(settings: Settings, model: ModelId): boolean {
  return settings.models[model].criticality >= CRITICAL_THRESHOLD
}
