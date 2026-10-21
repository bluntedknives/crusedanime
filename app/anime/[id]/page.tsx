import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PosterCard from '@/components/PosterCard'
import WatchlistButton from '@/components/WatchlistButton'
import AiringCountdown from '@/components/AiringCountdown'
import Synopsis from '@/components/Synopsis'
import TrailerEmbed from '@/components/TrailerEmbed'
import EpisodeSection from '@/components/EpisodeSection'
import {
  byId,
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  stripHtml,
  titleOf,
  type Media,
} from '@/lib/anilist'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id)) return { title: 'Not found' }
  try {
    const m = await byId(id)
    return {
      title: titleOf(m),
      description: stripHtml(m.description).slice(0, 160) || undefined,
      openGraph: {
        title: titleOf(m),
        images: posterOf(m) ? [{ url: posterOf(m) }] : undefined,
      },
    }
  } catch {
    return { title: 'Not found' }
  }
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-100">{value ?? '—'}</dd>
    </div>
  )
}

function RelationCard({ edge }: { edge: NonNullable<Media['relations']>['edges'][number] }) {
  const m = edge.node
  return (
    <Link
      href={`/anime/${m.id}`}
      className="surface group flex gap-2.5 p-2 transition hover:border-white/15 hover:bg-ink-800"
    >
      <span className="h-[72px] w-[50px] shrink-0 overflow-hidden rounded bg-ink-700">
        {posterOf(m) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterOf(m)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-brand-soft">
          {(edge.relationType ?? '').replace(/_/g, ' ').toLowerCase()}
        </span>
        <span className="line-clamp-2 block text-[12.5px] font-medium leading-snug text-zinc-100 group-hover:text-brand-soft">
          {titleOf(m)}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-zinc-500">
          {[formatLabel(m.format), m.seasonYear].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  )
}

export default async function AnimeDetailPage({ params }: Params) {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) notFound()

  let media: Media
  try {
    media = await byId(id)
  } catch {
    notFound()
  }

  const title = titleOf(media)
  const poster = posterOf(media)
  const score = scoreOf(media)
  const studios = media.studios?.edges?.map((e) => e.node) ?? []
  const relations = (media.relations?.edges ?? []).filter((e) => e.node?.id && e.node.id !== media.id)
  const recommendations = (media.recommendations?.nodes ?? [])
    .map((n) => n.mediaRecommendation)
    .filter((m): m is Media => Boolean(m?.id))
  const staff = media.staff?.edges ?? []
  const altTitles = [media.title.english, media.title.romaji, media.title.native, ...(media.synonyms ?? [])]
    .filter((t): t is string => Boolean(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 5)

  const nextEp = media.nextAiringEpisode

  return (
    <div className="animate-fade-in">
      {/* ------------------------------------------------------------ banner */}
      <div className="relative">
        <div className="relative h-[38vh] min-h-[260px] w-full overflow-hidden">
          {media.bannerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.bannerImage} alt="" className="h-full w-full object-cover" />
          ) : poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="h-full w-full scale-110 object-cover blur-lg" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/75 to-ink-950/25" />
        </div>
      </div>

      <div className="container-page -mt-32 sm:-mt-40">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* -------------------------------------------------- poster + meta */}
          <div className="mx-auto w-[190px] shrink-0 md:mx-0 md:w-[230px]">
            <div className="overflow-hidden rounded-xl bg-ink-800 poster-shadow">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={title} className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[2/3] place-items-center p-4 text-center text-xs text-zinc-500">
                  {title}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <WatchlistButton media={media} size="lg" className="w-full [&>div]:w-full [&_button:first-child]:flex-1" />
              <Link href={`/watch/${media.id}/1`} className="btn-primary w-full">
                ▶ Watch now
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Score" value={score != null ? `${score}%` : '—'} />
              <Stat label="Rank" value={media.popularity ? `#${media.popularity}` : '—'} />
              <Stat label="Episodes" value={media.episodes ?? '—'} />
              <Stat label="Duration" value={media.duration ? `${media.duration}m` : '—'} />
              <Stat label="Format" value={formatLabel(media.format)} />
              <Stat label="Status" value={(media.status ?? '—').replace(/_/g, ' ').toLowerCase()} />
              <Stat label="Season" value={seasonLabel(media.season, media.seasonYear)} />
              <Stat label="Source" value={media.source ? media.source.replace(/_/g, ' ').toLowerCase() : '—'} />
            </dl>

            {media.externalLinks?.length ? (
              <div className="mt-4">
                <h3 className="label">Links</h3>
                <div className="flex flex-wrap gap-1.5">
                  {media.externalLinks.slice(0, 8).map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="chip hover:bg-white/10"
                    >
                      {l.site}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* ------------------------------------------------------- main body */}
          <div className="min-w-0 flex-1 pt-2 md:pt-32">
            <div className="flex flex-wrap items-center gap-2">
              {media.isAdult && (
                <span className="chip border-red-500/40 bg-red-500/10 text-red-300">18+</span>
              )}
              {media.status === 'RELEASING' && (
                <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  Airing
                </span>
              )}
              {nextEp && <AiringCountdown airingAt={nextEp.airingAt} episode={nextEp.episode} />}
            </div>

            <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            {media.title.native && media.title.native !== title && (
              <p className="mt-1 text-sm text-zinc-500">{media.title.native}</p>
            )}

            {media.genres?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {media.genres.map((g) => (
                  <Link key={g} href={`/search?genre=${encodeURIComponent(g)}`} className="chip hover:bg-white/10">
                    {g}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-5 max-w-3xl">
              <Synopsis description={media.description} />
            </div>

            {studios.length > 0 && (
              <div className="mt-4">
                <h3 className="label">Studios</h3>
                <div className="flex flex-wrap gap-1.5">
                  {studios.map((s) => (
                    <Link
                      key={s.id}
                      href={`/search?studio=${encodeURIComponent(s.name)}`}
                      className="chip hover:bg-white/10"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {media.tags?.length ? (
              <div className="mt-4">
                <h3 className="label">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {media.tags
                    .filter((t) => !t.isMediaSpoiler)
                    .slice(0, 14)
                    .map((t) => (
                      <span key={t.id} className="chip">
                        {t.name}
                        {t.rank ? <span className="text-zinc-500">{t.rank}%</span> : null}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}

            {altTitles.length > 0 && (
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
                <span className="font-semibold uppercase tracking-wider">Also known as:</span>{' '}
                {altTitles.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* --------------------------------------------------- episodes + side */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <EpisodeSection
              animeId={media.id}
              malId={media.idMal}
              title={title}
              altTitles={altTitles}
              totalEpisodes={media.episodes}
              status={media.status}
            />

            {relations.length > 0 && (
              <section className="surface p-4 sm:p-5">
                <h2 className="section-title mb-3">Related</h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {relations.slice(0, 12).map((edge) => (
                    <RelationCard key={`${edge.id}-${edge.node.id}`} edge={edge} />
                  ))}
                </div>
              </section>
            )}

            {recommendations.length > 0 && (
              <section>
                <h2 className="section-title mb-3">You might also like</h2>
                <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 xl:grid-cols-6">
                  {recommendations.slice(0, 12).map((m) => (
                    <PosterCard key={m.id} media={m} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <TrailerEmbed trailer={media.trailer} title={title} />

            {staff.length > 0 && (
              <section className="surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-100">Staff</h2>
                <ul className="space-y-2">
                  {staff.slice(0, 8).map((s) => (
                    <li key={`${s.node.id}-${s.role}`} className="flex items-center gap-2.5">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-700">
                        {s.node.image?.large ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.node.image.large}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-zinc-100">
                          {s.node.name.full}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {s.role ?? '—'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {media.characters?.edges?.length ? (
              <section className="surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-100">Characters</h2>
                <ul className="grid grid-cols-2 gap-3">
                  {media.characters.edges.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-700">
                        {c.node.image?.large ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.node.image.large}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] text-zinc-100">
                          {c.node.name.full}
                        </span>
                        <span className="block truncate text-[10px] uppercase tracking-wide text-zinc-500">
                          {c.role?.toLowerCase()}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  )
}
