'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconArrowRight, IconClock, IconCommand, IconSearch, IconSpinner } from './icons'
import { useRecentSearches } from '@/lib/collections'
import { formatLabel, posterOf, scoreOf, seasonLabel, titleOf, type Media } from '@/lib/anilist'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Browse' },
  { href: '/trending', label: 'Trending' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/season', label: 'Seasons' },
  { href: '/genres', label: 'Genres' },
  { href: '/upnext', label: 'Up next' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/ratings', label: 'Ratings' },
  { href: '/history', label: 'History' },
  { href: '/stats', label: 'Stats' },
]

/**
 * Command palette (Cmd/Ctrl-K).
 *
 * Merges three kinds of result into one list: navigation, recent searches and
 * live AniList title matches. Keyboard-first — arrow keys move, Enter opens —
 * because the point is to reach a title without touching the mouse.
 */
export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { terms, push, remove } = useRecentSearches()

  /* Global open shortcut. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      // Focus after the panel mounts, otherwise the ref is still null.
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
    setQ('')
    setResults([])
    setActive(0)
  }, [open])

  /* Debounced title search. */
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, { signal: ctrl.signal })
        const json = await res.json()
        setResults(Array.isArray(json.results) ? json.results : [])
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const navMatches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return NAV.slice(0, 6)
    return NAV.filter((n) => n.label.toLowerCase().includes(term)).slice(0, 4)
  }, [q])

  const termMatches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return terms.slice(0, 4)
    return terms.filter((t) => t.toLowerCase().includes(term)).slice(0, 4)
  }, [q, terms])

  type Row = { kind: 'nav' | 'term' | 'title'; key: string; label: string; sub?: string; poster?: string; go: () => void }
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const n of navMatches) {
      out.push({ kind: 'nav', key: `nav-${n.href}`, label: n.label, sub: n.href, go: () => router.push(n.href) })
    }
    for (const t of termMatches) {
      out.push({
        kind: 'term',
        key: `term-${t}`,
        label: t,
        sub: 'Recent search',
        go: () => {
          push(t)
          router.push(`/search?q=${encodeURIComponent(t)}`)
        },
      })
    }
    for (const m of results) {
      out.push({
        kind: 'title',
        key: `title-${m.id}`,
        label: titleOf(m),
        sub: `${formatLabel(m.format)} · ${seasonLabel(m.season, m.seasonYear)}${scoreOf(m) ? ` · ${scoreOf(m)}%` : ''}`,
        poster: posterOf(m),
        go: () => router.push(`/anime/${m.id}`),
      })
    }
    return out
  }, [navMatches, termMatches, results, router, push])

  const close = useCallback(() => setOpen(false), [])

  const choose = useCallback(
    (row: Row | undefined) => {
      if (!row) return
      if (q.trim().length >= 2 && row.kind === 'title') push(q.trim())
      row.go()
      close()
    },
    [close, push, q],
  )

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, rows.length - 1)))
  }, [rows.length])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/15 hover:text-zinc-200 md:flex"
        aria-label="Open command palette"
      >
        <IconSearch size={14} />
        <span>Search…</span>
        <kbd className="ml-4 rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[0.6rem] text-zinc-500">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-base-850/98 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-3">
          <IconCommand size={16} className="shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') return close()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => (rows.length ? (i + 1) % rows.length : 0))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                choose(rows[active])
              }
            }}
            placeholder="Search titles, or jump to a page…"
            className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          {loading && <IconSpinner size={15} className="shrink-0 animate-spin text-accent" />}
          <button
            type="button"
            onClick={close}
            className="shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              {q.trim().length < 2 ? 'Type to search AniList…' : 'No matches.'}
            </p>
          )}
          {rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(row)}
              className={[
                'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
              ].join(' ')}
            >
              {row.poster ? (
                <span className="h-10 w-7 shrink-0 overflow-hidden rounded bg-base-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.poster} alt="" className="h-full w-full object-cover" />
                </span>
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white/[0.05] text-zinc-500">
                  {row.kind === 'term' ? <IconClock size={14} /> : <IconArrowRight size={14} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{row.label}</span>
                {row.sub && <span className="block truncate font-mono text-[0.62rem] text-zinc-500">{row.sub}</span>}
              </span>
              {row.kind === 'term' && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(row.label)
                  }}
                  className="shrink-0 px-1 text-zinc-600 transition-colors hover:text-zinc-300"
                  aria-label={`Remove ${row.label} from recent searches`}
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
