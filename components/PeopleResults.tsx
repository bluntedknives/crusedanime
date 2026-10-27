'use client'

import Link from 'next/link'
import { IconSearch, IconSparkle } from './icons'

export interface StaffSummary {
  id: number
  name: string
  image: string | null
  occupations: string[]
}

export interface StudioSummary {
  id: number
  name: string
}

interface Props {
  staff: StaffSummary[]
  studios: StudioSummary[]
  query: string
}

/**
 * People and studios that match the query.
 *
 * Shown only when the title search comes back nearly empty, so a search for a
 * director or an animation house lands somewhere instead of on an empty grid.
 */
export default function PeopleResults({ staff, studios, query }: Props) {
  if (!staff.length && !studios.length) return null

  return (
    <section className="surface mb-5 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <IconSparkle size={14} className="text-accent" />
        <h2 className="text-sm font-semibold text-zinc-100">
          People &amp; studios matching “{query}”
        </h2>
      </div>

      <div className="divide-y divide-white/[0.05]">
        {studios.map((s) => (
          <Link
            key={`studio-${s.id}`}
            href={`/studio/${s.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-base-750 text-[10px] font-semibold uppercase text-accent-soft">
              ST
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-100">{s.name}</span>
              <span className="text-[11px] text-zinc-500">Animation studio</span>
            </span>
            <span className="text-[11px] text-accent-soft">View work →</span>
          </Link>
        ))}

        {staff.map((p) => (
          <Link
            key={`staff-${p.id}`}
            href={`/staff/${p.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-base-750">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="grid h-full w-full place-items-center text-zinc-600">
                  <IconSearch size={16} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-100">{p.name}</span>
              <span className="truncate text-[11px] text-zinc-500">
                {p.occupations.length ? p.occupations.join(' · ') : 'Crew'}
              </span>
            </span>
            <span className="text-[11px] text-accent-soft">Credits →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
