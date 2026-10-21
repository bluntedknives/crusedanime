import Link from 'next/link'
import * as data from '@/lib/data'
import type { Media } from '@/lib/anilist'
import PosterCard from '@/components/PosterCard'
import PreviewBanner from '@/components/PreviewBanner'

export const revalidate = 900

export const metadata = {
  title: 'Trending',
  description: 'What the AniList community is watching right now.',
}

function Section({
  title,
  subtitle,
  items,
  href,
}: {
  title: string
  subtitle: string
  items: Media[]
  href?: string
}) {
  if (!items.length) return null
  return (
    <section className="animate-fade-up">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">{subtitle}</p>
          <h2 className="section-title">{title}</h2>
        </div>
        {href && (
          <Link
            href={href}
            className="font-mono text-[0.65rem] uppercase tracking-wider text-zinc-500 transition-colors hover:text-accent"
          >
            View all
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((m) => (
          <PosterCard key={m.id} media={m} />
        ))}
      </div>
    </section>
  )
}

export default async function TrendingPage() {
  const [trend, airing, top] = await Promise.all([
    data.trending(1, 24),
    data.airingNow(1, 24),
    data.topRated(1, 24),
  ])
  const preview = trend.preview && airing.preview && top.preview

  return (
    <div className="container-page animate-fade-in space-y-10 pt-6">
      <div>
        <p className="eyebrow mb-2">Discover</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Trending right now
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Ranked live from AniList activity. Updated continuously.
        </p>
      </div>

      {preview && <PreviewBanner />}

      <Section
        title="Hot this moment"
        subtitle="Highest current engagement across the community"
        items={trend.data}
      />
      <Section
        title="Currently airing"
        subtitle="Shows with an episode due in the next seven days"
        items={airing.data}
        href="/schedule"
      />
      <Section
        title="All-time highest rated"
        subtitle="The best-scoring titles on AniList"
        items={top.data}
        href="/search?sort=SCORE_DESC"
      />
    </div>
  )
}
