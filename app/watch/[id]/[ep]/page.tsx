import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WatchClient from '@/components/WatchClient'
import * as data from '@/lib/data'
import { stripHtml, titleOf, type Media } from '@/lib/anilist'
import { isCovered } from '@/lib/coverServer'
import { coverTitle } from '@/lib/cover'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string; ep: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: rawId, ep } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id)) return { title: 'Watch' }
  const covered = await isCovered()
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

  if (id <= 0) notFound()
  const res = await data.byId(id)
  if (!res.data) notFound()
  const media: Media = res.data

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
      />
    </Suspense>
  )
}
