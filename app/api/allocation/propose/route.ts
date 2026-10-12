// POST /api/allocation/propose — run the chosen solver. Returns a plan; the twin state is NOT changed.
import { buildCandidates, propose } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import { allocate } from '@/lib/driftbudget/solvers'
import { SOLVERS, type DemoState } from '@/lib/driftbudget/types'

export async function POST(req: Request) {
  return handle(req, requests.propose, ({ state, capacity, solver }) => {
    const s = state as DemoState
    const proposal = propose(s, capacity, solver)
    // Same candidate set through every policy, for the operator's side-by-side check.
    const candidates = buildCandidates(s)
    const comparison = SOLVERS.map((id) => {
      const a = allocate(candidates, capacity, id)
      return { solver: id, benefit: a.benefit, used: a.used, selected: a.selected.length }
    })
    return { proposal, comparison }
  })
}
