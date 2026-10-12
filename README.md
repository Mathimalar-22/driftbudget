# DriftBudget

Impact-aware prioritization of semantic drift repair in a resource-constrained Digital Twin of a CNC machining center. This is a working implementation of the DriftBudget paper as one Next.js app that deploys to Vercel in one step.

## What it does

When a physical asset is retrofitted or re-parameterised and its twin models are not updated, the twin reasons about a machine that no longer exists (semantic drift). Repair capacity is limited, so DriftBudget scores every detected drift and picks the set of repairs that restores the most operational value within the declared capacity.

**Eq. 1, the allocation problem (0/1 knapsack):**

max Σ I(r) over R' ⊆ R, subject to Σ C(r) ≤ B

**Eq. 2, the impact model:**

I(r) = (wc·Crit(m) + wq·Cons(r) + wd·log2(1 + Dep(m))) · (1 + wp·Pend(r))

## Architecture

```
CNC simulator ─► drift input ─► metadata extractor & benefit (C(r), I(r)) ─► allocation engine ─► repair executor
      ▲                                                                         (Greedy / Exact / FIFO / Severity)
      └──────────── API routes (validated with zod) ◄──── React operator dashboard ────────────────┘
```

| Layer | Where | Paper section |
|---|---|---|
| CNC simulator: six versioned aspects; drift injection vs controlled evolution | `lib/driftbudget/simulator.ts`, `config.ts` | III-A, III-E |
| Impact I(r) (Eq. 2) and cost C(r) from drift-class metadata | `lib/driftbudget/impact.ts` | III-B |
| Exact DP (Alg. 1), Greedy + best-single (Alg. 2), FIFO, Severity-first; select-all when everything fits; deterministic tie-breaks | `lib/driftbudget/solvers.ts` | III-D |
| Cycle workflow: propose (no state change) → confirm (re-validated) → executor → history; deferred repairs carry over with Pend + 1 | `lib/driftbudget/engine.ts` | III-C, V-B, V-C |
| S4 experiment: 30 seeds × n ∈ {3,5,8,10,14} × tight/moderate/generous; same candidate set for every policy | `lib/driftbudget/experiments.ts` | IV, V-A |
| Backend API (validation, scoring, solver calls, confirm/execute) | `app/api/**/route.ts`, `lib/driftbudget/schema.ts` | III-E |
| Operator dashboard: Dashboard, Drift Events, Allocation, History, Experiments, Settings | `app/page.tsx`, `components/driftbudget/*` | V-B |

### API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/state` | Create or reset the seeded demo state (cycle 042 with real history) |
| POST | `/api/view` | Consistency %, C(r), I(r) and totals for a state |
| POST | `/api/drifts/inject` | Drift injection (`model`, `driftClass`, or `burst: true` for a multi-aspect retrofit) |
| POST | `/api/asset/evolve` | Controlled evolution (asset and twin change together) |
| POST | `/api/allocation/propose` | Run a solver and return the plan plus a comparison of all four policies. Does not change state. |
| POST | `/api/allocation/confirm` | Re-check the proposal against current inputs, execute the repairs, log the cycle and open the next one |
| GET / PUT | `/api/settings` | Default weights and metadata / apply new ones |
| POST | `/api/experiments` | Run the S4 sweep |
| GET | `/api/health` | Health check |

### Persistence

The API is stateless, so it runs on Vercel serverless functions without a database. The browser stores the twin state, drift events and full allocation history in `localStorage` and sends them with each request. Every cycle record keeps its recorded inputs (the candidate set), so a past decision can be reconstructed. History is per browser, and **Settings → Reset demo** rebuilds the seeded state. To share history between users, the store can be swapped for Vercel Postgres or Neon; the engine functions stay the same.

## Run locally

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # solver/engine tests (exact DP vs brute force, 2× bound, propose/confirm, S4)
pnpm typecheck
```

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On vercel.com: **Add New → Project**, import the repository, keep the detected Next.js settings and click **Deploy**.
3. No environment variables are needed.

Or from the command line: `npx vercel` and then `npx vercel --prod`.

## Notes and limits

- The paper does not publish its impact weights, criticality values or repair costs. The defaults in `lib/driftbudget/config.ts` are illustrative and editable on the Settings page, so the Experiments page will not reproduce Table IV exactly.
- As in the paper, drift detection is assumed correct: drifts are injected with known ground truth, and consistency % is computed from configuration divergence, not sensor values.
- The paper's prototype uses Python/FastAPI/SQLite. This version implements the same components in TypeScript so the whole system deploys as one Vercel project.
