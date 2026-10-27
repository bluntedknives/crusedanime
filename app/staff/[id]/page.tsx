import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PosterCard from '@/components/PosterCard'
import * as anilist from '@/lib/anilist'
import { stripHtml } from '@/lib/anilist'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const staffId = Number(id)
  if (!Number.isFinite(staffId)) return { title: 'Not found' }
  try {
    const s = await anilist.byStaff(staffId, 1, 1)
    return {
      title: s.name,
      description: `Anime credits for ${s.name}${s.occupations.length ? ` — ${s.occupations.join(', ')}` : ''}.`,
    }
  } catch {
    return { title: 'Not found' }
  }
}

export default async function StaffPage({ params }: Params) {
  const { id } = await params
  const staffId = Number(id)
  if (!Number.isFinite(staffId)) notFound()

  let person: anilist.StaffDetail
  try {
    person = await anilist.byStaff(staffId, 1, 40)
  } catch {
    notFound()
  }

  // A person can be credited on the same title more than once (different
  // roles), which would otherwise render duplicate React keys.
  const works = [...new Map((person.media.media ?? []).map((m) => [m.id, m])).values()]

  return (
    <div className="container-page pt-6">
      <nav className="mb-5 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/search" className="transition hover:text-zinc-300">
          Search
        </Link>
        <span aria-hidden>/</span>
        <span className="text-zinc-400">Person</span>
      </nav>

      <header className="surface mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-base-750">
          {person.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.image} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="eyebrow mb-1">Crew</p>
          <h1 className="section-title">{person.name}</h1>
          {person.occupations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {person.occupations.map((o) => (
                <span key={o} className="chip">
                  {o}
                </span>
              ))}
            </div>
          )}
          {stripHtml(person.description) && (
            <p className="mt-3 line-clamp-4 max-w-3xl text-xs leading-relaxed text-zinc-400">
              {stripHtml(person.description)}
            </p>
          )}
        </div>
      </header>

      <h2 className="section-title mb-4">
        Credits <span className="text-zinc-600">({person.media.pageInfo.total})</span>
      </h2>

      {works.length === 0 ? (
        <div className="surface grid place-items-center p-12 text-center">
          <p className="text-sm text-zinc-400">No anime credits on record.</p>
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
