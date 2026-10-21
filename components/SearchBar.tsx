'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { posterOf, titleOf, type Media } from '@/lib/anilist'

interface Props {
  /** Controlled initial value (used on the search page). */
  initialValue?: string
  /** Debounced callback; fired ~320ms after typing stops. */
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
  /** Show the live suggestion dropdown. */
  suggestions?: boolean
}

interface Suggestion {
  id: number
  title: string
  poster: string
  year: number | null
  format: string | null
}

export default function SearchBar({
  initialValue = '',
  onChange,
  onSubmit,
  placeholder = 'Search anime…',
  compact = false,
  autoFocus = false,
  suggestions = true,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const skipFetch = useRef(true)

  // Keep in sync when the URL changes underneath us (back/forward).
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  // Debounced notify + suggestion fetch.
  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false
      return
    }

    const term = value.trim()
    const handle = setTimeout(() => {
      onChange?.(value)

      if (!suggestions || term.length < 2) {
        setItems([])
        setLoading(false)
        return
      }

      const ctrl = new AbortController()
      setLoading(true)
      fetch(`/api/anilist?action=search&q=${encodeURIComponent(term)}&perPage=6`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { media?: Media[] }) => {
          setItems(
            (data.media ?? []).map((m) => ({
              id: m.id,
              title: titleOf(m),
              poster: posterOf(m),
              year: m.seasonYear ?? m.startDate?.year ?? null,
              format: m.format ?? null,
            })),
          )
          setOpen(true)
          setHighlight(-1)
        })
        .catch(() => {})
        .finally(() => setLoading(false))

      return () => ctrl.abort()
    }, 320)

    return () => clearTimeout(handle)
  }, [value, onChange, suggestions])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const submit = (term: string) => {
    setOpen(false)
    if (onSubmit) onSubmit(term)
    else if (term.trim()) router.push(`/search?q=${encodeURIComponent(term.trim())}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h + 1) % items.length)
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault()
      setHighlight((h) => (h - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && highlight >= 0 && items[highlight]) router.push(`/anime/${items[highlight].id}`)
      else submit(value)
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(value)
        }}
        role="search"
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => items.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Search anime"
            className={[
              'input pl-9 pr-9',
              compact ? 'py-2 text-[13px]' : 'py-3 text-sm',
            ].join(' ')}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" />
              </svg>
            </span>
          )}
        </div>
      </form>

      {suggestions && open && items.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/10 bg-ink-850/98 shadow-2xl backdrop-blur-xl">
          {items.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                setOpen(false)
                router.push(`/anime/${s.id}`)
              }}
              className={[
                'flex w-full items-center gap-3 px-3 py-2 text-left transition',
                i === highlight ? 'bg-white/10' : 'hover:bg-white/5',
              ].join(' ')}
            >
              <span className="h-12 w-8 shrink-0 overflow-hidden rounded bg-ink-700">
                {s.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-zinc-100">
                  {s.title}
                </span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {[s.format?.replace(/_/g, ' '), s.year].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => submit(value)}
            className="w-full border-t border-white/5 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-brand-soft hover:bg-white/5"
          >
            See all results for “{value.trim()}”
          </button>
        </div>
      )}
    </div>
  )
}
