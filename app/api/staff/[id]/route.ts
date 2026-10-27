import { NextRequest, NextResponse } from 'next/server'
import * as anilist from '@/lib/anilist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staffId = Number(id)
  if (!Number.isFinite(staffId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  const page = Math.max(1, Number(new URL(req.url).searchParams.get('page')) || 1)
  try {
    const staff = await anilist.byStaff(staffId, page)
    return NextResponse.json(staff)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
