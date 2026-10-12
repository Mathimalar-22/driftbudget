// POST /api/asset/evolve — controlled evolution: asset and twin move forward together.
import { buildView, evolveAsset } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { DemoState } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.evolve, ({ state, model }) => {
    const next = evolveAsset(state as DemoState, model)
    return { state: next, view: buildView(next) }
  })
}
