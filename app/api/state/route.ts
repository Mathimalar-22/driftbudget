// POST /api/state — create (or reset to) the seeded demo state.
import { buildView, createInitialState } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'

export async function POST(req: Request) {
  return handle(req, requests.init, ({ seed }) => {
    const state = createInitialState(seed ?? 42)
    return { state, view: buildView(state) }
  })
}
