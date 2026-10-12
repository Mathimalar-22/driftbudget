// POST /api/experiments — scenario S4 sweep: seeds 1..N × n values × tight/moderate/generous capacity.
import { DEFAULT_SETTINGS } from '@/lib/driftbudget/config'
import { DEFAULT_N_VALUES, runS4 } from '@/lib/driftbudget/experiments'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { Settings } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.experiments, ({ settings, seeds, nValues }) => {
    const seedList = Array.from({ length: seeds ?? 30 }, (_, i) => i + 1)
    return runS4((settings as Settings) ?? DEFAULT_SETTINGS, seedList, nValues ?? DEFAULT_N_VALUES)
  })
}
