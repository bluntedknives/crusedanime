import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WatchClient from '@/components/WatchClient'
import * as data from '@/lib/data'
import { stripHtml, titleOf, type Media } from '@/lib/anilist'
import { isCovered } from '@/lib/coverServer'
import { coverTitle } from '@/lib/cover'
import * as movies from '@/lib/movies'
import type { EpisodeInfo } from '@/lib/consumet'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string; ep: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: rawId, ep } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id)) return { title: 'Watch' }
  const covered = await isCovered()
  if (movies.isMovieId(id)) {
    const d = await movies.detail(id)
    return { title: coverTitle(d?.name, covered) }
  }
  try {
    const { data: m } = await data.byId(id)
    if (!m) return { title: 'Watch' }
    return {
      title: covered ? coverTitle(null, true) : `Episode ${ep} — ${titleOf(m)}`,
      description: stripHtml(m.description).slice(0, 160) || undefined,
    }
  } catch {
    return { title: 'Watch' }
  }
}

export default async function WatchPage({ params }: Params) {
  const covered = await isCovered()
  const { id: rawId, ep: rawEp } = await params
  const id = Number(rawId)
  const episode = Number(rawEp)
  if (!Number.isFinite(id)) notFound()
  if (!Number.isFinite(episode) || episode <= 0) notFound()

  let media: Media
  /**
   * Films and series come from the other catalogue, which has no provider
   * episode list. Their episodes are derived from Cinemeta's `videos`, and a
   * film is a single episode, so the list is supplied up front rather than
   * fetched — the client would otherwise ask the anime provider for it.
   */
  let initialEpisodes: EpisodeInfo[] | undefined

  if (movies.isMovieId(id)) {
    const detail = await movies.detail(id)
    if (!detail) notFound()
    media = movies.adapt(detail)

    const listed = movies.episodesOf(detail)
    initialEpisodes = listed.length
      ? listed.map((e, i) => ({
          number: i + 1,
          // Keep the provider's own numbering: the embed fallback addresses
          // episodes as season/episode, so flattening this would point every
          // request at season 1.
          season: e.season ?? 1,
          id: e.id,
          title: e.name ?? `Episode ${i + 1}`,
          image: e.thumbnail ?? null,
          description: e.overview ?? null,
          filler: false,
          hasSub: false,
          hasDub: false,
          ani: '',
          mal: '',
          embedId: e.id,
        }))
      : [
          {
            number: 1,
            id: `${id}-1`,
            title: detail.name,
            image: detail.poster ?? null,
            description: detail.description ?? null,
            filler: false,
            hasSub: false,
            hasDub: false,
            ani: '',
            mal: '',
            embedId: `${id}-1`,
          },
        ]
    if (episode > initialEpisodes.length) notFound()
  } else {
    if (id <= 0) notFound()
    const res = await data.byId(id)
    if (!res.data) notFound()
    media = res.data
  }

  const altTitles = [
    media.title.english,
    media.title.romaji,
    media.title.native,
    ...(media.synonyms ?? []),
  ]
    .filter((t): t is string => Boolean(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 5)

  return (
    <Suspense
      fallback={
        <div className="container-page pt-6">
          <div className="skeleton aspect-video w-full" />
        </div>
      }
    >
      <WatchClient
        media={media}
        episode={episode}
        altTitles={altTitles}
        covered={covered}
        initialEpisodes={initialEpisodes}
      />
    </Suspense>
  )
}
