// POST /api/view — compute consistency, C(r), I(r) and totals for a stored state.
import { buildView } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { DemoState } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.view, ({ state }) => ({ state, view: buildView(state as DemoState) }))
}
