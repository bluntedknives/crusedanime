import { Suspense } from 'react'
import * as data from '@/lib/data'
import type { Media } from '@/lib/anilist'
import MediaRail from '@/components/MediaRail'
import PosterCard from '@/components/PosterCard'
import ContinueWatching from '@/components/ContinueWatching'
import HeroSpotlight from '@/components/HeroSpotlight'
import PreviewBanner from '@/components/PreviewBanner'
import { MediaRailSkeleton, PosterGridSkeleton } from '@/components/Skeletons'

// Metadata changes constantly; revalidate instead of caching the shell.
export const revalidate = 1800

async function MovieRails() {
  return (
    <>
    </>
  )
}

async function Rails() {
  const [popular, top, airing, trend] = await Promise.all([
    data.airingNow(1, 24),
    data.topRated(1, 24),
    data.trending(2, 24),
    data.trending(1, 24),
  ])

  const isPreview = popular.preview && top.preview && airing.preview

  return (
    <>
      {isPreview && <PreviewBanner />}
      {popular.data.length > 0 && (
        <MediaRail title="Airing now" eyebrow="This week" items={popular.data} href="/trending" />
      )}
      {top.data.length > 0 && (
        <MediaRail
          title="Top rated"
          eyebrow="All time"
          items={top.data}
          href="/search?sort=SCORE_DESC"
        />
      )}
      {airing.data.length > 0 && <MediaRail title="Trending this week" items={airing.data} />}
      {trend.data.length > 0 && (
        <MediaRail
          title="Most popular"
          eyebrow="By popularity"
          items={trend.data}
          href="/trending"
        />
      )}
    </>
  )
}

async function Spotlight() {
  const { data: items } = await data.trending(1, 6)
  if (!items.length) return null
  return <HeroSpotlight items={items} />
}

async function TopGrid() {
  const { data: items } = await data.trending(1, 18)
  if (!items.length) return null

  return (
    <section className="container-page animate-fade-up">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Right now</p>
          <h2 className="section-title">Trending now</h2>
        </div>
        <p className="font-mono text-[0.65rem] uppercase tracking-wider text-zinc-600">
          {items.length} titles
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((m: Media, i: number) => (
          <PosterCard key={m.id} media={m} rank={i + 1} />
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="space-y-10 pt-2">
      <Suspense fallback={<div className="container-page"><div className="skeleton h-[260px] w-full rounded-2xl sm:h-[340px]" /></div>}>
        <Spotlight />
      </Suspense>

      <ContinueWatching />

      <Suspense
        fallback={
          <div className="space-y-10">
            <MediaRailSkeleton />
            <MediaRailSkeleton />
          </div>
        }
      >
        <Rails />
      </Suspense>

      <Suspense fallback={<div className="container-page"><PosterGridSkeleton /></div>}>
        <TopGrid />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-10">
            <MediaRailSkeleton />
            <MediaRailSkeleton />
          </div>
        }
      >
        <MovieRails />
      </Suspense>
    </div>
  )
}
