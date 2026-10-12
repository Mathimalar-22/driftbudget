// CNC simulator: the physical configuration is versioned data per aspect.
// Controlled evolution moves the asset AND the twin forward together.
// Drift injection moves only the asset, leaving the twin on the old version,
// which creates a divergence with known ground truth (paper Section III-E).

import { DRIFT_TEMPLATES, type DriftTemplate } from './config'
import type { ConfigValue, DriftClass, ModelConfig, ModelId } from './types'
import type { Rng } from './prng'

export function versionString(cfg: ModelConfig): string {
  return `v${cfg.version.major}.${cfg.version.minor}`
}

export function cloneConfig(cfg: ModelConfig): ModelConfig {
  return { version: { ...cfg.version }, elements: { ...cfg.elements } }
}

/** Element keys whose value differs between the twin model and the asset (including added/removed elements). */
export function divergedElements(twin: ModelConfig, asset: ModelConfig): string[] {
  const keys = new Set([...Object.keys(twin.elements), ...Object.keys(asset.elements)])
  return [...keys].filter((k) => twin.elements[k] !== asset.elements[k]).sort()
}

/** Consistency = share of configuration elements on which twin and asset agree (from configuration divergence, not sensor values). */
export function consistency(twin: ModelConfig, asset: ModelConfig): number {
  const keys = new Set([...Object.keys(twin.elements), ...Object.keys(asset.elements)])
  if (keys.size === 0) return 1
  const diverged = divergedElements(twin, asset).length
  return (keys.size - diverged) / keys.size
}

export function isDrifted(twin: ModelConfig, asset: ModelConfig): boolean {
  return versionString(twin) !== versionString(asset)
}

function roundLike(original: number, value: number): number {
  const text = String(original)
  const decimals = text.includes('.') ? text.split('.')[1].length : 0
  const factor = 10 ** Math.max(decimals, 0)
  const rounded = Math.round(value * factor) / factor
  return rounded === original ? original + 1 / factor : rounded
}

function changeAttribute(current: ConfigValue | undefined, template: DriftTemplate, rng: Rng): ConfigValue {
  if (template.values && template.values.length) {
    const options = template.values.filter((v) => v !== current)
    return rng.pick(options.length ? options : template.values)
  }
  const base = typeof current === 'number' ? current : 1
  const up = rng.next() < 0.5
  const factor = up ? 1.05 + rng.next() * 0.15 : 0.8 + rng.next() * 0.15
  return roundLike(base, base * factor)
}

export interface AppliedChange {
  config: ModelConfig
  driftClass: DriftClass
  description: string
}

/** Apply one configuration change to a model (asset side). */
export function applyChange(cfg: ModelConfig, model: ModelId, rng: Rng, forceClass?: DriftClass): AppliedChange {
  const pool = DRIFT_TEMPLATES[model].filter((t) => !forceClass || t.cls === forceClass)
  const template = rng.pick(pool)
  const next = cloneConfig(cfg)
  let description: string

  if (template.cls === 'structural') {
    if (template.key in next.elements) {
      delete next.elements[template.key]
      description = `${template.label} removed`
    } else {
      next.elements[template.key] = template.values?.[0] ?? 'enabled'
      description = `${template.label} added`
    }
    next.version = { major: next.version.major + 1, minor: 0 }
  } else {
    const before = next.elements[template.key]
    const after = changeAttribute(before, template, rng)
    next.elements[template.key] = after
    description = `${template.label} (${template.key}: ${before ?? '—'} → ${after})`
    next.version = { major: next.version.major, minor: next.version.minor + 1 }
  }

  return { config: next, driftClass: template.cls, description }
}
