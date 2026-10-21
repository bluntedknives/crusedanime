import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import * as movies from '@/lib/movies'
import { isCovered } from '@/lib/coverServer'
import { coverLabel, coverTitle } from '@/lib/cover'
import Synopsis from '@/components/Synopsis'

export const revalidate = 1800

interface Params {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isFinite(id)) return { title: 'Not found' }
  const covered = await isCovered()
  const detail = await movies.detail(id)
  return { title: coverTitle(detail?.name, covered) }
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-100">{value ?? '—'}</dd>
    </div>
  )
}

/**
 * Film or series detail.
 *
 * A film is a single playable unit, so it links straight into the player as
 * episode 1. A series lists its episodes. Playback is offered only when a
 * public-domain source actually resolves — the resolve happens here, on the
 * server, so the page can say "not available" honestly instead of sending the
 * user to a player that fails.
 */
export default async function MovieDetailPage({ params }: Params) {
  const covered = await isCovered()
  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isFinite(id) || !movies.isMovieId(id)) notFound()

  const detail = await movies.detail(id)
  if (!detail) notFound()

  const isSeries = detail.type === 'series'
  const episodes = movies.episodesOf(detail)
  const year = detail.year ? Number(String(detail.year).slice(0, 4)) : null
  const source = isSeries ? null : await movies.sourceFor(id, detail.name, year).catch(() => null)

  const genres = detail.genres ?? []
  const cast = (detail.cast ?? []).slice(0, 12)
  const playable = isSeries ? episodes.length > 0 : Boolean(source)
  // An IMDb id is all an external player needs, so a licensed title is still
  // watchable even when no public-domain copy exists.
  // `detail.id` is the Cinemeta/IMDb id, which is exactly what these players key on.
  const hasEmbed = Boolean(detail.id)

  return (
    <div className="animate-fade-in">
      {/* ------------------------------------------------------------ banner */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          {detail.background ? (
            <img src={detail.background} alt="" className="h-full w-full object-cover opacity-40" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/80 to-base-950/40" />
        </div>
        <div className="container-page relative flex gap-5 py-10">
          <div className="hidden w-[150px] shrink-0 sm:block">
            <div className="surface overflow-hidden rounded-xl">
              {detail.poster ? (
                <img src={detail.poster} alt={detail.name} className="aspect-[2/3] w-full object-cover" />
              ) : null}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">{isSeries ? 'Series' : 'Film'}</p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{detail.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {[detail.year, detail.runtime, detail.country].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {playable ? (
                <Link href={`/watch/${id}/1`} className="btn btn-primary">
                  Play
                </Link>
              ) : hasEmbed ? (
                // No public copy, but an external player can still serve it, so
                // this is a normal watch link rather than a dead end.
                <Link href={`/watch/${id}/1`} className="btn btn-primary">
                  Play
                </Link>
              ) : (
                <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-300">
                  {isSeries ? 'No episode list available' : 'No public-domain copy available'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-page">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Type" value={isSeries ? 'Series' : 'Film'} />
          <Stat label="Year" value={detail.year ?? '—'} />
          <Stat label="Rating" value={detail.imdbRating ? `${detail.imdbRating}/10` : '—'} />
          <Stat label={isSeries ? 'Episodes' : 'Runtime'} value={isSeries ? episodes.length || '—' : detail.runtime ?? '—'} />
        </dl>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-8">
            <section>
              <h2 className="section-title mb-3">{coverLabel('Synopsis', covered)}</h2>
              <div className="max-w-3xl">
                <Synopsis description={detail.description ?? null} />
              </div>
            </section>

            {genres.length > 0 && (
              <section>
                <h2 className="label">{coverLabel('Genres', covered)}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g) => (
                    <Link
                      key={g}
                      href={`/movies?genre=${encodeURIComponent(g)}${isSeries ? '&kind=series' : ''}`}
                      className="chip transition-colors hover:bg-white/10"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {isSeries && episodes.length > 0 && (
              <section>
                <h2 className="section-title mb-3">{coverLabel('Episodes', covered)}</h2>
                <div className="surface max-h-[520px] overflow-y-auto">
                  <ul className="divide-y divide-white/[0.05]">
                    {episodes.map((ep, i) => (
                      <li key={ep.id}>
                        <Link
                          href={`/watch/${id}/${i + 1}`}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="w-10 shrink-0 font-mono text-[0.7rem] text-zinc-500">
                            {ep.season ? `S${ep.season}E${ep.number ?? i + 1}` : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-200">
                              {ep.name || `Episode ${i + 1}`}
                            </span>
                            {ep.released ? (
                              <span className="block text-[11px] text-zinc-600">
                                {String(ep.released).slice(0, 10)}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Episode playback depends on a public-domain copy being available for the title.
                </p>
              </section>
            )}

            {cast.length > 0 && (
              <section>
                <h2 className="label">Cast</h2>
                <div className="flex flex-wrap gap-1.5">
                  {cast.map((c) => (
                    <span key={c} className="chip">{c}</span>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            {detail.director?.length ? (
              <section className="surface p-4">
                <h2 className="label mb-2">Director</h2>
                <p className="text-sm text-zinc-300">{detail.director.join(', ')}</p>
              </section>
            ) : null}
            {detail.writer?.length ? (
              <section className="surface p-4">
                <h2 className="label mb-2">Writer</h2>
                <p className="text-sm text-zinc-300">{detail.writer.join(', ')}</p>
              </section>
            ) : null}
            {source && (
              <section className="surface p-4">
                <h2 className="label mb-2">Source</h2>
                <p className="text-sm text-zinc-300">
                  Public-domain copy, {source.source.kind.toUpperCase()}
                  {source.source.bytes ? ` · ${Math.round(source.source.bytes / 1e6)} MB` : ''}
                </p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
