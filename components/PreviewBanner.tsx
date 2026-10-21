import { IconAlert } from './icons'

/**
 * Shown whenever the page is rendering the offline preview set instead of live
 * AniList data. Deliberately visible: seed data must never be mistaken for the
 * real thing.
 */
export default function PreviewBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="container-page">
        <div className="flex items-center gap-2.5 rounded-md border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm text-accent-soft">
          <IconAlert size={16} className="shrink-0" />
          <p>
            Preview data — the AniList provider is unreachable, so titles shown here are
            placeholders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="container-page">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-accent/25 bg-accent/[0.07] px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
          <IconAlert size={14} />
          Preview mode
        </span>
        <p className="text-sm text-accent-soft/90">
          AniList is not responding, so these are placeholder titles. Playback and your
          watchlist are unaffected.
        </p>
      </div>
    </section>
  )
}
