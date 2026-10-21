import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import WatchClient from '@/components/WatchClient'
import { byId, stripHtml, titleOf, type Media } from '@/lib/anilist'

export const revalidate = 600

interface Params {
  params: { id: string; ep: string }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const id = Number(params.id)
  if (!Number.isFinite(id)) return { title: 'Watch' }
  try {
    const m = await byId(id)
    return {
      title: `Episode ${params.ep} — ${titleOf(m)}`,
      description: stripHtml(m.description).slice(0, 160) || undefined,
    }
  } catch {
    return { title: 'Watch' }
  }
}

export default async function WatchPage({ params }: Params) {
  const id = Number(params.id)
  const episode = Number(params.ep)
  if (!Number.isFinite(id) || id <= 0) notFound()
  if (!Number.isFinite(episode) || episode <= 0) notFound()

  let media: Media
  try {
    media = await byId(id)
  } catch {
    notFound()
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
      <WatchClient media={media} episode={episode} altTitles={altTitles} />
    </Suspense>
  )
}
