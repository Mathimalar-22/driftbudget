// Default configuration. The paper does not publish its weights, criticality
// values or repair costs, so these are illustrative defaults. All of them can be
// edited on the Settings page (or here) without touching the algorithms.

import type { ModelConfig, ModelId, Settings, DriftClass } from './types'

export const DEFAULT_SETTINGS: Settings = {
  weights: { wc: 0.4, wq: 0.35, wd: 0.25, wp: 0.2 },
  consequenceScore: { safety: 5, quality: 4, production: 3, maintenance: 2, reporting: 1 },
  classCost: { attribute: 5, structural: 10 },
  perElementCost: 2,
  models: {
    spindle: { label: 'Spindle', criticality: 4, consequence: 'production', dependents: 4, repairOverhead: 3 },
    cooling: { label: 'Cooling', criticality: 3, consequence: 'production', dependents: 2, repairOverhead: 1 },
    safety: { label: 'Safety', criticality: 5, consequence: 'safety', dependents: 5, repairOverhead: 3 },
    energy: { label: 'Energy', criticality: 2, consequence: 'reporting', dependents: 1, repairOverhead: 0 },
    maintenance: { label: 'Maintenance', criticality: 3, consequence: 'maintenance', dependents: 3, repairOverhead: 1 },
    quality: { label: 'Quality', criticality: 4, consequence: 'quality', dependents: 2, repairOverhead: 2 },
  },
}

/** A model counts as critical (for the "require attention" and critical-repair metrics) at Crit ≥ this. */
export const CRITICAL_THRESHOLD = 4

/** Initial physical configuration of the simulated CNC machining center, one versioned aspect per model. */
export const INITIAL_CONFIG: Record<ModelId, ModelConfig> = {
  spindle: {
    version: { major: 2, minor: 1 },
    elements: { maxRpm: 12000, torqueLimitNm: 95, feedRateLimit: 4800, warmupSec: 120, 'mode.roughing': 'enabled', 'mode.finishing': 'enabled' },
  },
  cooling: {
    version: { major: 1, minor: 6 },
    elements: { flowLpm: 22, coolantTempC: 18, pumpPressureBar: 6.5, strategy: 'flood', 'loop.mist': 'installed' },
  },
  safety: {
    version: { major: 2, minor: 8 },
    elements: { doorInterlock: 'hard', spindleStopMs: 350, enclosureTempMaxC: 55, vibrationTripMm: 7.1, 'zone.operator': 'light-curtain' },
  },
  energy: {
    version: { major: 1, minor: 7 },
    elements: { peakLoadKw: 38, standbyKw: 2.4, tariffProfile: 'TOU-A', 'meter.subcircuit': 'installed' },
  },
  maintenance: {
    version: { major: 1, minor: 3 },
    elements: { lubeIntervalH: 250, spindleServiceH: 2000, filterIntervalH: 500, calibrationOffset: 0.012, 'task.wayCover': 'scheduled' },
  },
  quality: {
    version: { major: 2, minor: 4 },
    elements: { toleranceMm: 0.02, surfaceRaUm: 1.6, sampleRate: 10, 'gauge.inprocess': 'probe' },
  },
}

export interface DriftTemplate {
  cls: DriftClass
  key: string
  label: string
  /** Alternatives for string attributes, or the value used when a structural element is added. */
  values?: string[]
}

/** Ways each aspect of the asset can change (retrofit, re-parameterisation, new modes). */
export const DRIFT_TEMPLATES: Record<ModelId, DriftTemplate[]> = {
  spindle: [
    { cls: 'attribute', key: 'maxRpm', label: 'Spindle max-speed retrofit' },
    { cls: 'attribute', key: 'torqueLimitNm', label: 'Torque limit re-parameterised' },
    { cls: 'attribute', key: 'feedRateLimit', label: 'Feed-rate constraint changed' },
    { cls: 'structural', key: 'mode.hsm', label: 'High-speed machining mode', values: ['enabled'] },
  ],
  cooling: [
    { cls: 'attribute', key: 'flowLpm', label: 'Coolant flow coefficient updated' },
    { cls: 'attribute', key: 'strategy', label: 'Cooling strategy changed', values: ['flood', 'through-spindle', 'high-pressure'] },
    { cls: 'structural', key: 'loop.mql', label: 'MQL cooling loop', values: ['installed'] },
  ],
  safety: [
    { cls: 'attribute', key: 'spindleStopMs', label: 'Safety stop threshold tightened' },
    { cls: 'attribute', key: 'vibrationTripMm', label: 'Vibration trip threshold changed' },
    { cls: 'structural', key: 'zone.robotCell', label: 'Robot-cell safety zone', values: ['area-scanner'] },
  ],
  energy: [
    { cls: 'attribute', key: 'peakLoadKw', label: 'Peak load profile changed' },
    { cls: 'attribute', key: 'tariffProfile', label: 'Tariff profile switched', values: ['TOU-A', 'TOU-B', 'flat'] },
    { cls: 'structural', key: 'meter.chiller', label: 'Chiller sub-meter', values: ['installed'] },
  ],
  maintenance: [
    { cls: 'attribute', key: 'lubeIntervalH', label: 'Lubrication interval revised' },
    { cls: 'attribute', key: 'calibrationOffset', label: 'Sensor calibration offset updated' },
    { cls: 'structural', key: 'task.ballScrew', label: 'Ball-screw inspection task', values: ['scheduled'] },
  ],
  quality: [
    { cls: 'attribute', key: 'toleranceMm', label: 'Tolerance envelope tightened' },
    { cls: 'attribute', key: 'surfaceRaUm', label: 'Surface-finish spec updated' },
    { cls: 'structural', key: 'gauge.cmm', label: 'In-line CMM gauge', values: ['installed'] },
  ],
}
