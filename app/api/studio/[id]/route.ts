import { NextRequest, NextResponse } from 'next/server'
import * as anilist from '@/lib/anilist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const studioId = Number(id)
  if (!Number.isFinite(studioId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  const page = Math.max(1, Number(new URL(req.url).searchParams.get('page')) || 1)
  try {
    const studio = await anilist.byStudio(studioId, page)
    return NextResponse.json(studio)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
