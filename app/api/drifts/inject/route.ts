// POST /api/drifts/inject — drift injection: the asset changes, the twin does not.
import { buildView, injectDrift, retrofitBurst } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { DemoState } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.inject, ({ state, model, driftClass, burst }) => {
    const next = burst ? retrofitBurst(state as DemoState, 3) : injectDrift(state as DemoState, { model, driftClass })
    return { state: next, view: buildView(next) }
  })
}
