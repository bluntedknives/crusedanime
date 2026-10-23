import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PosterCard from '@/components/PosterCard'
import AiringCountdown from '@/components/AiringCountdown'
import Synopsis from '@/components/Synopsis'
import TrailerEmbed from '@/components/TrailerEmbed'
import EpisodeSection from '@/components/EpisodeSection'
import DetailHero from '@/components/DetailHero'
import { RatingWidget } from '@/components/DetailActions'
import * as data from '@/lib/data'
import PreviewBanner from '@/components/PreviewBanner'
import {
  formatLabel,
  posterOf,
  scoreOf,
  seasonLabel,
  stripHtml,
  titleOf,
  type Media,
} from '@/lib/anilist'
import { coverLabel, coverTitle } from '@/lib/cover'
import { isCovered } from '@/lib/coverServer'

export const revalidate = 600

interface Params {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id)) return { title: 'Not found' }
  const covered = await isCovered()
  try {
    const { data: m } = await data.byId(id)
    if (!m) return { title: 'Not found' }
    return {
      title: coverTitle(titleOf(m), covered),
      description: stripHtml(m.description).slice(0, 160) || undefined,
      openGraph: covered
        ? undefined
        : {
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-100">{value ?? '—'}</dd>
    </div>
  )
}

function RelationCard({ edge }: { edge: NonNullable<Media['relations']>['edges'][number] }) {
  const m = edge.node
  return (
    <Link
      href={`/anime/${m.id}`}
      className="surface group flex gap-2.5 p-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      <span className="h-[72px] w-[50px] shrink-0 overflow-hidden rounded bg-base-700">
        {posterOf(m) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterOf(m)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-accent-soft">
          {(edge.relationType ?? '').replace(/_/g, ' ').toLowerCase()}
        </span>
        <span className="line-clamp-2 block text-[12.5px] font-medium leading-snug text-zinc-100 group-hover:text-accent-soft">
          {titleOf(m)}
        </span>
        <span className="mt-0.5 block font-mono text-[0.6rem] text-zinc-600">
          {formatLabel(m.format)}
          {m.seasonYear ? ` · ${m.seasonYear}` : ''}
          {m.episodes ? ` · ${m.episodes} EP` : ''}
        </span>
      </span>
    </Link>
  )
}

export default async function AnimeDetailPage({ params }: Params) {
  const covered = await isCovered()
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isFinite(id)) notFound()

  const { data: media, preview } = await data.byId(id)
  if (!media) notFound()

  const title = titleOf(media)
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
      <DetailHero media={media} />

      <div className="container-page">
        {preview && (
          <div className="mb-4">
            <PreviewBanner compact />
          </div>
        )}
        {/* ------------------------------------------------------- stat strip */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Score" value={score != null ? `${score}%` : '—'} />
          <Stat label="Popularity" value={media.popularity ? `#${media.popularity}` : '—'} />
          <Stat label="Episodes" value={media.episodes ?? '—'} />
          <Stat label="Duration" value={media.duration ? `${media.duration}m` : '—'} />
          <Stat label="Format" value={formatLabel(media.format)} />
          <Stat label="Status" value={(media.status ?? '—').replace(/_/g, ' ').toLowerCase()} />
          <Stat label="Season" value={seasonLabel(media.season, media.seasonYear)} />
          <Stat
            label="Source"
            value={media.source ? media.source.replace(/_/g, ' ').toLowerCase() : '—'}
          />
        </dl>

        {nextEp && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AiringCountdown airingAt={nextEp.airingAt} episode={nextEp.episode} />
            {media.isAdult && (
              <span className="chip border-red-500/40 bg-red-500/10 text-red-300">18+</span>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- synopsis + meta */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-8">
            <section>
              <h2 className="section-title mb-3">{coverLabel('Synopsis', covered)}</h2>
              <div className="max-w-3xl">
                <Synopsis description={media.description} />
              </div>
            </section>

            {media.genres?.length ? (
              <section>
                <h2 className="label">{coverLabel('Genres', covered)}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {media.genres.map((g) => (
                    <Link
                      key={g}
                      href={`/search?genre=${encodeURIComponent(g)}`}
                      className="chip transition-colors hover:bg-white/10"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {studios.length > 0 && (
              <section>
                <h2 className="label">Studios</h2>
                <div className="flex flex-wrap gap-1.5">
                  {studios.map((s) => (
                    <Link
                      key={s.id}
                      href={`/search?studio=${encodeURIComponent(s.name)}`}
                      className="chip transition-colors hover:bg-white/10"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {media.tags?.length ? (
              <section>
                <h2 className="label">Tags</h2>
                <div className="flex flex-wrap gap-1.5">
                  {media.tags
                    .filter((t) => !t.isMediaSpoiler)
                    .slice(0, 16)
                    .map((t) => (
                      <span key={t.id} className="chip">
                        {t.name}
                        {t.rank ? <span className="text-zinc-600">{t.rank}%</span> : null}
                      </span>
                    ))}
                </div>
              </section>
            ) : null}

            {altTitles.length > 0 && (
              <p className="text-[11px] leading-relaxed text-zinc-600">
                <span className="font-semibold uppercase tracking-wider">Also known as:</span>{' '}
                {altTitles.join(' · ')}
              </p>
            )}

            <EpisodeSection
              covered={covered}
              animeId={media.id}
              malId={media.idMal}
              title={title}
              altTitles={altTitles}
              totalEpisodes={media.episodes}
              status={media.status}
            />
          </div>

          <aside className="space-y-5">
            <section className="surface p-4">
              <RatingWidget animeId={media.id} title={title} />
            </section>

            <TrailerEmbed trailer={media.trailer} title={title} covered={covered} />

            {media.externalLinks?.length ? (
              <section className="surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-100">Links</h2>
                <div className="flex flex-wrap gap-1.5">
                  {media.externalLinks.slice(0, 10).map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="chip transition-colors hover:bg-white/10"
                    >
                      {l.site}
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {staff.length > 0 && (
              <section className="surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-100">Staff</h2>
                <ul className="space-y-2.5">
                  {staff.slice(0, 8).map((s) => (
                    <li key={`${s.node.id}-${s.role}`} className="flex items-center gap-2.5">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-base-700">
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
                        <span className="block truncate font-mono text-[0.6rem] uppercase tracking-wide text-zinc-600">
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
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-base-700">
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
                        <span className="block truncate font-mono text-[0.6rem] uppercase tracking-wide text-zinc-600">
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

        {/* --------------------------------------------------------- relations */}
        {relations.length > 0 && (
          <section className="mt-10">
            <h2 className="section-title mb-3">Related</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {relations.slice(0, 12).map((edge) => (
                <RelationCard key={`${edge.id}-${edge.node.id}`} edge={edge} />
              ))}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="mt-10">
            <h2 className="section-title mb-3">You might also like</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {recommendations.slice(0, 12).map((m) => (
                <PosterCard key={m.id} media={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
