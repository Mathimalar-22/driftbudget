import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { EngineError } from './engine'

/** Parse + validate a JSON body, run the handler, and map errors to HTTP responses. */
export async function handle<S extends z.ZodTypeAny>(req: Request, schema: S, fn: (body: z.infer<S>) => unknown) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: `Invalid request: ${issue.path.join('.') || 'body'} — ${issue.message}` }, { status: 422 })
  }
  try {
    return NextResponse.json(await fn(parsed.data))
  } catch (err) {
    if (err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error(err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
