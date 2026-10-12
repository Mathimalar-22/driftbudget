// GET /api/settings — default impact-model settings. PUT — apply new settings to a state.
import { NextResponse } from 'next/server'
import { DEFAULT_SETTINGS } from '@/lib/driftbudget/config'
import { buildView, updateSettings } from '@/lib/driftbudget/engine'
import { handle } from '@/lib/driftbudget/http'
import { requests } from '@/lib/driftbudget/schema'
import type { DemoState, Settings } from '@/lib/driftbudget/types'

export async function GET() {
  return NextResponse.json({ settings: DEFAULT_SETTINGS })
}

export async function PUT(req: Request) {
  return handle(req, requests.settings, ({ state, settings }) => {
    const next = updateSettings(state as DemoState, settings as Settings)
    return { state: next, view: buildView(next) }
  })
}
