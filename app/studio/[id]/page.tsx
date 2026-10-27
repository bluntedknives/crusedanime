import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PosterCard from '@/components/PosterCard'
import * as anilist from '@/lib/anilist'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const studioId = Number(id)
  if (!Number.isFinite(studioId)) return { title: 'Not found' }
  try {
    const s = await anilist.byStudio(studioId, 1, 1)
    return { title: s.name, description: `Anime produced by ${s.name}.` }
  } catch {
    return { title: 'Not found' }
  }
}

export default async function StudioPage({ params }: Params) {
  const { id } = await params
  const studioId = Number(id)
  if (!Number.isFinite(studioId)) notFound()

  let studio: anilist.StudioDetail
  try {
    studio = await anilist.byStudio(studioId, 1, 40)
  } catch {
    notFound()
  }

  // Deduped for the same reason as the staff page: one title can be listed
  // under a studio more than once.
  const works = [...new Map((studio.media.media ?? []).map((m) => [m.id, m])).values()]

  return (
    <div className="container-page pt-6">
      <nav className="mb-5 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/search" className="transition hover:text-zinc-300">
          Search
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-400">Studio</span>
      </nav>

      <header className="surface mb-6 p-5">
        <p className="eyebrow mb-1">Animation studio</p>
        <h1 className="section-title">{studio.name}</h1>
        <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          {studio.media.pageInfo.total} title{studio.media.pageInfo.total === 1 ? '' : 's'}
        </p>
      </header>

      {works.length === 0 ? (
        <div className="surface grid place-items-center p-12 text-center">
          <p className="text-sm text-zinc-400">No titles on record for this studio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {works.map((m) => (
            <PosterCard key={m.id} media={m} />
          ))}
        </div>
      )}
    </div>
  )
}
