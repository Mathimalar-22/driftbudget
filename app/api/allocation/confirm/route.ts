// POST /api/allocation/confirm — re-validate the proposal, then run the repair executor.
import { buildView, confirm } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { DemoState, Proposal } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.confirm, ({ state, proposal }) => {
    const next = confirm(state as DemoState, proposal as Proposal)
    return { state: next, view: buildView(next), record: next.history[0] }
  })
}
