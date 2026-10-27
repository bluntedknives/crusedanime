'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconClose, IconSearch } from './icons'
import { formatLabel, posterOf, scoreOf, seasonLabel, titleOf, type Media } from '@/lib/anilist'
import { detailPath } from './PosterCard'

const RECENT_KEY = 'anistream:recent-searches:v1'
const RECENT_MAX = 8

interface Props {
  /** Initial text; the search page seeds this from the URL. */
  initialQuery?: string
  /** Called as the visitor types, after the caller's own debounce. */
  onQueryChange: (q: string) => void
  /** Called when a suggestion or recent search is committed. */
  onSubmit?: (q: string) => void
  autoFocus?: boolean
  /** Shorter field for the top bar. */
  compact?: boolean
  /** Focus the field when "/" is pressed anywhere outside a text field. */
  hotkey?: boolean
}

export function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function pushRecent(term: string): void {
  const t = term.trim()
  if (!t || typeof window === 'undefined') return
  try {
    const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(
      0,
      RECENT_MAX,
    )
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Search field with live suggestions, recent searches and keyboard navigation.
 *
 * Suggestions come from `/api/search`, which merges both catalogues. Querying
 * only the anime endpoint made every film and series invisible here — typing
 * "South Park" produced nothing even though the title exists in the app.
 */
export default function SearchBar({
  initialQuery = '',
  onQueryChange,
  onSubmit,
  autoFocus = false,
  compact = false,
  hotkey = false,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Media[]>([])
  const [people, setPeople] = useState<{ id: number; name: string; image: string | null }[]>([])
  const [studioHits, setStudioHits] = useState<{ id: number; name: string }[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setRecent(readRecent()), [])

  // "/" focuses the field, matching the convention every media site uses.
  useEffect(() => {
    if (!hotkey) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey])

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Fetch suggestions for the current text. Shorter than the results debounce
  // so the dropdown feels responsive.
  useEffect(() => {
    const term = value.trim()
    if (term.length < 2) {
      setSuggestions([])
      setPeople([])
      setStudioHits([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8&deep=1`, {
          signal: ctrl.signal,
        })
        const data = await res.json()
        setSuggestions((data.results ?? []).slice(0, 6))
        // Only meaningful when the title list came back thin, which is what
        // the endpoint already decides; these arrive empty otherwise.
        setPeople((data.staff ?? []).slice(0, 3))
        setStudioHits((data.studios ?? []).slice(0, 3))
      } catch {
        /* aborted or failed: leave the previous list */
      }
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [value])

  const commit = useCallback(
    (term: string) => {
      const t = term.trim()
      if (!t) return
      pushRecent(t)
      setRecent(readRecent())
      setOpen(false)
      setActive(-1)
      inputRef.current?.blur()
      onSubmit?.(t)
      onQueryChange(t)
      setValue(t)
    },
    [onQueryChange, onSubmit],
  )

  const goToAnime = useCallback(
    (id: number) => {
      if (value.trim()) pushRecent(value.trim())
      setOpen(false)
      // Films and series have their own detail route; `detailPath` decides.
      router.push(detailPath(id))
    },
    [router, value],
  )

  const options = useMemo(
    () => (value.trim().length >= 2 ? suggestions.map((s) => s.id) : []),
    [value, suggestions],
  )

  const showRecent = value.trim().length < 2 && recent.length > 0

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (options.length ? (i + 1) % options.length : -1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const idx = active >= 0 ? options[active] : null
      if (idx != null) {
        goToAnime(idx)
      } else {
        commit(value)
      }
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <IconSearch
          size={compact ? 15 : 16}
          className={[
            'pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-500',
            compact ? 'left-3' : 'left-3.5',
          ].join(' ')}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
            setActive(-1)
            onQueryChange(e.target.value)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search anime by title…"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          className={[
            'input w-full',
            compact ? 'h-10 text-sm' : 'h-12 text-base',
            compact ? 'pl-9 pr-[4.6rem]' : 'pl-11 pr-24',
          ].join(' ')}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              setSuggestions([])
              setPeople([])
              setStudioHits([])
              onQueryChange('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className={[
              'btn-icon absolute top-1/2 -translate-y-1/2',
              compact ? 'right-[4.1rem] h-6 w-6' : 'right-[4.6rem] h-8 w-8',
            ].join(' ')}
          >
            <IconClose size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={() => commit(value)}
          className={[
            'absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-accent font-semibold text-black transition hover:brightness-110',
            compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs',
          ].join(' ')}
        >
          Search
        </button>
      </div>

      {open && (showRecent || suggestions.length > 0 || people.length > 0 || studioHits.length > 0) && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 overflow-hidden rounded-xl border border-white/[0.09] bg-base-900/95 shadow-2xl backdrop-blur-xl animate-scale-in"
        >
          {showRecent && (
            <div className="border-b border-white/[0.06] p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
                  Recent
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearRecent()
                    setRecent([])
                  }}
                  className="text-[0.65rem] text-zinc-500 transition hover:text-zinc-300"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => commit(r)}
                    className="rounded-md border border-white/[0.08] px-2.5 py-1 text-xs text-zinc-300 transition hover:border-accent/40 hover:bg-accent/10 hover:text-accent-soft"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="max-h-[22rem] overflow-y-auto p-1.5">
              {suggestions.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goToAnime(m.id)}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition',
                      i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]',
                    ].join(' ')}
                  >
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-base-750">
                      {posterOf(m) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterOf(m)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-zinc-100">{titleOf(m)}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-zinc-500">
                        {m.format && <span>{formatLabel(m.format)}</span>}
                        {m.seasonYear && <span>· {seasonLabel(m.season, m.seasonYear)}</span>}
                        {scoreOf(m) != null && <span>· {scoreOf(m)}%</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(people.length > 0 || studioHits.length > 0) && (
            <div className="border-t border-white/[0.06] p-1.5">
              <p className="px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-zinc-500">
                People &amp; studios
              </p>
              {studioHits.map((st) => (
                <Link
                  key={`st-${st.id}`}
                  href={`/studio/${st.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[0.05]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded bg-base-750 text-[9px] font-semibold uppercase text-accent-soft">
                    ST
                  </span>
                  <span className="text-sm text-zinc-200">{st.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">Studio</span>
                </Link>
              ))}
              {people.map((p) => (
                <Link
                  key={`pp-${p.id}`}
                  href={`/staff/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[0.05]"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-base-750">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="text-sm text-zinc-200">{p.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">Person</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
