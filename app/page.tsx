import Link from 'next/link'
import PosterCard from '@/components/PosterCard'
import AiringCountdown from '@/components/AiringCountdown'
import { airingNow, popular, titleOf, trending, type Media } from '@/lib/anilist'

export const revalidate = 300

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function Rail({
  title,
  subtitle,
  items,
  href,
  linkLabel = 'View all',
}: {
  title: string
  subtitle?: string
  items: Media[]
  href?: string
  linkLabel?: string
}) {
  if (!items.length) return null
  return (
    <section className="container-page mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-xs font-medium text-brand-soft hover:text-brand">
            {linkLabel} →
          </Link>
        )}
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
        {items.map((m) => (
          <div key={m.id} className="w-[136px] shrink-0 snap-start sm:w-[152px]">
            <PosterCard media={m} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function HomePage() {
  const [trendingList, popularList, airingList] = await Promise.all([
    safe(() => trending(1, 24), []),
    safe(() => popular(1, 30), []),
    safe(() => airingNow(1, 20), []),
  ])

  const hero = trendingList[0]
  const heroRest = trendingList.slice(1, 13)
  const popularGrid = popularList.slice(0, 24)

  const airingSoon = airingList
    .filter((m) => m.nextAiringEpisode)
    .sort((a, b) => (a.nextAiringEpisode?.airingAt ?? 0) - (b.nextAiringEpisode?.airingAt ?? 0))
    .slice(0, 8)

  const noData = !trendingList.length && !popularList.length

  return (
    <div className="animate-fade-in">
      {/* ---------------------------------------------------------- hero */}
      {hero ? (
        <section className="relative">
          <div className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
            {hero.bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.bannerImage}
                alt=""
                className="h-full w-full object-cover object-center"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/50 to-transparent" />

            <div className="container-page absolute inset-x-0 bottom-0 pb-8">
              <span className="chip mb-3 border-brand/40 bg-brand/15 text-brand-soft">
                #1 Trending this week
              </span>
              <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-white drop-shadow-lg sm:text-5xl">
                {titleOf(hero)}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-zinc-300">
                {hero.averageScore != null && (
                  <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                    ★ {(hero.averageScore / 10).toFixed(1)}
                  </span>
                )}
                {hero.format && <span className="chip">{hero.format.replace(/_/g, ' ')}</span>}
                {hero.seasonYear && <span className="chip">{hero.seasonYear}</span>}
                {hero.episodes && <span className="chip">{hero.episodes} episodes</span>}
                {hero.nextAiringEpisode && (
                  <AiringCountdown
                    airingAt={hero.nextAiringEpisode.airingAt}
                    episode={hero.nextAiringEpisode.episode}
                  />
                )}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300 line-clamp-3">
                {(hero.description ?? '').replace(/<[^>]+>/g, '')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/watch/${hero.id}/1`} className="btn-primary">
                  ▶ Start watching
                </Link>
                <Link href={`/anime/${hero.id}`} className="btn-ghost">
                  More details
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="container-page mt-6">
          <div className="skeleton h-[380px] w-full" />
        </section>
      )}

      {noData && (
        <div className="container-page mt-6">
          <div className="surface p-6 text-center">
            <p className="text-sm font-semibold text-amber-300">AniList is unreachable</p>
            <p className="mt-1 text-xs text-zinc-400">
              Metadata could not be loaded. Check the network and reload.
            </p>
          </div>
        </div>
      )}

      <Rail
        title="Trending now"
        subtitle="What everyone is watching this week"
        items={heroRest}
        href="/search?sort=TRENDING_DESC"
      />

      {/* ------------------------------------------------ airing soon */}
      {airingSoon.length > 0 && (
        <section className="container-page mt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Airing soon</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Next episodes, soonest first</p>
            </div>
            <Link href="/schedule" className="text-xs font-medium text-brand-soft hover:text-brand">
              Full schedule →
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {airingSoon.map((m) => (
              <Link
                key={m.id}
                href={`/anime/${m.id}`}
                className="surface group flex items-center gap-3 p-2.5 transition hover:border-white/15 hover:bg-ink-800"
              >
                <span className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-ink-700">
                  {m.coverImage?.large ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.coverImage.large}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-100 group-hover:text-brand-soft">
                    {titleOf(m)}
                  </span>
                  {m.nextAiringEpisode && (
                    <AiringCountdown
                      className="mt-1"
                      airingAt={m.nextAiringEpisode.airingAt}
                      episode={m.nextAiringEpisode.episode}
                    />
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ popular grid */}
      {popularGrid.length > 0 && (
        <section className="container-page mt-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Most popular</h2>
              <p className="mt-0.5 text-xs text-zinc-500">All-time favourites by popularity</p>
            </div>
            <Link href="/search?sort=POPULARITY_DESC" className="text-xs font-medium text-brand-soft hover:text-brand">
              Browse all →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {popularGrid.map((m) => (
              <PosterCard key={m.id} media={m} />
            ))}
          </div>
        </section>
      )}

      <div className="container-page mt-12 flex flex-wrap gap-3">
        <Link href="/search" className="btn-ghost">
          Browse with filters
        </Link>
        <Link href="/schedule" className="btn-ghost">
          Weekly schedule
        </Link>
        <Link href="/watchlist" className="btn-ghost">
          My watchlist
        </Link>
      </div>
    </div>
  )
}
